import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { net } from 'electron';
import { setTimeout as delay } from 'timers/promises';
import { atomicWrite, renameFile } from './atomic-files';
import { inspectJava } from './java';
import fabricLibraries from './fabric-libraries.json';
type FabricLibrary = { name: string; sha1: string; sha256: string; size: number };
const fabricLibrary = (url: string): FabricLibrary | undefined => (fabricLibraries as Record<string, FabricLibrary>)[url];

const hosts = new Set(['piston-meta.mojang.com','piston-data.mojang.com','launchermeta.mojang.com','launcher.mojang.com','libraries.minecraft.net','resources.download.minecraft.net','maven.fabricmc.net']);
export function trustedGameUrl(value: string): string {
  const url=new URL(value);
  if(url.protocol!=='https:' || url.username || url.password || (url.port && url.port!=='443') || !hosts.has(url.hostname)) throw new Error('Недоверенный источник файлов Minecraft.');
  return url.href;
}
export function gamePath(root: string, relative: string): string {
  if(typeof relative!=='string' || !relative || relative.includes('\\') || relative.split('/').some(part=>!part || part==='.' || part==='..' || /[:\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('Некорректный путь файла Minecraft.');
  const target=path.resolve(root,relative), prefix=path.resolve(root)+path.sep;
  if(!target.startsWith(prefix)) throw new Error('Файл Minecraft выходит за пределы папки игры.');
  return target;
}
async function noLinks(root: string, file: string) {
  const relative=path.relative(root,file); let cursor=path.resolve(root);
  for(const part of relative.split(path.sep)) {
    cursor=path.join(cursor,part);
    try { if((await fs.lstat(cursor)).isSymbolicLink()) throw new Error('Файлы Minecraft не должны находиться по символическим ссылкам.'); }
    catch(error:any) { if(error.code==='ENOENT') return; throw error; }
  }
}
async function digest(file: string) {
  const hash=createHash('sha1');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');
}
export async function pool<T>(items: T[], action: (item:T)=>Promise<void>, limit=4) {
  let next=0, failure:unknown;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(!failure && next<items.length){const item=items[next++];try{await action(item);}catch(error){failure=error;}}
  }));
  if(failure)throw failure;
}
const validHash=(value:any)=>typeof value==='string' && /^[0-9a-f]{40}$/i.test(value);
async function response(url:string, signal:AbortSignal, mirrorToken?:string, mirrorOnly=false) {
  const entry = fabricLibrary(url);
  if (mirrorOnly && (!entry || !mirrorToken)) throw new Error('Нет доступа к резервной библиотеке Fabric.');
  const source = mirrorOnly ? 'https://mc.sotocoming.ru/api/public/community/download-mirror/'+entry!.sha256+'/'+encodeURIComponent(entry!.name) : trustedGameUrl(url);
  const res = await net.fetch(source, {
    redirect:'error', signal: entry && !mirrorOnly ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : signal,
    ...(mirrorOnly ? {headers:{'X-Community-Token':mirrorToken!}} : {}),
  });
  if(!res.ok){await res.body?.cancel();throw Object.assign(new Error((mirrorOnly?'Зеркало SEFI':'Источник Minecraft')+' ответил HTTP '+res.status+'.'),{permanent:res.status>=400 && res.status<500 && ![408,429].includes(res.status)});}
  return res;
}
function networkMessage(error:any):string {
  return ['TimeoutError','AbortError'].includes(error?.name) ? 'истекло время ожидания сети' : String(error?.message || error);
}
async function checksum(url:string, name:string):Promise<string> {
  for(let attempt=0;;attempt++){
    try {
      const res=await response(url+'.sha1',AbortSignal.timeout(30000));
      const reader=res.body?.getReader();if(!reader)throw new Error('Пустая контрольная сумма библиотеки.');
      const chunks:Uint8Array[]=[];let size=0;
      try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1024)throw Object.assign(new Error('Слишком большая контрольная сумма библиотеки.'),{permanent:true});chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
      const hash=Buffer.concat(chunks).toString('utf8').trim().split(/\s+/)[0];
      if(!validHash(hash))throw Object.assign(new Error('Некорректная контрольная сумма библиотеки.'),{permanent:true});
      return hash;
    } catch(error:any) {
      if(attempt>=2 || error.permanent)throw new Error('Не удалось проверить библиотеку '+name+' ('+new URL(url).hostname+'): '+networkMessage(error)+'. Повторите запуск.');
      await delay(300*(attempt+1));
    }
  }
}
async function jsonOnce(url:string, expected?:string) {
  const res=await response(url,AbortSignal.timeout(30000));if(!res.body)throw new Error('Пустой ответ источника Minecraft.');
  const chunks:Buffer[]=[];let size=0;
  for await(const chunk of Readable.fromWeb(res.body as any)){size+=chunk.length;if(size>16*1024*1024)throw new Error('Слишком большой каталог Minecraft.');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);
  if(expected && createHash('sha1').update(bytes).digest('hex')!==expected.toLowerCase())throw new Error('Каталог Minecraft повреждён: SHA1 не совпадает.');
  return JSON.parse(bytes.toString('utf8'));
}
async function json(url:string, expected?:string):Promise<any> {
 for(let attempt=0;;attempt++){try{return await jsonOnce(url,expected);}catch(error:any){if(attempt>=2 || error.permanent)throw new Error('Не удалось загрузить каталог Minecraft ('+new URL(url).hostname+'): '+networkMessage(error)+'. Повторите запуск.');await delay(300*(attempt+1));}}
}
export async function ensureGameFile(root:string, file:string, url:string, sha1:string, size?:number, emit?:(received:number,total:number)=>void, mirrorToken?:string) {
  trustedGameUrl(url);
  const pinned = fabricLibrary(url);
  if (pinned && (!validHash(sha1) || sha1.toLowerCase() !== pinned.sha1 || (size !== undefined && size !== pinned.size))) throw new Error('Профиль библиотеки Fabric не совпадает с проверенным каталогом.');
  if(!validHash(sha1) || (size!==undefined && (!Number.isSafeInteger(size) || size<0 || size>512*1024*1024)))throw new Error('Некорректная контрольная сумма или размер файла Minecraft.');
  await noLinks(root,file);
  try{const stat=await fs.stat(file);if(stat.isFile() && (size===undefined || stat.size===size) && await digest(file)===sha1.toLowerCase() && (!pinned || createHash('sha256').update(await fs.readFile(file)).digest('hex')===pinned.sha256))return false;}
  catch(error:any){if(error.code!=='ENOENT')throw error;}
  await fs.mkdir(path.dirname(file),{recursive:true});
  for(let attempt=0;;attempt++){
   for (const mirrorOnly of pinned && mirrorToken ? [false, true] : [false]) {
    const temp=file+'.'+randomUUID()+'.tmp';const controller=new AbortController();
    let idle=setTimeout(()=>controller.abort(),30000);const deadline=setTimeout(()=>controller.abort(),5*60*1000);
    try{
      const res=await response(url,controller.signal,mirrorToken,mirrorOnly);if(!res.body)throw new Error('Пустой файл Minecraft.');
      const hash=createHash('sha1');const strongHash=pinned ? createHash('sha256') : undefined;let received=0;
      await pipeline(Readable.fromWeb(res.body as any),new Transform({transform(chunk,_encoding,callback){
        clearTimeout(idle);idle=setTimeout(()=>controller.abort(),30000);received+=chunk.length;
        if(received>512*1024*1024 || (size!==undefined && received>size))return callback(new Error('Недопустимый размер файла Minecraft.'));
        hash.update(chunk);strongHash?.update(chunk);emit?.(received,size || Number(res.headers.get('content-length')) || 0);callback(null,chunk);
      }}),createWriteStream(temp,{flags:'wx'}),{signal:controller.signal});
      if((size!==undefined && received!==size) || hash.digest('hex')!==sha1.toLowerCase() || (pinned && (received!==pinned.size || strongHash!.digest('hex')!==pinned.sha256)))throw new Error('Файл Minecraft повреждён: '+path.basename(file)+'.');
      await renameFile(temp,file);return true;
    }catch(error:any){
      if (!mirrorOnly && pinned && mirrorToken && !['EACCES','EPERM','ENOSPC','EROFS'].includes(error.code)) continue;
      if(attempt>=2 || error.permanent || ['EACCES','EPERM','ENOSPC','EROFS'].includes(error.code))throw new Error('Не удалось подготовить '+path.basename(file)+': '+(controller.signal.aborted?'загрузка прервалась или истекло время ожидания.':error.message));
      await delay(300*(attempt+1));
    }finally{clearTimeout(idle);clearTimeout(deadline);controller.abort();await fs.unlink(temp).catch(()=>{});}
   }
  }
}
function versionValid(value:any,id:string) {
  try {
    return value?.id===id && Array.isArray(value.libraries) && value.downloads?.client && validHash(value.downloads.client.sha1)
      && Number.isSafeInteger(value.downloads.client.size) && value.downloads.client.size > 0 && !!trustedGameUrl(value.downloads.client.url)
      && value.assetIndex && validHash(value.assetIndex.sha1) && Number.isSafeInteger(value.assetIndex.size) && value.assetIndex.size > 0
      && !!trustedGameUrl(value.assetIndex.url) && typeof value.mainClass==='string' && Array.isArray(value.arguments?.game);
  } catch { return false; }
}
export function libraryAllowed(library:any, os:string):boolean {
  const classifier=String(library.name || '').split(':')[3];
  const arm=['arm64','aarch64'].includes(process.arch);
  if(classifier==='natives-windows-x86' && process.arch!=='ia32')return false;
  if(['natives-windows-arm64','natives-macos-arm64'].includes(classifier) && !arm)return false;
  if(['natives-windows','natives-macos'].includes(classifier) && arm)return false;
  if(classifier==='linux-aarch_64' && !arm)return false;
  if(classifier==='linux-x86_64' && process.arch!=='x64')return false;
  if(!library.rules)return true;
  if(!Array.isArray(library.rules))throw new Error('Некорректные правила библиотеки Minecraft.');
  let allowed=false;
  for(const rule of library.rules){
    if(rule.features && Object.values(rule.features).some(value=>value!==false))continue;
    if(rule.os?.name && rule.os.name!==os)continue;
    if(rule.os?.arch && !new RegExp('^(?:'+rule.os.arch+')$').test(process.arch==='x64'?'x86_64':process.arch))continue;
    if(rule.os?.version)continue; // No version-specific library is required by SEFI's pinned 1.20.1 profile.
    if(!['allow','disallow'].includes(rule.action))throw new Error('Некорректное правило библиотеки Minecraft.');
    allowed=rule.action==='allow';
  }
  return allowed;
}
export function protectMinecraftHandler(handler:any, onFailure?:(error:Error)=>void, mirrorToken?:string) {
  const root=path.resolve(handler.options.root);
  const progress=(type:string,name:string)=>(current:number,total:number)=>handler.client.emit('download-status',{type,name,current,total});
  handler.checkJava=async(java:string)=>{try{await inspectJava(java);return {run:true};}catch(error:any){return {run:false,message:error.message};}};
  handler.parseRule=(library:any)=>!libraryAllowed(library,handler.getOS());
  handler.getVersion=async()=>{
    const id=handler.options.version.number;
    if(id!=='1.20.1')throw new Error('Проверка поддерживает только сборку SEFI Minecraft 1.20.1.');
    const file=gamePath(root,'versions/'+handler.options.version.custom+'/'+id+'.json');
    let version:any;
    try{version=JSON.parse(await fs.readFile(file,'utf8'));if(!versionValid(version,id))version=undefined;}
    catch(error:any){if(error.code!=='ENOENT' && !(error instanceof SyntaxError))throw error;}
    if(!version){
      const manifest=await json('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
      const entry=manifest.versions?.find((v:any)=>v.id===id);if(!entry || !validHash(entry.sha1))throw new Error('Minecraft 1.20.1 отсутствует в официальном каталоге.');
      version=await json(entry.url,entry.sha1);if(!versionValid(version,id))throw new Error('Некорректный профиль Minecraft 1.20.1.');
      await noLinks(root,file);await atomicWrite(file,JSON.stringify(version));
    }
    handler.version=version;
    const jar=gamePath(root,'versions/'+handler.options.version.custom+'/'+handler.options.version.custom+'.jar');
    await ensureGameFile(root,jar,version.downloads.client.url,version.downloads.client.sha1,version.downloads.client.size,progress('version-jar',path.basename(jar)));
    return version;
  };
  handler.downloadToDirectory=async(directory:string,libraries:any[],eventName:string)=>{
    const results:string[]=new Array(libraries.length);let done=0;
    await pool(libraries.map((library,index)=>({library,index})),async({library,index})=>{
      if(!library || !libraryAllowed(library,handler.getOS()))return;
      const parts=String(library.name).split(':');if(parts.length<3 || parts.length>4 || parts.some(p=>!/^[a-zA-Z0-9_.+\-]+$/.test(p)))throw new Error('Некорректное имя библиотеки Minecraft.');
      const artifact=library.downloads?.artifact;
      const relative=artifact?.path || parts[0].replace(/\./g,'/')+'/'+parts[1]+'/'+parts[2]+'/'+parts[1]+'-'+parts[2]+(parts[3]?'-'+parts[3]:'')+'.jar';
      const file=gamePath(directory,relative);const url=artifact?.url || String(library.url)+relative;
      const pinned=fabricLibrary(url);
      let hash=pinned?.sha1 || artifact?.sha1;
      if(!validHash(hash)){
        const receipt=gamePath(root,'cache/sefi-hashes/'+createHash('sha256').update(trustedGameUrl(url)).digest('hex')+'.json');
        try{hash=JSON.parse(await fs.readFile(receipt,'utf8')).sha1;}catch(error:any){if(error.code!=='ENOENT' && !(error instanceof SyntaxError))throw error;}
        if(!validHash(hash)){
          hash=await checksum(url, path.basename(file));
          await noLinks(root,receipt);await atomicWrite(receipt,JSON.stringify({sha1:hash}));
        }
      }
      await ensureGameFile(root,file,url,hash,pinned?.size ?? artifact?.size,progress('libraries',path.basename(file)),mirrorToken);
      results[index]=file;handler.client.emit('progress',{type:'libraries',task:++done,total:libraries.length});
    });return results.filter(Boolean);
  };
  handler.getClasses=async(custom:any)=>{
    const libraryRoot=gamePath(root,'libraries');
    const customLibraries=custom?.libraries || [];
    const identity=(lib:any)=>String(lib.name).split(':').filter((_:any,i:number)=>i!==2).join(':');
    const replaced=new Set(customLibraries.filter((lib:any)=>libraryAllowed(lib,handler.getOS())).map(identity));
    const base=handler.version.libraries.filter((lib:any)=>lib.downloads?.artifact && !replaced.has(identity(lib)));
    return [...await handler.downloadToDirectory(libraryRoot,customLibraries,'libraries'),...await handler.downloadToDirectory(libraryRoot,base,'libraries')];
  };
  handler.getAssets=async()=>{
    const indexFile=gamePath(root,'assets/indexes/'+handler.options.version.custom+'.json');
    const meta=handler.version.assetIndex;
    await ensureGameFile(root,indexFile,meta.url,meta.sha1,meta.size,progress('assets','Индекс ресурсов'));
    const index=JSON.parse(await fs.readFile(indexFile,'utf8'));
    if(!index.objects || typeof index.objects!=='object' || Array.isArray(index.objects))throw new Error('Некорректный индекс ресурсов Minecraft.');
    const entries=Object.values(index.objects) as {hash:string;size:number}[];let done=0;
    if(entries.length>100000)throw new Error('Слишком большой индекс ресурсов Minecraft.');
    await pool(entries,async(item)=>{
      if(!validHash(item?.hash) || !Number.isSafeInteger(item.size) || item.size < 0)throw new Error('Некорректный ресурс Minecraft.');
      const relative=item.hash.slice(0,2)+'/'+item.hash;
      await ensureGameFile(root,gamePath(root,'assets/objects/'+relative),'https://resources.download.minecraft.net/'+relative,item.hash,item.size);
      handler.client.emit('progress',{type:'assets',task:++done,total:entries.length});
    });
  };
  // MCLC catches preparation errors internally and returns null; preserve their cause for the UI.
  for(const method of ['getVersion','getClasses','getAssets']){
    const operation=handler[method];
    handler[method]=async(...args:any[])=>{try{return await operation(...args);}catch(error:any){onFailure?.(error);throw error;}};
  }
}

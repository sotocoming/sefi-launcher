const assert=require('node:assert/strict');const fs=require('node:fs/promises');const sync=require('node:fs');const path=require('node:path');const os=require('node:os');const vm=require('node:vm');const {createHash}=require('node:crypto');const {createRequire}=require('node:module');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));const dep=createRequire(path.join(process.argv[3]||root,'package.json'));const ts=dep('typescript');const sha=bytes=>createHash('sha1').update(bytes).digest('hex');
function loader(mocks){const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(sync.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require(name){if(Object.hasOwn(mocks,name))return mocks[name];if(name.endsWith('.json'))return JSON.parse(sync.readFileSync(path.resolve(path.dirname(file),name),'utf8'));if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name)+'.ts');return dep(name);},Buffer,process,URL,AbortController,AbortSignal,setTimeout,clearTimeout});return module.exports;}return load(path.join(root,'electron/minecraft/game-integrity.ts'));}

(async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sefi-fabric-libs-'));try{
 const bytes=Buffer.from('verified library fixture');const url='https://maven.fabricmc.net/org/ow2/asm/asm-commons/9.9/asm-commons-9.9.jar';
 const entry={name:'asm-commons-9.9.jar',sha1:sha(bytes),sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
 const library={name:'org.ow2.asm:asm-commons:9.9',url:'https://maven.fabricmc.net/'};
 for(const mode of ['official','timeout','404','body-error','official-corrupt','corrupt','oversized','mirror-down','no-token']){
  const game=path.join(dir,mode);let calls=[],events=[];
  const api=loader({'./fabric-libraries.json':{[url]:entry},'./java':{},'timers/promises':{setTimeout:async()=>{}},electron:{net:{fetch:async(target,options)=>{
   calls.push(target);assert.equal(options.redirect,'error');assert(options.signal);
   assert(!target.endsWith('.sha1'),'pinned library must not query Maven checksums');
   if(target===url){assert.equal(options.headers,undefined);if(mode==='official')return new Response(bytes);if(mode==='official-corrupt')return new Response(Buffer.alloc(bytes.length));if(mode==='body-error')return new Response(new ReadableStream({start(controller){controller.error(Error('body timeout'));}}));if(mode==='404')return new Response('',{status:404});throw Object.assign(Error('timeout'),{name:'TimeoutError'})}
   assert.equal(target,'https://mc.sotocoming.ru/api/public/community/download-mirror/'+entry.sha256+'/'+entry.name);
   assert.equal(options.headers['X-Community-Token'],'fixture-token');
   if(mode==='mirror-down')return new Response('',{status:503});
   return new Response(mode==='corrupt'?Buffer.alloc(bytes.length):mode==='oversized'?Buffer.alloc(bytes.length+1):bytes);
  }}}});
  const handler={options:{root:game},getOS:()=> 'windows',client:{emit:(...args)=>events.push(args)}};
  api.protectMinecraftHandler(handler,undefined,mode==='no-token'?undefined:'fixture-token');
  const operation=()=>handler.downloadToDirectory(path.join(game,'libraries'),[library],'libraries');
  if(['corrupt','oversized','mirror-down','no-token'].includes(mode)){
    await assert.rejects(operation());
    await assert.rejects(fs.readFile(path.join(game,'libraries/org/ow2/asm/asm-commons/9.9/asm-commons-9.9.jar')),{code:'ENOENT'});
    if(mode==='no-token')assert(calls.every(x=>x===url));
  }else{
    const paths=await operation();assert.equal(paths.length,1);assert.deepEqual(await fs.readFile(paths[0]),bytes);
    const count=calls.length;await operation();assert.equal(calls.length,count,'cached valid library must work offline');
    await fs.writeFile(paths[0],'damaged');await operation();assert.deepEqual(await fs.readFile(paths[0]),bytes);
  }
  console.log('PASS Fabric libraries',mode);
 }
 const catalog=JSON.parse(await fs.readFile(path.join(root,'electron/minecraft/fabric-libraries.json'),'utf8'));
 assert.equal(Object.keys(catalog).length,8);
 for(const [url,e] of Object.entries(catalog)){assert(url.startsWith('https://maven.fabricmc.net/'));assert(/^[a-f0-9]{40}$/.test(e.sha1));assert(/^[a-f0-9]{64}$/.test(e.sha256));assert(e.size>0);assert.equal(path.posix.basename(url),e.name);}
 console.log('PASS all eight Fabric libraries pinned');
}finally{await fs.rm(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});

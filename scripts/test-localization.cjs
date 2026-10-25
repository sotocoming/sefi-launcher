const assert=require('node:assert/strict'),fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto'),ts=require('typescript'),Zip=require('adm-zip');
const root=path.resolve(__dirname,'..'),manifest=require('../resources/localization/manifest.json');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
(async()=>{const temp=await fs.mkdtemp(path.join(os.tmpdir(),'sefi-localization-test-'));try{
 let appRoot=root,failTarget='';const cache=new Map();
 function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const text=ts.transpileModule(sync.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(text,{module:m,exports:m.exports,process,Buffer,console,require(name){
  if(name==='electron')return {app:{getAppPath:()=>appRoot}};
  if(name==='./modpack-download')return {fileSha256:async p=>sha(await fs.readFile(p)),checkedZip:p=>{const z=new Zip(p);assert(z.test());return z;}};
  if(name==='./atomic-files'){const real=load(path.join(root,'electron/minecraft/atomic-files.ts'));return {...real,atomicWrite:async(file,data)=>{if(file===failTarget){failTarget='';throw new Error('Fixture write failure');}return real.atomicWrite(file,data);}};}
  if(name.endsWith('.json'))return require(path.resolve(path.dirname(file),name));
  return name.startsWith('.')?load(path.resolve(path.dirname(file),name)+'.ts'):require(name);
 }});return m.exports;}
 const {ensureRussianLocalization:ensure}=load(path.join(root,'electron/minecraft/localization.ts'));
 const config={modpack:{curseforgeProjectId:manifest.projectId,curseforgeFileId:manifest.fileId,sha256:manifest.modpackSha256}};
 if(process.env.LOCALIZATION_BASELINE_MANIFEST){
  const original=JSON.parse(await fs.readFile(process.env.LOCALIZATION_BASELINE_MANIFEST,'utf8')),baseline=path.join(temp,'original-pack');await fs.mkdir(baseline);
  for(const item of original.files){if(!item.existed)continue;const source=path.join(path.dirname(process.env.LOCALIZATION_BASELINE_MANIFEST),'originals',item.path),target=path.join(baseline,item.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,target);}
  await ensure(baseline,config);for(const f of manifest.files)assert.equal(sha(await fs.readFile(path.join(baseline,f.path))),f.sha256,'original source: '+f.path);
 }
 const game=path.join(temp,'game');await fs.mkdir(game);await fs.writeFile(path.join(game,'options.txt'),'lang:en_us\nresourcePacks:["vanilla","file/user.zip"]\nfov:87\n');
 await fs.mkdir(path.join(game,'saves/world'),{recursive:true});await fs.writeFile(path.join(game,'saves/world/level.dat'),'preserve-world');
 const one=ensure(game,config),two=ensure(game,config);assert.equal(one,two);await one;
 for(const f of manifest.files)assert.equal(sha(await fs.readFile(path.join(game,f.path))),f.sha256,f.path);
 let options=await fs.readFile(path.join(game,'options.txt'),'utf8');assert(options.includes('lang:ru_ru'));assert(options.includes('file/user.zip'));assert(options.includes('fov:87'));
 const receipt=JSON.parse(await fs.readFile(path.join(game,'sefi-localization.json'),'utf8'));const journal=JSON.parse(await fs.readFile(path.join(game,receipt.backup,'manifest.json'),'utf8'));assert.equal(journal.state,'installed');assert.equal(journal.files.length,64);
 assert.equal(await fs.readFile(path.join(game,receipt.backup,'originals/options.txt'),'utf8'),'lang:en_us\nresourcePacks:["vanilla","file/user.zip"]\nfov:87\n');
 await fs.writeFile(path.join(game,'options.txt'),'lang:en_us\nresourcePacks:[]\nfov:90\n');await ensure(game,config);assert.equal(await fs.readFile(path.join(game,'options.txt'),'utf8'),'lang:en_us\nresourcePacks:[]\nfov:90\n');
 assert.equal(await fs.readFile(path.join(game,'saves/world/level.dat'),'utf8'),'preserve-world');
 const repair=manifest.files[0];await fs.unlink(path.join(game,repair.path));await ensure(game,config);assert.equal(sha(await fs.readFile(path.join(game,repair.path))),repair.sha256);
 await fs.writeFile(path.join(game,repair.path),'custom-user-config');await assert.rejects(ensure(game,config),/Сохраните свои изменения/);assert.equal(await fs.readFile(path.join(game,repair.path),'utf8'),'custom-user-config');
 await assert.rejects(ensure(game,{modpack:{...config.modpack,curseforgeFileId:1}}),/не проверен/);
 const rollback=path.join(temp,'rollback');await fs.mkdir(rollback);const before='resourcePacks:[]\nfov:75\n';await fs.writeFile(path.join(rollback,'options.txt'),before);failTarget=path.join(rollback,'options.txt');await assert.rejects(ensure(rollback,config),/Fixture write failure/);
 assert.equal(await fs.readFile(path.join(rollback,'options.txt'),'utf8'),before);assert.equal(await fs.access(path.join(rollback,'mods/sefi-localization-1.0.0.jar')).then(()=>true,()=>false),false);assert.equal(await fs.access(path.join(rollback,'sefi-localization.json')).then(()=>true,()=>false),false);await ensure(rollback,config);
 const linked=path.join(temp,'linked'),outside=path.join(temp,'outside');await fs.mkdir(linked);await fs.mkdir(outside);await fs.symlink(outside,path.join(linked,'config'),'junction');await assert.rejects(ensure(linked,config),/через ссылки/);assert.deepEqual(await fs.readdir(outside),[]);
 appRoot=path.join(temp,'bad-app');await fs.mkdir(path.join(appRoot,'resources/localization'),{recursive:true});await fs.writeFile(path.join(appRoot,'resources/localization',manifest.archive),'corrupt');await assert.rejects(ensure(path.join(temp,'never-written'),config),/отсутствует или повреждён/);assert.equal(await fs.access(path.join(temp,'never-written')).then(()=>true,()=>false),false);
 const z=new Zip(path.join(root,'resources/localization',manifest.archive));assert(!z.getEntries().some(e=>/TEST-ONLY|\.ttf$|assets\/minecraft\/font\//i.test(e.entryName)));
 console.log('PASS: tested 63-file payload, fresh install, first-run Russian + existing options/packs, user preferences thereafter, idempotence/concurrency, repair, custom-config guard, incompatible pack, backup/rollback, junction and corruption rejection; worlds untouched');
 }finally{await fs.rm(temp,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});

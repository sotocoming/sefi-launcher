const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const {createRequire} = require('module');
const requireLauncher = createRequire(path.resolve(__dirname, '..', 'package.json'));
const ts = requireLauncher('typescript');
const nbt = requireLauncher('prismarine-nbt');
const Module = require('module');
const filename = path.resolve(__dirname, '..', 'electron/minecraft/servers-dat.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
const mod = new Module(filename);mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(compiled,filename);
(async()=>{
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'sefi-euro-'));
 const file=path.join(dir,'servers.dat');
 try{
  const initial={type:'compound',name:'',value:{custom:{type:'string',value:'retain'},servers:{type:'list',value:{type:'compound',value:[{name:{type:'string',value:'Other server'},ip:{type:'string',value:'other.org'},icon:{type:'string',value:'keep-icon'}}]}}}};
  await fsp.writeFile(file,nbt.writeUncompressed(initial));
  const primary={id:'primary',name:'Sweet Home · EURO',ip:'main.org'};
  let extra={id:'additional',name:'Sweet Home · EURO',ip:'eu.org:25566'};
  const read=async()=> (await nbt.parse(await fsp.readFile(file))).parsed.value;
  await mod.exports.ensureServersInServersDat(dir,[primary,extra]);
  await mod.exports.ensureServersInServersDat(dir,[primary,extra]);
  let root=await read(),list=root.servers.value.value;
  assert.equal(list.length,3);assert.equal(root.custom.value,'retain');assert.equal(list[2].icon.value,'keep-icon');assert.equal(list[1].name.value,extra.name);
  extra={...extra,name:'Sweet Home · Europe',ip:'new-eu.org'};
  await mod.exports.ensureServersInServersDat(dir,[primary,extra]);
  list=(await read()).servers.value.value;assert.equal(list.length,3);assert.equal(list[1].ip.value,'new-eu.org');
  await mod.exports.ensureServersInServersDat(dir,[primary]);
  list=(await read()).servers.value.value;assert.equal(list.length,2);assert.equal(list[1].name.value,'Other server');
  await fsp.writeFile(file,'corrupt-file');
  await assert.rejects(mod.exports.ensureServersInServersDat(dir,[primary]));assert.equal(await fsp.readFile(file,'utf8'),'corrupt-file');
  console.log('PASS: both entries, no duplicates, updates/removal, unrelated data and corrupt file preserved');
 }finally{await fsp.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

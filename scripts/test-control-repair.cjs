const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const sync = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const dep=createRequire(path.join(process.argv[3]||root,'package.json'));
const ts=dep('typescript');
const modules=new Map();
function load(file){file=path.resolve(file);if(modules.has(file))return modules.get(file).exports;
 const module={exports:{}};modules.set(file,module);
 const code=ts.transpileModule(sync.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require(name){return name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):dep(name)},Buffer,process,setTimeout,clearTimeout},{filename:file});return module.exports;
}
(async()=>{const {repairClickBindingsText:patch,repairClickBindings:fix,repairResourcePacksText:packText,repairResourcePacks:packFix,JEI_CLICK_BINDINGS:keys}=load(path.join(root,'electron/minecraft/control-repair.ts'));
 const fixture='\ufeffversion:3465\r\nkey_key.attack:key.mouse.left\r\n'+keys.map(k=>k+':key.mouse.left').join('\r\n')+'\r\nkey_key.jei.showRecipe2:key.mouse.left\r\nvolume:0.7\r\n';
 const changed=patch(fixture);assert.equal(changed.changed.length,5);assert.ok(changed.text.startsWith('\ufeffversion:3465\r\n'));assert.match(changed.text,/key_key.attack:key.mouse.left\r\n/);assert.match(changed.text,/key_key.jei.showRecipe2:key.mouse.left\r\n/);assert.match(changed.text,/volume:0.7\r\n$/);assert.equal(patch(changed.text).changed.length,0);
 const custom=keys.map((k,i)=>k+':'+(i===0?'key.keyboard.g':i===1?'key.keyboard.unknown':'key.mouse.left')).join('\n');assert.equal(patch(custom).changed.length,3);assert.ok(patch(custom).text.includes(keys[0]+':key.keyboard.g'));assert.equal(patch('version:1').changed.length,5);assert.equal(patch('version:1').text.split('\n').length,7);assert.throws(()=>patch('bad\0text'),/повреждён/);
 const oldPacks='version:1\r\nresourcePacks:["fabric","file/custom.zip"]\r\nvolume:0.7\r\n';
 const newPacks=packText(oldPacks);assert.equal(newPacks.changed.length,1);assert.ok(newPacks.text.includes('"file/custom.zip","file/Homestead GUI"'));assert.ok(newPacks.text.endsWith('volume:0.7\r\n'));assert.equal(packText(newPacks.text).changed.length,0);assert.throws(()=>packText('resourcePacks:broken'),/повреждён/);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sefi-click-fix-'));try{
  const options=path.join(dir,'options.txt');await fs.writeFile(options,fixture);
  await assert.rejects(()=>fix(dir,async()=>{throw new Error('Minecraft running')}),/Minecraft running/);assert.equal(await fs.readFile(options,'utf8'),fixture);
  const result=await fix(dir,async()=>{});assert.equal(result.changed,5);assert.ok(result.backupPath);assert.equal(await fs.readFile(result.backupPath,'utf8'),fixture);assert.equal(await fs.readFile(options,'utf8'),changed.text);assert.equal((await fix(dir,async()=>{})).changed,0);assert.equal((await fs.readdir(path.join(dir,'sefi-backups','controls'))).length,1);
  await fs.writeFile(options,fixture);let guards=0;await assert.rejects(()=>fix(dir,async()=>{if(++guards===2)await fs.appendFile(options,'concurrent:change\n')}),/изменились/);assert.ok((await fs.readFile(options,'utf8')).endsWith('concurrent:change\n'));assert.ok(!(await fs.readdir(dir)).includes('options.txt.sefi-controls.lock'));
  await fs.writeFile(options,fixture);await fs.writeFile(options+'.sefi-controls.lock','locked');await assert.rejects(()=>fix(dir,async()=>{}),/уже выполняется/);assert.equal(await fs.readFile(options,'utf8'),fixture);await fs.unlink(options+'.sefi-controls.lock');
  await fs.writeFile(options,oldPacks);await assert.rejects(()=>packFix(dir,async()=>{}),/не установлен/);await fs.mkdir(path.join(dir,'resourcepacks','Homestead GUI'),{recursive:true});await fs.writeFile(path.join(dir,'resourcepacks','Homestead GUI','pack.mcmeta'),'{}');assert.equal((await packFix(dir,async()=>{})).changed,1);assert.equal(await fs.readFile(options,'utf8'),newPacks.text);
  await fs.unlink(options);await assert.rejects(()=>fix(dir,async()=>{}),/Сначала один раз/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
 console.log('PASS: five JEI bindings, custom bindings preserved, missing defaults, BOM/CRLF, idempotence, exact backup, running-game refusal, concurrent-change refusal and lock cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});

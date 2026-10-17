const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), os=require('node:os');
const project=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sefi-claims-install-'));
const requireFrom=require('node:module').createRequire(path.join(project,'dist-electron/electron/minecraft/claims-fix.js'));
const load=(resourcesPath,appPath)=>{const context={exports:{},process:{resourcesPath},require(id){if(id==='electron')return {app:{getAppPath:()=>appPath}};return requireFrom(id);}};vm.runInNewContext(fs.readFileSync(path.join(project,'dist-electron/electron/minecraft/claims-fix.js'),'utf8'),context);return context.exports.ensureClaimsColorFix;};
(async()=>{try{
 const game=path.join(temp,'game');fs.mkdirSync(path.join(game,'mods'),{recursive:true});
 fs.writeFileSync(path.join(game,'mods','sefi-claims-color-fix-1.0.0.jar'),'old');fs.writeFileSync(path.join(game,'mods','xaeroworldmap-fabric-1.20.1-1.40.16.jar'),'original');fs.writeFileSync(path.join(game,'mods','user-mod.jar'),'user');
 const install=load(path.join(temp,'missing'),project);await install(game);await install(game);
 const name='sefi-claims-color-fix-1.0.1.jar', bundled=fs.readFileSync(path.join(project,'resources/mods',name));
 assert.deepEqual(fs.readFileSync(path.join(game,'mods',name)),bundled);
 assert.equal(fs.readFileSync(path.join(game,'mods','user-mod.jar'),'utf8'),'user');assert.equal(fs.readFileSync(path.join(game,'mods','xaeroworldmap-fabric-1.20.1-1.40.16.jar'),'utf8'),'original');
 assert(!fs.existsSync(path.join(game,'mods','sefi-claims-color-fix-1.0.0.jar')));const backups=fs.readdirSync(path.join(game,'sefi-backups'));assert.equal(backups.length,1);assert.equal(fs.readFileSync(path.join(game,'sefi-backups',backups[0],'sefi-claims-color-fix-1.0.0.jar'),'utf8'),'old');
 fs.writeFileSync(path.join(game,'mods',name),'broken');await install(game);assert.deepEqual(fs.readFileSync(path.join(game,'mods',name)),bundled);
 const missing=load(path.join(temp,'missing'),path.join(temp,'missing-app'));await assert.rejects(()=>missing(game),/отсутствует/);
 const packaged=path.join(temp,'packaged');fs.mkdirSync(path.join(packaged,'resources','mods'),{recursive:true});fs.copyFileSync(path.join(project,'resources/mods',name),path.join(packaged,'resources/mods',name));await load(packaged,path.join(temp,'missing-app'))(path.join(temp,'packaged-game'));assert.deepEqual(fs.readFileSync(path.join(temp,'packaged-game','mods',name)),bundled);
 const main=fs.readFileSync(path.join(project,'electron/minecraft/launcher.ts'),'utf8');assert(main.indexOf('await ensureClaimsColorFix(settings.gameDirectory)')<main.indexOf("if (activeAccount.type === 'offline' && activeAccount.communityToken)"));
 console.log('PASS: install for all account types, repeat install, repair, previous-version backup, unrelated mods, packaged resources, missing-resource error');
}finally{fs.rmSync(temp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});

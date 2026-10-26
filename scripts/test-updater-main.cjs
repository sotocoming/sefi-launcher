const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{EventEmitter}=require('node:events');
const source=fs.readFileSync(path.join(__dirname,'../dist-electron/electron/main.js'),'utf8');
const start=source.indexOf('function setupAutoUpdater()'),end=source.indexOf("\n",source.indexOf("app.on('window-all-closed'",start));
const fn=source.slice(start,source.lastIndexOf('\n}',end)+2);
function fixture(preview=false){
 const handlers={},events=[],updater=new EventEmitter();updater.checkForUpdates=async()=>{updater.emit('checking-for-update');updater.emit('update-not-available');};
 let installs=0;updater.quitAndInstall=()=>{installs++;};
 const ctx={Error,console:{error(){}},app:{commandLine:{hasSwitch:()=>preview},once(){}},autoUpdater:updater,secureIpc:{handle:(id,fn)=>handlers[id]=fn},sendToMain:(id,state)=>events.push(state),UpdateChecks:require('../dist-electron/electron/update-checks.js').UpdateChecks,gameBusy:false,net:{isOnline:()=>true},isDev:false,mainWindow:{on(){}},setTimeout:()=>0,setInterval:()=>({unref(){}}),clearInterval(){},updateChecks:null};
 ctx.electron_1={app:ctx.app,net:ctx.net};ctx.electron_updater_1={autoUpdater:updater};ctx.update_checks_1={UpdateChecks:ctx.UpdateChecks};vm.runInNewContext(fn+';setupAutoUpdater();',ctx);
 return {ctx,updater,handlers,events,installs:()=>installs};
}
(async()=>{
 const f=fixture();assert.throws(()=>f.handlers['install-update'](),/не загружено/);assert.equal(f.installs(),0);
 await f.handlers['check-for-updates']();assert.equal(f.handlers['get-update-status']().status,'idle');assert(f.handlers['get-update-status']().checkedAt);
 f.updater.emit('update-available',{version:'1.0.30'});f.updater.emit('error',Error('ENOSPC'));assert.equal(f.handlers['get-update-status']().phase,'download');
 f.updater.emit('update-downloaded',{version:'1.0.30'});f.ctx.net.isOnline=()=>false;assert.equal((await f.handlers['check-for-updates']()).status,'ready');
 f.ctx.gameBusy=true;assert.throws(()=>f.handlers['install-update'](),/завершите Minecraft/);f.ctx.gameBusy=false;
 f.handlers['install-update']();f.handlers['install-update']();assert.equal(f.installs(),1);assert.equal(f.handlers['get-update-status']().status,'installing');
 f.updater.emit('error',Error('EPERM'));assert.equal(f.handlers['get-update-status']().phase,'install');assert.equal(f.handlers['get-update-status']().canInstall,true);
 f.updater.quitAndInstall=()=>{throw Error('failed')};assert.throws(()=>f.handlers['install-update'](),/failed/);assert.equal(f.handlers['get-update-status']().status,'error');
 const p=fixture(true);assert.equal(p.updater.autoInstallOnAppQuit,false);assert.match((await p.handlers['check-for-updates']()).error,/отключены/);assert.throws(()=>p.handlers['install-update'](),/отключена/);assert.equal(p.installs(),0);
 console.log('PASS: production updater IPC snapshot, downloaded-ready retention offline, ready/game/duplicate install guards, sync and emitted install errors, preview isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});

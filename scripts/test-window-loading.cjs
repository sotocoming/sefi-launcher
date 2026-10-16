const assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {loadWindowInterface}=require('../dist-electron/electron/window-loading');
class Window extends EventEmitter {
 constructor(){super();this.destroyed=false;this.webContents={isDestroyed:()=>this.destroyed};}
 isDestroyed(){return this.destroyed;}
 loadFile(){return new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});}
}
(async()=>{
 for(const action of ['success','close','destroy','failure']){
  const window=new Window(),errors=[];
  const loading=loadWindowInterface(window,'index.html',error=>errors.push(error));
  const error=Object.assign(new Error('load failed'),{code:action==='failure'?'ERR_FILE_NOT_FOUND':'ERR_ABORTED'});
  if(action==='success')window.resolve();
  else {if(action==='close')window.emit('close');if(action==='destroy')window.destroyed=true;window.reject(error);}
  await loading;assert.equal(errors.length,action==='failure'?1:0);
  if(!window.destroyed)assert.equal(window.listenerCount('close'),0);
 }
 console.log('PASS: successful loads and close/destroy cancellation stay quiet; real load failures still surface.');
})().catch(error=>{console.error(error);process.exitCode=1;});

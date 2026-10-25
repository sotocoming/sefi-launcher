const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events'),ts=require('typescript');
const origin='https://mc.sotocoming.ru',callback=origin+'/api/public/community/auth/discord/callback';
const url='https://discord.com/api/oauth2/authorize?'+new URLSearchParams({client_id:'111111111111111111',redirect_uri:callback,response_type:'code',scope:'identify',state:'s'.repeat(43)});
let mode='success',win,clears=0,requests=0,confirmed=true,account={id:'c',communityToken:'native-secret'},refreshes=0,partitions=new Set();
class Window extends EventEmitter{
 constructor(options){super();win=this;this.options=options;this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=f=>this.open=f;this.dead=false;assert.equal(options.webPreferences.sandbox,true);assert.equal(options.webPreferences.nodeIntegration,false);}
 isDestroyed(){return this.dead;}
 destroy(){if(this.dead)throw Error('double destroy');this.dead=true;this.emit('closed');}
 async loadURL(value){assert.equal(value,url);assert(!value.includes('native-secret'));setImmediate(()=>{
  const e={preventDefault(){}};
  if(mode==='success')this.webContents.emit('will-redirect',e,origin+'/profile?discord_linked=1',false,true);
  if(mode==='cancel')this.destroy();
  if(mode==='denied')this.webContents.emit('will-navigate',e,callback+'?error=access_denied');
  if(mode==='conflict')this.options.webPreferences.session.complete({resourceType:'mainFrame',statusCode:409});
  if(mode==='offline-window')this.webContents.emit('did-fail-load',e,-105,'','',true);
  if(mode==='timeout')this.timer();
 });}
}
const mockSession={fromPartition(name){assert(name.startsWith('sefi-discord-'));assert(!name.startsWith('persist:'));assert(!partitions.has(name));partitions.add(name);return {
 fetch:async(value,options)=>{requests++;assert.equal(value,origin+'/api/public/community/auth/discord/url');assert.equal(options.headers['X-Community-Token'],'native-secret');assert.equal(options.credentials,'include');assert.equal(options.redirect,'error');if(mode==='offline')throw Error('secret-provider-detail');if(mode==='wait-fetch')await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))));return {ok:!['401','429','503'].includes(mode),status:Number(mode),body:{cancel:async()=>{}},json:async()=>({url:mode==='bad-url'?'https://evil.test/?token=native-secret':mode==='bad-scope'?url.replace('scope=identify','scope=email'):url})};},
 cookies:{get:async()=>mode==='no-cookie'?[]:[{httpOnly:true,secure:true,value:'c'.repeat(43)}]},setPermissionRequestHandler(){},setPermissionCheckHandler(){},
 webRequest:{onCompleted(...args){if(args.length===2)this.owner.complete=args[1];},owner:null},
 clearStorageData:async()=>{clears++;}
};}};
const original=mockSession.fromPartition;mockSession.fromPartition=name=>{const s=original(name);s.webRequest.owner=s;return s;};
const mod={exports:{}};const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../electron/minecraft/discord-link.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(source,{exports:mod.exports,module:mod,URL,AbortController,AbortSignal,console,setTimeout:(f,ms)=>{if(ms===300000){win.timer=f;return setTimeout(()=>{},300000);}return setTimeout(f,ms);},clearTimeout,require:id=>id==='electron'?{BrowserWindow:Window,session:mockSession}:id==='./accounts'?{getAccounts:async()=>account?[account]:[],refreshCommunityProfile:async()=>{refreshes++;return confirmed?{id:'c',discordId:'222222222222222222'}:null;}}:require(id)});
const api=mod.exports;
(async()=>{
 await api.linkDiscordAccount('c');assert.equal(refreshes,1);assert(win.dead);assert.equal(clears,1);assert.equal(win.open().action,'deny');
 for(const [m,pattern] of [['cancel',/отменена/],['denied',/отменена/],['conflict',/уже привязан/],['offline-window',/загрузить Discord/],['timeout',/истекло/],['401',/Сессия SEFI/],['429',/Слишком много/],['503',/недоступна/],['offline',/соединиться/],['bad-url',/ссылку/],['bad-scope',/ссылку/],['no-cookie',/защищённую/]]){mode=m;await assert.rejects(api.linkDiscordAccount('c'),pattern);}
 mode='success';confirmed=false;await assert.rejects(api.linkDiscordAccount('c'),/профиль не обновился/);confirmed=true;
 mode='hold';const held=api.linkDiscordAccount('c');const heldCheck=assert.rejects(held,/отменена/);while(!win||win.dead)await new Promise(r=>setImmediate(r));await assert.rejects(api.linkDiscordAccount('c'),/уже открыта/);
 let blocked=false;win.webContents.emit('will-navigate',{preventDefault(){blocked=true;}},'file:///secret');assert(blocked);api.cancelDiscordLink();await heldCheck;
 mode='wait-fetch';const before=requests,pending=api.linkDiscordAccount('c');const cancelled=assert.rejects(pending,/отменена/);while(requests===before)await new Promise(r=>setImmediate(r));api.cancelDiscordLink();await cancelled;
 account=null;await assert.rejects(api.linkDiscordAccount('c'),/Сначала войдите/);await assert.rejects(api.linkDiscordAccount({}),/Выберите профиль/);
 console.log('PASS: native-only token, isolated session/cookie binding, fixed OAuth scope/origin, success refresh, cancel before/during window, timeout, conflict, offline, invalid response, duplicate guard and cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});

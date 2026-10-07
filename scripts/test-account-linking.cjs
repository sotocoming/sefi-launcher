// Runs against compiled main-process code with isolated files and fake OAuth/provider responses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sefi-account-link-'));
const file = path.join(dir, 'accounts.json');
const uuid = 'b3af1c7bf3594169b8494af8d42dca69';
let succeeds = false;
const community = {id:'comm_7',type:'offline',uuid:'offline-test',username:'edssodi',communityToken:'test-community',twitchLogin:'edssodi',active:true};
class FakeWindow extends EventEmitter {
 constructor() { super(); this.webContents = new EventEmitter(); this.webContents.setWindowOpenHandler = () => {}; }
 isDestroyed() { return false; }
 close() { this.emit('closed'); }
 async loadURL(value) {
  const state = new URL(value).searchParams.get('state');
  queueMicrotask(() => this.webContents.emit('will-redirect', {preventDefault(){}}, 'https://example.test/callback?code=test&state='+state));
 }
}
class Auth {
 constructor() { this.token = {redirect:'https://example.test/callback'}; }
 createLink() { return 'https://example.test/auth'; }
 async login() { return {}; }
}
const mod = {exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist-electron/electron/minecraft/accounts.js'),'utf8'), {
 exports:mod.exports,module:mod,console,URL,Buffer,AbortSignal,setTimeout,clearTimeout,queueMicrotask,
 require(id) {
  if (id==='electron') return {app:{getPath:()=>dir},BrowserWindow:FakeWindow};
  if (id==='msmc') return {Auth};
  if (id==='./community-browser') return {};
  if (id==='./microsoft-session') return {MicrosoftSessionError:class extends Error{},microsoftFailure:e=>e,minecraftSession:async()=>({profile:{id:uuid,name:'Gon_Zumo'},accessToken:'test-game-token'})};
  return require(id);
 },
 fetch:async (url, options) => {
  assert(url.endsWith('/auto-link'));
  assert.equal(JSON.parse(options.body).minecraft_access_token,'test-game-token');
  return {ok:succeeds,json:async()=>succeeds?{user:{mc_type:'microsoft',mc_uuid:'b3af1c7b-f359-4169-b849-4af8d42dca69',mc_verified_at:123,whitelist_status:'pending'}}:{error:'Provider rejected proof'}};
 }
});
(async()=>{
 try {
  fs.writeFileSync(file,JSON.stringify([community]));
  let account = await mod.exports.loginMicrosoft();
  assert.equal(account.mcVerifiedAt,0);
  assert.equal(account.mcType,'offline');
  assert(account.communityLinkError.includes('Provider rejected proof'));
  assert.equal(JSON.parse(fs.readFileSync(file)).length,2);
  succeeds = true;
  account = await mod.exports.loginMicrosoft();
  assert.equal(account.mcVerifiedAt,123);
  assert.equal(account.mcType,'microsoft');
  assert.equal(account.mcUuid.replace(/-/g,''),uuid);
  assert.equal(account.communityLinkError,undefined);
  assert.equal(JSON.parse(fs.readFileSync(file)).length,1);
  console.log('PASS: failed binding remains retryable; successful provider proof sets confirmed binding; standard profile removed only after success');
 } finally { if(fs.existsSync(file))fs.unlinkSync(file); fs.rmdirSync(dir); }
})().catch(error=>{console.error(error);process.exitCode=1;});

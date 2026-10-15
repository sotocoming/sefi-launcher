const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {EventEmitter} = require('node:events');
const source = fs.readFileSync(path.join(__dirname, '../dist-electron/electron/minecraft/accounts.js'), 'utf8');
const uuid = 'c530ebe5e16c40000000000000000001';
function fixture() {
  let accounts = [], browser = 0, confirmed = 0, now = Date.now();
  let bound = false, failAuto = false, failPreview = false, cancel = false;
  class Window extends EventEmitter {
    constructor() { super(); this.webContents = new EventEmitter(); this.webContents.setWindowOpenHandler = () => {}; }
    isDestroyed() { return false; }
    close() { this.emit('closed'); }
    async loadURL(url) { queueMicrotask(() => this.webContents.emit('will-redirect', {preventDefault() {}}, 'https://test.invalid/callback?code=test&state=' + new URL(url).searchParams.get('state'))); }
  }
  class Auth { constructor() { this.token = {redirect:'https://test.invalid/callback'}; } createLink() { return 'https://test.invalid/auth'; } }
  const user = () => ({id:31, mc_nickname:bound?'GodotPlane':'Godot_Plane', twitch_login:'godot_plane', whitelist_status:'approved', mc_type:bound?'microsoft':'offline', mc_uuid:bound?uuid:undefined, mc_verified_at:bound?123:0});
  const mod = {exports:{}};
  vm.runInNewContext(source, {exports:mod.exports, module:mod, console, Buffer, URL, setTimeout, clearTimeout, queueMicrotask,
    Date:class extends Date {static now() {return now;}},
    require(id) {
      if(id==='electron') return {BrowserWindow:Window, dialog:{showMessageBox:async()=>({response:cancel?1:0})}};
      if(id==='msmc') return {Auth};
      if(id==='./account-store') return {readAccounts:async()=>structuredClone(accounts), updateAccounts:async change=>{const next=structuredClone(accounts);const result=change(next);accounts=next;return result;}};
      if(id==='./account-session') return {ensureMicrosoftAccount:async id=>structuredClone(accounts.find(a=>a.id===id))};
      if(id==='./microsoft-session') return {MicrosoftSessionError:class extends Error{}, microsoftFailure:e=>e, microsoftCodeSession:async()=>({profile:{id:uuid,name:'GodotPlane'},accessToken:'game-proof',refreshToken:'refresh',expiresAt:now+3600000})};
      if(id==='./community-browser') return {communityBrowserCode:async()=>{browser++;return 'auth-code';}};
      if(id==='./community-request') return {communityRequest:async(route,token,body)=>{
        if(route.endsWith('/exchange')) return {token:'community-session',user:user(),minecraft_link_grant:'grant-'+browser};
        if(route.endsWith('/auto-link')) {if(failAuto)throw Error('provider unavailable');bound=true;return {user:user()};}
        if(route.endsWith('/preview')) {assert.equal(token,'community-session');assert.equal(body.minecraft_access_token,'game-proof');assert.equal(body.code,'grant-'+browser);if(failPreview)throw Error('preview unavailable');return {candidate:{uuid,name:'GodotPlane'},code:'confirm-code'};}
        if(route.endsWith('/confirm')) {assert.equal(body.code,'confirm-code');confirmed++;bound=true;return {ok:true};}
        if(route.endsWith('/me')) return {user:user()};
        throw Error('Unexpected route '+route);
      }};
      return require(id);
    }
  });
  return {api:mod.exports, get accounts(){return accounts;},get browser(){return browser;}, get confirmed(){return confirmed;}, expire(){now+=9*60*1000;}, failAuto(value){failAuto=value;},failPreview(value){failPreview=value;},cancel(value){cancel=value;}, changeToken(){accounts.find(a=>a.type==='offline').communityToken='other-session';}};
}
function linked(f) {assert.equal(f.accounts.length,1);assert.equal(f.accounts[0].type,'microsoft');assert.equal(f.accounts[0].mcUuid,uuid);assert.equal(f.accounts[0].mcVerifiedAt,123);assert.equal(f.accounts[0].active,true);}
(async()=>{
  let f=fixture(); const ms=await f.api.loginMicrosoft(); assert.equal(f.browser,0); await f.api.loginCommunity(); await f.api.linkMinecraftAccount(ms.id); assert.equal(f.browser,1);assert.equal(f.confirmed,1);linked(f);
  f=fixture();await f.api.loginCommunity();await f.api.loginMicrosoft();assert.equal(f.browser,1);linked(f);
  f=fixture();f.failAuto(true);await f.api.loginCommunity();const retry=await f.api.loginMicrosoft();assert.equal(retry.mcVerifiedAt,0);assert.equal(f.accounts.length,2);await f.api.linkMinecraftAccount(retry.id);assert.equal(f.browser,1);linked(f);
  for(const invalidate of ['expire','changeToken']) {f=fixture();const ms=await f.api.loginMicrosoft();await f.api.loginCommunity();f[invalidate]();await f.api.linkMinecraftAccount(ms.id);assert.equal(f.browser,2);linked(f);}
  f=fixture();const cancelled=await f.api.loginMicrosoft();await f.api.loginCommunity();f.cancel(true);assert.equal(await f.api.linkMinecraftAccount(cancelled.id),null);assert.equal(f.confirmed,0);f.cancel(false);await f.api.linkMinecraftAccount(cancelled.id);assert.equal(f.browser,2);linked(f);
  f=fixture();const failed=await f.api.loginMicrosoft();await f.api.loginCommunity();f.failPreview(true);await assert.rejects(f.api.linkMinecraftAccount(failed.id),/preview unavailable/);f.failPreview(false);await f.api.linkMinecraftAccount(failed.id);assert.equal(f.browser,2);linked(f);
  console.log('PASS: both login orders, failed auto-link recovery, grant expiry/session binding, cancellation and retry after provider failure');
})().catch(error=>{console.error(error);process.exitCode=1;});

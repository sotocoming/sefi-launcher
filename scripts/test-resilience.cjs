const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '..');
const dependency = createRequire(process.argv[2] || process.env.SEFI_TEST_PACKAGE || path.join(root,'package.json'));
const ts = dependency('typescript');
const uuid='12345678123442348234123456789abc';
function loader(mocks) {
  const cache=new Map();
  function load(file) {
    file=path.resolve(file); if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    const code=ts.transpileModule(require('node:fs').readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    vm.runInNewContext(code,{module,exports:module.exports,require(name){
      if(Object.hasOwn(mocks,name))return mocks[name];
      if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name)+'.ts');
      return dependency(name);
    },Buffer,process,structuredClone,window:mocks.__window,console:{warn(){},log(){},error(){}},AbortController,AbortSignal,URL,URLSearchParams,setTimeout,clearTimeout});
    return module.exports;
  }
  return name=>load(path.join(root,'electron/minecraft',name+'.ts'));
}
async function filesAndAccounts() {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sefi-resilience-'));
  try {
    let blocked=0, renameCalls=0;
    const proxied=new Proxy(fs,{get(target,key){if(key==='rename')return async(...args)=>{renameCalls++;if(blocked-->0)throw Object.assign(new Error('locked'),{code:'EPERM'});return target.rename(...args)};return target[key]}});
    const electron={app:{getPath:()=>dir},safeStorage:{isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s.split('').reverse().join('')),decryptString:b=>b.toString().split('').reverse().join('')}};
    const load=loader({electron,'fs/promises':proxied,'timers/promises':{setTimeout:async()=>{}}});
    const atomic=load('atomic-files'),store=load('account-store');
    const source=path.join(dir,'source.jar'),dest=path.join(dir,'mods','skin.jar');
    await fs.writeFile(source,'current');await atomic.installFile(source,dest);const before=renameCalls;
    blocked=99;assert.equal(await atomic.installFile(source,dest),false);assert.equal(renameCalls,before);
    await fs.writeFile(source,'updated');blocked=2;await atomic.installFile(source,dest);assert.equal(await fs.readFile(dest,'utf8'),'updated');
    await fs.writeFile(source,'failed');blocked=99;await assert.rejects(atomic.installFile(source,dest),/Закройте/);assert.equal(await fs.readFile(dest,'utf8'),'updated');assert.deepEqual(await fs.readdir(path.dirname(dest)),['skin.jar']);blocked=0;
    const account={id:'ms',username:'Player',uuid,type:'microsoft',msRefreshToken:'secret-renewal',accessToken:'game',communityToken:'community-secret',active:true};
    await store.updateAccounts(a=>a.push(account));
    const encrypted=JSON.parse(await fs.readFile(path.join(dir,'accounts.json'),'utf8'))[0].msRefreshToken;
    const decrypt=electron.safeStorage.decryptString;
    electron.safeStorage.decryptString=()=>{throw new Error('Windows profile temporarily unavailable')};
    await store.updateAccounts(a=>a[0].username='Player');
    assert.equal(JSON.parse(await fs.readFile(path.join(dir,'accounts.json'),'utf8'))[0].msRefreshToken,encrypted);
    electron.safeStorage.decryptString=decrypt;
    await Promise.all(Array.from({length:20},(_,i)=>store.updateAccounts(a=>a.push({id:'offline-'+i,username:'Player'+i,uuid,type:'offline'}))));
    assert.equal((await store.readAccounts()).length,21);
    assert.equal((await store.readAccounts())[0].msRefreshToken,'secret-renewal');
    for(const suffix of ['', '.bak'])assert.ok(!(await fs.readFile(path.join(dir,'accounts.json'+suffix),'utf8')).includes('secret-renewal'));
    assert.equal(store.publicAccount(account).msRefreshToken,undefined);
    assert.equal(store.publicAccount(account).accessToken,'');
    assert.equal(store.publicAccount(account).communityToken,undefined);
    assert.equal(store.publicAccount(account).communityConnected,true);
    assert.equal(store.publicAccount({...account,communityToken:undefined}).communityConnected,false);
    await fs.writeFile(path.join(dir,'accounts.json'),'{broken');assert.equal((await store.readAccounts()).length,20);
    await store.updateAccounts(a=>a[0].active=false);assert.equal((await store.readAccounts()).length,20);
    await fs.writeFile(path.join(dir,'accounts.json'),'{broken');await fs.writeFile(path.join(dir,'accounts.json.bak'),'{broken');await assert.rejects(store.updateAccounts(a=>a.push(account)),/повреждён/);
    assert.equal(await fs.readFile(path.join(dir,'accounts.json'),'utf8'),'{broken');
  } finally {await fs.rm(dir,{recursive:true,force:true})}
}
async function microsoft() {
  for(const mode of ['success','transient','outage','revoked','wrong-profile']) {
    let rotationSaved=false, oauth=0, profile=0;
    const load=loader({electron:{net:{fetch:async(url,options)=>{
      assert.equal(options.redirect,'error');assert.ok(options.signal);
      let status=200,data;
      if(url.includes('oauth20_token')) {oauth++;assert.equal(new URLSearchParams(options.body).get('refresh_token'),'refresh-old');if(mode==='revoked'){status=400;data={error:'invalid_grant',error_description:'private-secret'}}else data={access_token:'private-ms',refresh_token:'refresh-new'};}
      else if(url.includes('user/authenticate')) {assert.ok(rotationSaved);if(mode==='outage')throw new Error('net::ERR_CONNECTION_RESET private-secret');data={Token:'xbox'};}
      else if(url.includes('xsts/authorize'))data={Token:'xsts',DisplayClaims:{xui:[{uhs:'hash'}]}};
      else if(url.includes('login_with_xbox'))data={access_token:'game-new',expires_in:86400};
      else {profile++;if(mode==='transient'&&profile===1)status=503;data={id:mode==='wrong-profile'?'invalid':uuid,name:'Player'};}
      return new Response(JSON.stringify(data),{status});
    }}},'timers/promises':{setTimeout:async()=>{}}});
    const session=load('microsoft-session');
    const task=session.renewMicrosoftSession('refresh-old','client',async key=>{assert.equal(key,'refresh-new');rotationSaved=true});
    if(['success','transient'].includes(mode)){const result=await task;assert.equal(result.profile.id,uuid);assert.ok(result.expiresAt>Date.now()+23*3600000);assert.equal(oauth,1);}
    else await assert.rejects(task,e=>!e.message.includes('private-secret')&&(mode!=='revoked'||e.kind==='auth'));
    assert.equal(rotationSaved,mode!=='revoked');
  }
}
async function renewal() {
  for(const mode of ['success','outage-valid','outage-expired','legacy','deleted','wrong-uuid','revoked-valid','check-valid']) {
    let account={id:'ms',type:'microsoft',uuid,username:'Old',accessToken:'old-game',msRefreshToken:mode==='legacy'?undefined:'old-refresh',msAccessTokenExpiresAt:Date.now()+(mode==='outage-expired'?-1000:600000),communityToken:'community',active:true};
    let calls=0;
    if(['revoked-valid','check-valid'].includes(mode))account.msAccessTokenExpiresAt=Date.now()+3600000;
    const SessionError=class extends Error{constructor(msg,kind){super(msg);this.kind=kind}};
    const load=loader({'./account-store':{readAccounts:async()=>account?[{...account}]:[],updateAccounts:async change=>{const a=account?[account]:[];return change(a)}},'./microsoft-session':{MicrosoftSessionError:SessionError,tokenExpiry:()=>undefined,validateMinecraftToken:async()=>{if(mode==='revoked-valid')throw Object.assign(new SessionError('revoked','auth'),{status:401});return {id:uuid,name:'Player'}},renewMicrosoftSession:async(_key,_id,save)=>{
      calls++;await save('new-refresh');await new Promise(r=>setTimeout(r,5));
      if(mode==='deleted')account=null;
      if(mode.startsWith('outage')||mode==='deleted')throw new SessionError('Unavailable','network');
      return {accessToken:'new-game',expiresAt:Date.now()+86400000,profile:{id:mode==='wrong-uuid'?'other':uuid,name:'New'}};
    }},msmc:{Auth:class{token={client_id:'client'}}}});
    const manager=load('account-session');
    const first=manager.ensureMicrosoftAccount('ms',true),second=manager.ensureMicrosoftAccount('ms',true);assert.equal(first,second);
    if(['outage-expired','deleted','wrong-uuid'].includes(mode))await assert.rejects(first);
    else {const result=await first;assert.equal(result.communityToken,'community');assert.equal(result.accessToken,['success','revoked-valid'].includes(mode)?'new-game':'old-game');}
    assert.equal(calls,['legacy','check-valid'].includes(mode)?0:1);
    if(account && !['legacy','check-valid'].includes(mode))assert.equal(account.msRefreshToken,'new-refresh');
  }
}
async function community() {
  for(const mode of ['transient','unauthorized','outage','post']) {
    let calls=0;
    const load=loader({electron:{net:{fetch:async()=>{calls++;if(mode==='outage')throw new Error('private-token');return new Response(JSON.stringify({user:{id:1}}),{status:mode==='unauthorized'?401:mode==='post'||(mode==='transient'&&calls===1)?503:200})}}},'timers/promises':{setTimeout:async()=>{}}});
    const request=load('community-request').communityRequest;
    if(mode==='transient'){assert.equal((await request('/api/public/community/me','secret')).user.id,1);assert.equal(calls,2)}
    else{await assert.rejects(request('/api/public/community/me','secret',mode==='post'?{}:undefined),e=>!e.message.includes('private-token'));assert.equal(calls,mode==='outage'?2:1)}
  }
}
async function configuration() {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sefi-config-'));
  const config={modpack:{name:'Pack',version:'1.3.7',minecraft:'1.20.1',loader:'fabric',loaderVersion:'0.18.4',curseforgeProjectId:1,curseforgeFileId:2,sha256:'a'.repeat(64)},server:{ip:'minecraft.example.com',port:25565},launcher:{title:'SEFI'},news:[]};
  try {
    let calls=0;
    const create=(offline=false,invalid=false)=>loader({electron:{app:{getPath:()=>dir},net:{fetch:async url=>{
      calls++;if(offline)throw new Error('Unavailable');
      return new Response(JSON.stringify(url.endsWith('/sites')?{}:invalid?{...config,modpack:{...config.modpack,minecraft:'1.21'}}:config));
    }}},'timers/promises':{setTimeout:async()=>{}}})('../config');
    const current=create();const values=await Promise.all([current.getLauncherConfig(),current.getLauncherConfig(),current.getLauncherConfig()]);assert.equal(calls,2);
    values[0].server.ip='changed';assert.equal((await current.getLauncherConfig()).server.ip,'minecraft.example.com');
    assert.equal((await create(true).getLauncherConfig()).modpack.version,'1.3.7');
    await assert.rejects(create(false,true).getLauncherConfig(),/обновления лаунчера/);
    await fs.writeFile(path.join(dir,'launcher-config-cache.json'),'{}');await assert.rejects(create(true).getLauncherConfig(),/настройки сборки/);
  } finally {await fs.rm(dir,{recursive:true,force:true})}
}
async function javaSelection() {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sefi-java-check-'));
  try {
    let calls=0;const execFile=()=>{};
    execFile[require('node:util').promisify.custom]=async()=>{calls++;return {stdout:'openjdk version "21.0.12"\nos.arch = amd64\nsun.arch.data.model = 64\n',stderr:''}};
    const load=loader({electron:{app:{getPath:()=>dir}},child_process:{execFile},'./download-http':{},'./modpack-download':{}});
    const java=load('java');
    const installer=path.join(dir,'jre-8u51-windows-x64.exe');await fs.writeFile(installer,'installer');
    await assert.rejects(java.inspectJava(installer),/установщик/);assert.equal(calls,0);
    const executable=path.join(dir,'java.exe');await fs.writeFile(executable,'runtime');assert.equal((await java.inspectJava(executable,4096)).version,'21.0.12');assert.equal(calls,1);
    await assert.rejects(java.inspectJava(executable,40000),/объём памяти/);assert.equal(calls,1);
  } finally {await fs.rm(dir,{recursive:true,force:true})}
}
async function gameFiles() {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sefi-game-files-'));
  try {
    const load=loader({});const servers=load('servers-dat'),windows=load('window-options');const nbt=dependency('prismarine-nbt');
    const initial={type:'compound',name:'',value:{custom:{type:'string',value:'keep'},servers:{type:'list',value:{type:'compound',value:[{name:{type:'string',value:'Personal'},ip:{type:'string',value:'other.example.com'},icon:{type:'string',value:'keep-icon'}}]}}}};
    const file=path.join(dir,'servers.dat');const original=nbt.writeUncompressed(initial);await fs.writeFile(file,original);
    await servers.ensureServersInServersDat(dir,[{id:'primary',name:'SEFI',ip:'minecraft.example.com'}]);
    const current=(await nbt.parse(await fs.readFile(file))).parsed;assert.equal(current.value.custom.value,'keep');assert.equal(current.value.servers.value.value[1].icon.value,'keep-icon');assert.ok((await fs.readFile(file+'.sefi-backup')).equals(original));
    const before=await fs.stat(file);await servers.ensureServersInServersDat(dir,[{id:'primary',name:'SEFI',ip:'minecraft.example.com'}]);assert.equal((await fs.stat(file)).mtimeMs,before.mtimeMs);
    await fs.writeFile(path.join(dir,'options.txt'),'music:0.4\nfullscreen:false\n');await windows.applyFullscreenSetting(dir,true);assert.equal(await fs.readFile(path.join(dir,'options.txt'),'utf8'),'music:0.4\nfullscreen:true\n');
    await fs.writeFile(file,'corrupt');await assert.rejects(servers.ensureServersInServersDat(dir,[{name:'SEFI',ip:'minecraft.example.com'}]),/Существующий файл сохранён/);assert.equal(await fs.readFile(file,'utf8'),'corrupt');
  } finally {await fs.rm(dir,{recursive:true,force:true})}
}
async function interfaceStartup() {
  const resolve=[];const delayed=()=>new Promise(r=>resolve.push(r));
  const account={id:'ms',username:'Player',uuid,type:'microsoft',active:true};
  const load=loader({__window:{electronAPI:{getAccounts:async()=>[account],getSettings:async()=>({ramMax:4096}),getLauncherConfig:delayed,getModpackStatus:delayed,getServerStatus:delayed}}});
  const store=load('../../src/store/store').useStore;const pending=store.getState().initStore();
  await new Promise(r=>setTimeout(r,0));assert.equal(store.getState().activeAccount.id,'ms');assert.equal(store.getState().settings.ramMax,4096);assert.equal(store.getState().launcherConfig,null);
  resolve.forEach(r=>r({news:[]}));await pending;assert.equal(store.getState().accounts.length,1);
}
async function removedCommunityAccount() {
  let finish;
  let accounts=[{id:'comm_1',username:'Player',uuid,type:'offline',communityToken:'key',active:true}];
  const load=loader({'./community-browser':{},'./microsoft-session':{},'./account-session':{},'./community-request':{communityRequest:()=>new Promise(resolve=>finish=resolve)},'./account-store':{readAccounts:async()=>accounts,updateAccounts:async change=>change(accounts)}});
  const api=load('accounts');
  const pending=api.refreshCommunityProfile('key');
  accounts=[];
  finish({user:{id:1,twitch_login:'Player',mc_type:'offline',mc_nickname:'Player',whitelist_status:'approved'}});
  assert.equal(await pending,null);assert.equal(accounts.length,0);
}

(async()=>{await removedCommunityAccount();await filesAndAccounts();await microsoft();await renewal();await community();await configuration();await javaSelection();await gameFiles();await interfaceStartup();console.log('PASS: atomic storage, concurrency, backup recovery, file locks, protected renewal keys, OAuth rotation, deduplicated refresh, UUID binding, legacy accounts, cached valid sessions, HTTP failure classification, configuration cache, Java installer rejection, game settings preservation, local accounts available during network outage');})().catch(e=>{console.error(e);process.exitCode=1});

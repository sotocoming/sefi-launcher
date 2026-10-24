const {chromium}=require('C:/Users/Creep/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const out=process.env.UI_EVIDENCE_DIR||path.join(os.tmpdir(),'sefi-update-states');
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>{const url=new URL(r.request().url());if(url.hostname!=='sefi.test')return r.abort();const file=path.join(__dirname,'../dist',url.pathname==='/'?'index.html':url.pathname);return r.fulfill({body:fs.readFileSync(file),contentType:({'.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2'})[path.extname(file)]||'text/html'});});
await page.addInitScript(()=>{window.calls={check:0,install:0};window.electronAPI=new Proxy({
getAccounts:async()=>[],getSettings:async()=>({ramMin:2048,ramMax:6144,javaPath:'',gameDirectory:'C:/Games/SEFI',fullscreen:false,closeOnLaunch:false}),
getLauncherConfig:async()=>({news:[],community_links:[],modpack:{name:'Homestead Cozy',version:'1.3.7'},server:{name:'Sweet Home',ip:'mc.sotocoming.ru',port:25565}}),
getServerStatus:async()=>({online:false,players:0,maxPlayers:20}),getModpackStatus:async()=>({installed:false}),getJavaStatus:async()=>({status:'ready',version:'21'}),getCommunitySkin:async()=>null,
onUpdateStatusChange:cb=>{window.pushUpdate=cb;return()=>{};},onGameStateChange:cb=>{window.pushGame=cb;return()=>{};},
getUpdateStatus:async()=>({status:'idle'}),checkForUpdates:async()=>{window.calls.check++;return {status:'idle',checkedAt:Date.now()};},
installUpdate:async()=>{window.calls.install++;throw Error('EPERM test');}
},{get:(o,k)=>k in o?o[k]:()=>()=>{}});});
await page.goto('http://sefi.test/');await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('button',{name:'Лаунчер',exact:true}).click();await page.evaluate(()=>document.fonts.ready);
const states=[
['unverified',null],['idle',{status:'idle',checkedAt:1}],['checking',{status:'checking'}],['available',{status:'available',version:'1.0.30'}],
['downloading',{status:'downloading',version:'1.0.30',percent:46,transferred:48234496,total:104857600}],
['ready',{status:'ready',version:'1.0.30'}],['installing',{status:'installing',version:'1.0.30'}],
...Object.entries({offline:'ENOTFOUND',timeout:'ETIMEDOUT',disk:'ENOSPC',permission:'EPERM',integrity:'sha512 checksum mismatch',check:'unexpected',download:'unexpected',install:'unexpected'}).map(([name,error])=>['error-'+name,{status:'error',phase:name==='install'?'install':name==='download'?'download':'check',canInstall:name==='install',error}]),
['preview',{status:'error',error:'Локальная тестовая сборка. Автообновления отключены.'}]];
for(const [name,info]of states){await page.evaluate(i=>window.pushUpdate(i),info);await page.waitForTimeout(300);assert.equal(await page.locator('.launcher-update-panel').getAttribute('data-update-state'),info?.status||'unverified');if(info&&info.status!=='idle'){const box=await page.locator('.launcher-update-indicator').boundingBox();assert.equal(box.width,204,name+' fixed width');assert.equal(box.height,24,name+' fixed height');}
await page.screenshot({path:path.join(out,'update-'+name+'.png')});}
await page.evaluate(()=>window.pushUpdate({status:'ready',version:'1.0.30'}));await page.evaluate(()=>window.pushGame({status:'running',pid:1}));
assert(await page.getByRole('button',{name:'Установить и перезапустить',exact:true}).isDisabled());await page.screenshot({path:path.join(out,'update-game-blocked.png')});
await page.evaluate(()=>window.pushGame({status:'idle'}));await page.getByRole('button',{name:'Установить и перезапустить',exact:true}).click();await page.getByRole('button',{name:'Повторить перезапуск',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.calls.install),1);assert(await page.getByRole('alert').textContent());
await page.evaluate(()=>window.pushUpdate({status:'error',phase:'check',error:'offline'}));await page.getByRole('button',{name:'Повторить проверку',exact:true}).click();await page.getByText('Установлена актуальная версия',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.calls.check),1);
for(const [value,want]of [[-20,0],[140,100],[NaN,0]]){await page.evaluate(v=>window.pushUpdate({status:'downloading',percent:v}),value);assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),String(want));}
await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);assert.equal(await page.locator('.update-particle').count(),0);
await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(100);assert(await page.locator('.update-particle').count()>0);
await page.getByRole('button',{name:'Игра',exact:true}).click();await page.getByRole('button',{name:/Загрузка ·/}).click();await page.waitForFunction(()=>document.querySelector('.settings-sections').dataset.tab==='launcher');
await page.setViewportSize({width:1100,height:680});await page.screenshot({path:path.join(out,'update-compact.png')});assert.equal(await page.locator('.settings-sections').evaluate(n=>n.scrollWidth-n.clientWidth),0);assert.deepEqual(errors,[]);
fs.writeFileSync(path.join(out,'update-results.json'),JSON.stringify({states:states.map(s=>s[0]),checks:['install rejection visible','game guard','retry','header navigation','NaN/range clamp','reduced motion','1100px no horizontal overflow'],errors},null,2));
console.log('PASS: updater states, recovery controls, game guard, reduced motion, progress bounds and header navigation');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

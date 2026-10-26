const {chromium}=require('C:/Users/Creep/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const out=process.env.UI_EVIDENCE_DIR||path.join(os.tmpdir(),'sefi-update-states');
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
const page=await browser.newPage({viewport:{width:1280,height:720},recordVideo:{dir:out,size:{width:1280,height:720}}}),errors=[];
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
await page.evaluate(()=>window.pushUpdate({status:'downloading',version:'1.0.30',percent:46,transferred:48234496,total:104857600}));await page.waitForTimeout(4000);const box=await page.locator('.launcher-update-indicator').boundingBox();await page.screenshot({path:path.join(out,'update-button-particles.png'),clip:{x:box.x-24,y:0,width:box.width+48,height:100}});await page.evaluate(()=>window.pushUpdate({status:'ready',version:'1.0.30'}));await page.waitForTimeout(4000);const video=page.video();await page.close();await video.saveAs(path.join(out,'update-motion.webm'));console.log('PASS: motion capture');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
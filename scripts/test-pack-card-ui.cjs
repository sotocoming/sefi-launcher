const {chromium}=require('C:/Users/Creep/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
const out=process.env.UI_EVIDENCE_DIR||path.join(os.tmpdir(),'sefi-play-states');
(async()=>{fs.mkdirSync(out,{recursive:true});const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
const page=await b.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='sefi.test')return r.abort();const f=path.join(__dirname,'../dist',u.pathname==='/'?'index.html':u.pathname);return r.fulfill({body:fs.readFileSync(f),contentType:({'.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2'})[path.extname(f)]||'text/html'});});
await page.addInitScript(()=>{
 window.launchCalls=0;window.accounts=sessionStorage.getItem('noaccount')?[]:[{id:'p',uuid:'offline',username:'Player',type:'offline',active:true,communityConnected:true,twitchLogin:'player',whitelistStatus:'approved'}];
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async s=>{if(window.failCopy)throw Error('denied');window.copied=s;}}});
 window.electronAPI=new Proxy({
 getAccounts:async()=>window.accounts,getSettings:async()=>{if(sessionStorage.getItem('brokenSettings')&&!window.repairSettings)throw Error('EACCES reading settings');return {ramMin:2048,ramMax:6144,javaPath:'',gameDirectory:'C:/Games/SEFI',fullscreen:false,closeOnLaunch:false,autoConnect:false};},
 getLauncherConfig:async()=>({news:[{id:'test',title:'Осень — время обустраивать свой мир',date:'2026-10-17'}],community_links:[],modpack:{name:sessionStorage.getItem('packName')||'Homestead Cozy',version:'1.3.7'},server:{name:'Sweet Home',ip:'mc.sotocoming.ru',port:25565}}),
 getServerStatus:async()=>({online:true,players:7,maxPlayers:20,pingMs:35}),getModpackStatus:async()=>sessionStorage.getItem('packFixture')?JSON.parse(sessionStorage.getItem('packFixture')):({currentVersion:'1.3.7',latestVersion:'1.3.7',updateAvailable:false}),getJavaStatus:async()=>({status:'ready',version:'21'}),getCommunitySkin:async()=>null,
 onGameStateChange:cb=>{window.pushGame=cb;return()=>{};},onUpdateStatusChange:cb=>{window.pushUpdate=cb;return()=>{};},
 launchGame:()=>{window.launchCalls++;return new Promise((resolve,reject)=>{window.rejectLaunch=reject;window.finishLaunch=()=>{window.pushGame({status:'running',pid:1});resolve();};});}
 },{get:(o,k)=>k in o?o[k]:()=>()=>{}});
});
await page.goto('http://sefi.test/');await page.getByRole('button',{name:/^Играть/}).waitFor();await page.evaluate(()=>document.fonts.ready);
await page.route('**/variant-house.png',r=>r.fulfill({body:fs.readFileSync(path.join(__dirname,'../src/assets/icons/homestead-modpack-icon.png')),contentType:'image/png'}));
for(const [w,h] of [[1280,720],[1100,680]]){
 await page.setViewportSize({width:w,height:h});await page.getByText('Готово к запуску',{exact:true}).waitFor();await page.waitForTimeout(250);
 const align=await page.evaluate(()=>{const a=document.querySelector('.server-auto').getBoundingClientRect(),b=document.querySelector('.pack-status').getBoundingClientRect();return {top:Math.abs(a.top-b.top),bottom:Math.abs(a.bottom-b.bottom),overflow:document.querySelector('.pack-panel').scrollWidth-document.querySelector('.pack-panel').clientWidth};});assert(align.top<1&&align.bottom<1,'shared footer alignment');assert(align.overflow<=1);
 await page.screenshot({path:path.join(out,'home-no-art-'+w+'.png')});await page.locator('.launcher-overview').screenshot({path:path.join(out,'console-no-art-'+w+'.png')});
 await page.evaluate(()=>{const img=document.createElement('img');img.className='pack-study-art';img.src='/variant-house.png';img.alt='';img.style.cssText='position:absolute;width:180px;max-width:none;right:-14px;top:24px;opacity:.16;z-index:-1;pointer-events:none;mask-image:linear-gradient(90deg,transparent,black 75%)';document.querySelector('.pack-panel').appendChild(img);});
 await page.locator('.pack-study-art').evaluate(n=>n.decode());await page.screenshot({path:path.join(out,'home-quiet-art-'+w+'.png')});await page.locator('.launcher-overview').screenshot({path:path.join(out,'console-quiet-art-'+w+'.png')});await page.locator('.pack-study-art').evaluate(n=>n.remove());
}
for(const [key,status,text]of [['checking',null,'Проверка…'],['missing',{latestVersion:'1.3.7'},'Нужна установка'],['update',{currentVersion:'1.3.6',latestVersion:'1.3.7',updateAvailable:true},'Есть обновление'],['ready',{currentVersion:'1.3.7',latestVersion:'1.3.7',updateAvailable:false},'Готово к запуску']]){
 await page.evaluate(s=>sessionStorage.setItem('packFixture',JSON.stringify(s)),status);await page.reload();await page.locator('.pack-status').getByText(text,{exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);await page.locator('.launcher-overview').screenshot({path:path.join(out,'pack-state-'+key+'.png')});
}
await page.evaluate(()=>sessionStorage.setItem('packName','Homestead Cozy — очень длинное название игровой сборки'));await page.reload();await page.getByRole('heading',{name:/Homestead Cozy —/}).waitFor();assert.equal(await page.locator('.pack-panel').evaluate(n=>n.scrollWidth-n.clientWidth),0);await page.screenshot({path:path.join(out,'pack-long-name.png')});
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'pack-results.json'),JSON.stringify({states:['checking','missing','update','ready'],widths:[1280,1100],footerAligned:true,overflow:false,errors},null,2));
console.log('PASS: pack4states, long name,2viewports, footer alignment, original-art comparison and no renderer errors');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

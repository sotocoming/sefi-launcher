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
 getLauncherConfig:async()=>({news:[{id:'test',title:'Осень — время обустраивать свой мир',date:'2026-10-17'}],community_links:[],modpack:{name:'Homestead Cozy',version:'1.3.7'},server:{name:'Sweet Home',ip:'mc.sotocoming.ru',port:25565}}),
 getServerStatus:async()=>({online:true,players:7,maxPlayers:20,pingMs:35}),getModpackStatus:async()=>({currentVersion:'1.3.7',latestVersion:'1.3.7',updateAvailable:false}),getJavaStatus:async()=>({status:'ready',version:'21'}),getCommunitySkin:async()=>null,
 onGameStateChange:cb=>{window.pushGame=cb;return()=>{};},onUpdateStatusChange:cb=>{window.pushUpdate=cb;return()=>{};},
 launchGame:()=>{window.launchCalls++;return new Promise((resolve,reject)=>{window.rejectLaunch=reject;window.finishLaunch=()=>{window.pushGame({status:'running',pid:1});resolve();};});}
 },{get:(o,k)=>k in o?o[k]:()=>()=>{}});
});
await page.goto('http://sefi.test/');await page.getByRole('button',{name:/^Играть/}).waitFor();await page.evaluate(()=>document.fonts.ready);
const cases=[
['network','ENOTFOUND cdn.example'],['timeout','ETIMEDOUT'],['service','Сервис SEFI временно недоступен (HTTP 503).'],
['rate-limit','HTTP 429'],['disk','ENOSPC'],['permission','EACCES'],['memory','OutOfMemoryError: Java heap space'],
['java','Для этой сборки нужна Java 21.'],['directory','Диск недоступен. Папка игры не существует.'],
['account','Сессия SEFI отозвана. Войдите заново.'],['integrity','Сборка не совпадает с контрольной суммой сервера.'],
['download','Источник Java ответил HTTP 404.'],['launcher','В установке лаунчера отсутствует SEFI Auth.'],
['server','Выбранный адрес сервера больше недоступен.'],['crash','Minecraft завершился с ошибкой (код 1). Exception at startup'],
['unknown','Unexpected startup error']];
for(const [w,h]of [[1280,720],[1100,680]]){await page.setViewportSize({width:w,height:h});for(const [kind,message]of cases){
 await page.evaluate(message=>window.pushGame({status:'error',message}),message);
 await page.locator('[data-launch-error="'+kind+'"]').waitFor();
 const bounds=await page.locator('.launch-failure').boundingBox();assert(bounds.y>=180&&bounds.y+bounds.height<=h,kind+' visible at '+w);
 const scroll=await page.locator('.original-console').evaluate(n=>({x:n.scrollWidth-n.clientWidth,y:n.scrollHeight-n.clientHeight}));assert(scroll.x<=1,kind+' x overflow');assert(scroll.y<=1,kind+' unnecessary scroll');
 await page.screenshot({path:path.join(out,'play-'+kind+'-'+w+'.png')});
}}
await page.evaluate(()=>window.pushGame({status:'error',message:'Minecraft завершился с ошибкой (код 1).\nAuthorization: Bearer secretJWT\n--accessToken gameSecret\n'+('stack trace line\n'.repeat(100))}));
await page.getByText('Подробности',{exact:true}).click();await page.waitForTimeout(100);const detailsBox=await page.locator('.launch-diagnostics-body').boundingBox();assert(detailsBox.y+detailsBox.height<=680,'diagnostics visible after expansion');await page.screenshot({path:path.join(out,'play-diagnostics.png')});
await page.getByRole('button',{name:'Скопировать ошибку',exact:true}).click();await page.getByText('Подробности скопированы.',{exact:true}).waitFor();assert(!(await page.evaluate(()=>window.copied)).includes('secretJWT'));assert(!(await page.evaluate(()=>window.copied)).includes('gameSecret'));
await page.evaluate(()=>window.failCopy=true);await page.getByRole('button',{name:'Скопировано',exact:true}).click();await page.getByText(/Не удалось скопировать/).waitFor();await page.screenshot({path:path.join(out,'play-copy-denied.png')});
for(const [message,tab]of [['OutOfMemoryError','game'],['Для этой сборки нужна Java 21.','java'],['В установке лаунчера отсутствует SEFI Auth.','launcher']]){
 await page.evaluate(message=>window.pushGame({status:'error',message}),message);
 await page.locator('.launch-recover').click();await page.waitForFunction(tab=>document.querySelector('.settings-sections')?.dataset.tab===tab,tab);
 await page.getByRole('button',{name:'Главная',exact:true}).click();await page.locator('.home-scene').waitFor();
}
await page.evaluate(()=>window.pushGame({status:'error',message:'Сессия SEFI отозвана.'}));await page.locator('.launch-recover').click();await page.getByRole('heading',{name:/Твой профиль/}).waitFor();await page.getByRole('button',{name:'Главная',exact:true}).click();
await page.evaluate(()=>window.pushGame({status:'error',message:'Выбранный адрес сервера больше недоступен.'}));await page.locator('.launch-recover').click();assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('role')),'radio');
await page.evaluate(()=>window.pushGame({status:'idle'}));await page.locator('.play').waitFor();await page.evaluate(()=>{const button=document.querySelector('.play');button.click();button.click();});await page.waitForFunction(()=>window.launchCalls===1);await page.getByText('Проверяем игру',{exact:true}).waitFor();
assert.equal(await page.getByRole('progressbar').count(),0);await page.screenshot({path:path.join(out,'play-checking.png')});
await page.evaluate(()=>window.rejectLaunch(Error("Error invoking remote method 'launch-game': Error: ENOSPC")));await page.locator('[data-launch-error="disk"]').waitFor();
await page.getByRole('button',{name:'Повторить запуск',exact:true}).click();await page.waitForFunction(()=>window.launchCalls===2);await page.evaluate(()=>window.finishLaunch());await page.getByRole('button',{name:/^В игре/}).waitFor();assert(await page.getByRole('button',{name:/^В игре/}).isDisabled());await page.screenshot({path:path.join(out,'play-running.png')});
for(const [name,state]of [['downloading',{status:'downloading',progress:{stage:'java',task:'Загружаем Java 21',percentage:46,downloaded:46,total:100,speed:2300000}}],['extracting',{status:'extracting'}],['launching',{status:'launching'}]]){
 await page.evaluate(state=>window.pushGame(state),state);await page.screenshot({path:path.join(out,'play-'+name+'.png')});
}
for(const [percent,want]of [[NaN,0],[-10,0],[150,100]]){await page.evaluate(p=>window.pushGame({status:'downloading',progress:{stage:'assets',task:'Файлы Minecraft',percentage:p,total:100,downloaded:0}}),percent);assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),String(want));}
await page.evaluate(()=>sessionStorage.setItem('noaccount','1'));await page.reload();const choose=page.getByRole('button',{name:/^Выберите аккаунт/});assert(await choose.isEnabled());await choose.click();await page.getByRole('heading',{name:/Твой профиль/}).waitFor();
await page.evaluate(()=>{sessionStorage.removeItem('noaccount');sessionStorage.setItem('brokenSettings','1');});await page.reload();await page.locator('[data-launch-error="configuration"]').waitFor();await page.screenshot({path:path.join(out,'play-configuration.png')});await page.evaluate(()=>window.repairSettings=true);await page.getByRole('button',{name:'Повторить проверку',exact:true}).click();await page.getByRole('button',{name:/^Играть/}).waitFor();
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'play-results.json'),JSON.stringify({errorCategories:cases.map(c=>c[0]),viewports:[1280,1100],errors,checks:['recovery navigation','retry after native IPC rejection','double click guard','running disabled','progress bounds','clipboard success/failure and redaction','no account CTA','settings read recovery']},null,2));
console.log('PASS: '+cases.length+' launch errors at2sizes, recovery navigation, duplicate guard, progress, clipboard and missing account/settings');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

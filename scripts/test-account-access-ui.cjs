const {chromium}=require(process.env.SEFI_PLAYWRIGHT || 'C:/Users/Creep/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.SEFI_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1100,height:720}});
  await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='sefi.test')return route.abort();const file=path.join(__dirname,'../dist',url.pathname==='/'?'index.html':url.pathname);await route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});});
  await page.addInitScript(()=>{
   window.launches=0;window.failRefresh=false;window.linkCalls=0;
   const ms={id:'ms',uuid:'12345678123412341234123456781234',username:'GodotPlane',type:'microsoft',active:true};
   const mode=sessionStorage.getItem('fixtureMode');
   if(mode)Object.assign(ms,{communityConnected:true,twitchLogin:'godot_plane'});
   if(mode==='linked')Object.assign(ms,{mcType:'microsoft',mcVerifiedAt:123,mcUuid:ms.uuid});
   window.accounts=[ms];
   window.electronAPI=new Proxy({
    getAccounts:async()=>{if(window.failRefresh)throw Error('Список временно недоступен');return window.accounts;},
    getCommunitySkin:async()=>null,
    getSettings:async()=>({ramMax:4096}),getModpackStatus:async()=>({installed:true}),getServerStatus:async()=>({online:true}),getLauncherConfig:async()=>({server:{ip:'test.invalid',port:25565},news:[]}),
    launchGame:async()=>{window.launches++;},
    linkMinecraftAccount:async()=>{window.linkCalls++;window.failRefresh=true;throw Error('Привязка не завершена');},
    loginCommunity:async()=>{const comm={id:'comm',uuid:'offline',username:'Godot_Plane',type:'offline',active:true,communityConnected:true,twitchLogin:'godot_plane',whitelistStatus:'approved'};ms.active=false;window.accounts=[ms,comm];return comm;},
   },{get:(target,key)=>key in target?target[key]:()=>()=>{}});
  });
  await page.goto('http://sefi.test/');
  const play=page.getByRole('button',{name:/^ИГРАТЬ/});
  await play.click();const dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await page.evaluate(()=>window.launches),0);assert.match(await dialog.innerText(),/Вы не вошли в Twitch/);
  await dialog.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(await page.evaluate(()=>window.launches),0);
  await play.click();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await play.click();await dialog.getByRole('button',{name:'Всё равно запустить',exact:true}).click();await page.waitForFunction(()=>window.launches===1);
  await play.click();await dialog.getByRole('button',{name:'Аккаунты',exact:true}).click();await page.getByRole('heading',{name:/Профиль игрока/}).waitFor();assert.equal(await page.evaluate(()=>window.launches),1);
  await page.getByRole('button',{name:'Войти через сайт',exact:true}).click();const link=page.getByRole('button',{name:'Привязать к Twitch',exact:true});await link.click();await link.waitFor();assert.equal(await link.isEnabled(),true);await page.getByText(/Список временно недоступен/).waitFor();assert.equal(await page.evaluate(()=>window.linkCalls),1);
  await page.evaluate(()=>window.failRefresh=false);await link.click();await link.waitFor();assert.equal(await link.isEnabled(),true);assert.equal(await page.evaluate(()=>window.linkCalls),2);
  await page.screenshot({path:path.join(__dirname,'../../account-refresh-error.png')});
  await page.evaluate(()=>sessionStorage.setItem('fixtureMode','unlinked'));await page.reload();await play.click();await dialog.waitFor();assert.match(await dialog.innerText(),/ещё не связали/);await page.screenshot({path:path.join(__dirname,'../../unlinked-warning.png')});await dialog.getByRole('button',{name:'Отмена',exact:true}).click();
  await page.evaluate(()=>sessionStorage.setItem('fixtureMode','linked'));await page.reload();await play.click();await page.waitForFunction(()=>window.launches===1);assert.equal(await dialog.isVisible(),false);
  console.log('PASS: missing Twitch and unlinked license warnings, accounts navigation, explicit launch, Escape/cancel, linked launch, failed refresh clears linking and allows retry');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

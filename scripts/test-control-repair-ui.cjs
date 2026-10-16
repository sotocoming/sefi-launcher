const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Creep/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1200,height:850}});page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.hostname!=='sefi.test')return route.abort();
   const file=path.join(__dirname,'../dist',url.pathname==='/'?'index.html':url.pathname);
   await route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
  });
  await page.addInitScript(()=>{
   window.resourceRepairCalls=0;window.repairCalls=0;window.repairMode='changed';window.gameListeners=[];
   window.electronAPI=new Proxy({
    getAccounts:async()=>[],getSettings:async()=>({ramMin:2048,ramMax:4096,gameDirectory:'C:/fixture/game',javaPath:'',fullscreen:false,closeOnLaunch:false,windowWidth:854,windowHeight:480}),
    getLauncherConfig:async()=>({news:[],community_links:[],modpack:{name:'Homestead',version:'1.3.7'},server:{ip:'fixture',port:25565}}),
    getModpackStatus:async()=>({installed:true,updateAvailable:false}),getServerStatus:async()=>({online:false,players:0,maxPlayers:20}),getJavaStatus:async()=>({status:'ready',source:'managed',version:'21'}),
    onGameStateChange:callback=>{window.gameListeners.push(callback);return()=>{};},
    repairResourcePacks:async()=>{window.resourceRepairCalls++;return {changed:1};},
    repairClickBindings:async()=>{window.repairCalls++;if(window.repairMode==='error')throw Error('Закройте Minecraft перед исправлением.');return {changed:window.repairMode==='changed'?5:0};},
   },{get:(object,key)=>key in object?object[key]:()=>()=>{}});
  });
  await page.goto('http://sefi.test/');await page.getByRole('button',{name:'Настройки',exact:true}).click();
  const button=page.getByRole('button',{name:'Исправить Shift/Ctrl + ЛКМ',exact:true});await button.scrollIntoViewIfNeeded();
  assert.equal(await button.isEnabled(),true);await button.click();await page.getByRole('status').filter({hasText:'Конфликтующие сочетания JEI отключены'}).waitFor();
  await page.screenshot({path:path.join(__dirname,'../../settings-click-fix.png')});
  await page.getByRole('button',{name:'Вернуть интерфейс сборки',exact:true}).click();await page.getByRole('status').filter({hasText:'Интерфейс Homestead включён'}).waitFor();assert.equal(await page.evaluate(()=>window.resourceRepairCalls),1);
  await page.evaluate(()=>window.repairMode='fixed');await button.click();await page.getByRole('status').filter({hasText:'Исправление уже применено'}).waitFor();
  await page.evaluate(()=>window.repairMode='error');await button.click();await page.getByRole('alert').filter({hasText:'Закройте Minecraft'}).waitFor();
  await page.evaluate(()=>window.gameListeners.forEach(callback=>callback({status:'running',pid:123})));await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Исправить Shift/Ctrl + ЛКМ')?.disabled);
  assert.equal(await page.getByRole('button',{name:'Вернуть интерфейс сборки',exact:true}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.repairCalls),3);assert.deepEqual(errors,[]);
  console.log('PASS: settings button, success, already fixed, error and disabled during Minecraft');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

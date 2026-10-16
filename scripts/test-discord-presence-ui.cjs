const {chromium}=require('C:/Users/Creep/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1100,height:850}});
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.hostname!=='sefi.test')return route.abort();
   const file=path.join(__dirname,'../dist',url.pathname==='/'?'index.html':url.pathname);
   await route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
  });
  await page.addInitScript(()=>{
   let settings={ramMin:2048,ramMax:4096,javaPath:'',gameDirectory:'D:/SEFI Minecraft',fullscreen:false,closeOnLaunch:false,windowWidth:854,windowHeight:480};
   window.savedSettings=[];
   window.electronAPI=new Proxy({getAccounts:async()=>[],getSettings:async()=>settings,getLauncherConfig:async()=>({server:{name:'Sweet Home'},news:[]}),getServerStatus:async()=>({online:false,players:0,maxPlayers:20}),getModpackStatus:async()=>({installed:false}),getJavaStatus:async()=>({status:'ready',source:'managed',message:'Java готова'}),
    saveSettings:async value=>{settings=value;window.savedSettings.push(value);},
   },{get:(o,k)=>k in o?o[k]:()=>()=>{}});
  });
  await page.goto('http://sefi.test/');await page.getByRole('button',{name:'Настройки',exact:true}).click();
  const toggle=page.getByRole('switch',{name:'Показывать игру в Discord'});await toggle.scrollIntoViewIfNeeded();
  assert.equal(await toggle.getAttribute('aria-checked'),'true');
  await toggle.click();await page.waitForFunction(()=>window.savedSettings.length===1);
  assert.equal(await toggle.getAttribute('aria-checked'),'false');
  assert.equal(await page.evaluate(()=>window.savedSettings[0].discordPresence),false);
  await toggle.click();await page.waitForFunction(()=>window.savedSettings.length===2);
  assert.equal(await toggle.getAttribute('aria-checked'),'true');
  assert.equal(await page.evaluate(()=>window.savedSettings[1].discordPresence),true);
  assert.equal(await page.evaluate(()=>window.savedSettings[1].gameDirectory),'D:/SEFI Minecraft');
  await page.screenshot({path:path.join(__dirname,'../design/discord-settings.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log('PASS: Discord toggle defaults on for existing settings, saves off/on without changing game directory, accessible state and 1100px layout.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

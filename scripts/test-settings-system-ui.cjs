const {chromium}=require('C:/Users/Creep/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const out=process.env.UI_EVIDENCE_DIR||path.join(os.tmpdir(),'sefi-settings-system');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname!=='sefi.test')return route.abort();
   const file=path.join(__dirname,'../dist',url.pathname==='/'?'index.html':url.pathname);
   const mime={'.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2'};
   return route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'text/html'});
  });
  await page.addInitScript(()=>{
   let settings={ramMin:2048,ramMax:6144,javaPath:'',gameDirectory:'C:/Games/SEFI',fullscreen:false,closeOnLaunch:false,windowWidth:854,windowHeight:480};
   window.settingsSaved=[];
   window.electronAPI=new Proxy({
    getAccounts:async()=>[],getSettings:async()=>settings,saveSettings:async s=>{settings=s;window.settingsSaved.push(s);},
    getLauncherConfig:async()=>({news:[],community_links:[],modpack:{name:'Homestead Cozy',version:'1.3.7'},server:{name:'Sweet Home',ip:'mc.sotocoming.ru',port:25565}}),
    getServerStatus:async()=>({online:false,players:0,maxPlayers:20}),getModpackStatus:async()=>({installed:false}),
    getJavaStatus:async()=>({status:'ready',version:'21',path:'C:/SEFI/java/bin/java.exe',message:'Java готова к запуску'}),
    getCommunitySkin:async()=>null,checkForUpdates:async()=>({status:'idle'})
   },{get:(o,k)=>k in o?o[k]:()=>()=>{}});
  });
  await page.goto('http://sefi.test/');
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  const titleStyles=[];
  for(const [width,height]of [[1280,720],[1100,680]]){
   await page.setViewportSize({width,height});
   for(const [label,slug]of [['Игра','game'],['Java и файлы','java'],['Сборка','pack'],['Лаунчер','launcher']]){
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.waitForFunction(tab=>document.querySelector('.settings-sections').dataset.tab===tab,slug);
    await page.evaluate(()=>document.fonts.ready);
    const frame=await page.locator('.settings-sections').evaluate(n=>({x:n.scrollWidth-n.clientWidth,y:n.scrollHeight-n.clientHeight}));
    assert.deepEqual(frame,{x:0,y:0},label+' at '+width);
    titleStyles.push(...await page.locator('.settings-tab:visible .setting-row-title').evaluateAll(ns=>ns.map(n=>{const s=getComputedStyle(n);return [s.fontFamily,s.fontSize,s.lineHeight,s.fontWeight].join('|');})));
    const controls=await page.locator('.settings-tab:visible .setting-row-main').evaluateAll(ns=>ns.filter(n=>n.querySelector('.setting-row-control')).map(n=>{const title=n.querySelector('.setting-row-title').getBoundingClientRect(),control=n.querySelector('.setting-row-control').getBoundingClientRect();return Math.abs(title.y+title.height/2-control.y-control.height/2);}));
    assert(controls.every(offset=>offset<1),label+' control baseline');
    const linked=await page.getByRole('switch').evaluateAll(ns=>ns.every(n=>['true','false'].includes(n.getAttribute('aria-checked'))&&(n.getAttribute('aria-describedby')||'').split(' ').filter(Boolean).every(id=>document.getElementById(id))));
    assert(linked,label+' switch state/description');
    await page.screenshot({path:path.join(out,slug+'-'+width+'.png')});
   }
  }
  assert.equal(new Set(titleStyles).size,1,'same-role titles must remain consistent across categories and widths');
  await page.getByRole('button',{name:'Игра',exact:true}).click();
  const memory=page.getByRole('slider',{name:'Выделенная оперативная память'});
  await memory.focus();await memory.press('ArrowRight');await page.waitForFunction(()=>window.settingsSaved.length>0);
  assert.equal(await page.evaluate(()=>window.settingsSaved.at(-1).ramMax),7168);
  await page.getByRole('switch',{name:'Полноэкранный режим по умолчанию'}).click();
  await page.waitForFunction(()=>window.settingsSaved.at(-1).fullscreen===true);
  await page.getByRole('button',{name:'Лаунчер',exact:true}).click();
  await page.getByRole('switch',{name:'Скрывать лаунчер на время игры'}).click();
  await page.waitForFunction(()=>window.settingsSaved.at(-1).closeOnLaunch===true);
  const discord=page.getByRole('switch',{name:'Показывать игру в Discord'});
  assert.equal(await discord.getAttribute('aria-checked'),'true');
  await discord.click();await page.waitForFunction(()=>window.settingsSaved.at(-1).discordPresence===false);
  assert.equal(await page.evaluate(()=>window.settingsSaved.at(-1).ramMax),7168);
  assert.deepEqual(errors,[]);
  console.log('PASS: all4categories at1280/1100, shared typography/control baselines, ARIA descriptions, RAM keyboard save, fullscreen/hide/Discord persistence.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

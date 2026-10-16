const {_electron}=require('C:/Users/Creep/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(root,'design','skins-app-'));
 fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({discordPresence:false}));
 fs.writeFileSync(path.join(profile,'accounts.json'),JSON.stringify([{id:'fixture',username:'SEFI_Player',uuid:'00000000-0000-3000-8000-000000000001',type:'offline',communityToken:'local-fixture',active:true}]));
 let app;
 try{
  app=await _electron.launch({executablePath:path.join(root,'release-skins-preview/win-unpacked/SEFI Launcher.exe'),args:['--user-data-dir='+profile],timeout:20000});
  console.log('Connected to packaged Electron');
  await app.evaluate(({dialog,shell,net},fixture)=>{
   const errors=[];
   dialog.showErrorBox=(title,message)=>{errors.push({title,message});process.getBuiltinModule('fs').writeFileSync(fixture+'.errors.json',JSON.stringify(errors));};

   dialog.showOpenDialog=async()=>({canceled:false,filePaths:[fixture]});
   let skin=null;
   net.fetch=async(url,options={})=>{
    let data={};
    if(String(url).endsWith('/community/skin')){
     if(options.body){const body=JSON.parse(options.body);skin=body.reset?null:{png:body.png,model:body.model,sha256:'a'.repeat(64)};}
     data={skin};
    } else if(String(url).endsWith('/community/me')) data={user:{id:7,mc_nickname:'SEFI_Player',mc_type:'offline',whitelist_status:'approved',twitch_login:'sefi_player'}};
    else if(String(url).endsWith('/api/launcher/config')) data={modpack:{name:'Fixture',version:'1',minecraft:'1.20.1',loader:'fabric',loaderVersion:'0.18.4'},server:{ip:'127.0.0.1',port:25565},launcher:{title:'SEFI'},news:[]};
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
   };
  },path.join(root,'design/packaged-skin-fixture.png'));
  console.log('Installed isolated API fixture');
  const page=await app.firstWindow();page.setDefaultTimeout(15000);
  await page.waitForLoadState('load');
  await page.locator('#root > *').first().waitFor();
  console.log('Renderer loaded and rendered');
  const draft=await page.evaluate(()=>window.electronAPI.chooseSkin());
  assert.equal(draft.filename,'packaged-skin-fixture.png');assert(draft.png.startsWith('iVBORw0KGgo'));
  const skin=await page.evaluate(async png=>{
    await window.electronAPI.saveCommunitySkin('fixture',png,'slim');
    return window.electronAPI.getCommunitySkin('fixture');
  },draft.png);
  assert.equal(skin.model,'slim');
  await page.evaluate(()=>window.electronAPI.resetCommunitySkin('fixture'));
  assert.equal(await page.evaluate(()=>window.electronAPI.getCommunitySkin('fixture')),null);
  const jar=path.join(root,'release-skins-preview/win-unpacked/resources/resources/mods/sefi-skins-1.3.0.jar');
  assert.deepEqual(fs.readFileSync(jar),fs.readFileSync(path.join(root,'resources/mods/sefi-skins-1.3.0.jar')));
  const asar=require('@electron/asar');
  const archive=path.join(root,'release-skins-preview/win-unpacked/resources/app.asar');
  const discord=JSON.parse(asar.extractFile(archive,path.join('dist-electron','electron','discord-presence-config.json')).toString());
  assert.equal(discord.applicationId,'1560635017212854363');assert.equal(discord.imageKey,'sweet_home');
  assert.equal(discord.imageUrl,require('../electron/discord-presence-config.json').imageUrl);
  assert.deepEqual(fs.readFileSync(path.join(root,'release-skins-preview/win-unpacked/resources/resources/discord/sweet-home.png')),
    fs.readFileSync(path.join(root,'resources/discord/sweet-home.png')));
  console.log('PASS: packaged Electron app; real preload/IPC, HD PNG save/reset, bundled mod 1.3.0, Sweet Home application ID and original icon.');
 }finally{if(app){ await Promise.race([app.close(),new Promise(r=>setTimeout(r,3000))]); const child=app.process(); if(child.exitCode===null)child.kill(); }}
 assert.equal(fs.existsSync(path.join(root,'design/packaged-skin-fixture.png.errors.json')),false,'No interface error should be shown during load or close');
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});

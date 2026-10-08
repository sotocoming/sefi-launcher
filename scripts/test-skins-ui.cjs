const {chromium}=require('C:/Users/Creep/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
function crc32(buf){let c=-1;for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^-1)>>>0;}
function png(){
 const pixels=Buffer.alloc(64*(64*4+1));
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  let color=y<16?[216,168,128,255]:y<32?[50,160,180,255]:[36,51,88,255];
  if(y>=32&&(x<16||y<48))color=[0,0,0,0];
  if(y<16&&x>=32)color=[0,0,0,0];
  if(y<8)color=[45,28,28,255];
  if(y>=10&&y<12&&((x>=9&&x<11)||(x>=13&&x<15)))color=[25,36,60,255];
  const at=y*257+1+x*4;color.forEach((n,i)=>pixels[at+i]=n);
 }
 function chunk(type,data){let size=Buffer.alloc(4);size.writeUInt32BE(data.length);const kind=Buffer.from(type),crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([kind,data])));return Buffer.concat([size,kind,data,crc]);}
 const head=Buffer.alloc(13);head.writeUInt32BE(64);head.writeUInt32BE(64,4);head[8]=8;head[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
async function difference(page,a,b){
 return page.evaluate(async frames=>{
  const pixels=await Promise.all(frames.map(async value=>{
   const image=new Image();image.src='data:image/png;base64,'+value;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const context=canvas.getContext('2d');context.drawImage(image,0,0);return context.getImageData(0,0,canvas.width,canvas.height).data;
  }));
  let delta=0;for(let i=0;i<pixels[0].length;i++)delta+=Math.abs(pixels[0][i]-pixels[1][i]);
  return delta/(pixels[0].length*255);
 },[a.toString('base64'),b.toString('base64')]);
}
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const modes=['offline','saved','microsoft','bound','guest','unavailable','no_webgl'];
  for(const mode of modes.filter(mode=>!process.env.SEFI_SKIN_UI_MODE||mode===process.env.SEFI_SKIN_UI_MODE)){
   console.log('Checking skin UI:',mode);
   const page=await browser.newPage({viewport:{width:1100,height:850}});page.setDefaultTimeout(15000);
   page.on('pageerror',error=>console.log('PAGE ERROR:',error.message));
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='sefi.test')return route.abort();
    const file=path.join(__dirname,'../dist',url.pathname==='/'?'index.html':url.pathname);
    await route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
   });
   await page.addInitScript(({mode,png})=>{
    const account={id:'test',username:'SEFI_Player',type:mode==='microsoft'?'microsoft':'offline',mcType:mode==='bound'?'microsoft':'offline',mcVerifiedAt:mode==='bound'?1:0,uuid:'12345678123442348234123456789abc',active:true,...(mode==='offline'||mode==='saved'||mode==='no_webgl'||mode==='bound'||mode==='unavailable'?{communityToken:'fixture',twitchLogin:'sefi_player'}:{})};
    let saved=mode==='saved'?{png,model:'classic',sha256:'a'.repeat(64)}:null;
    if(mode==='no_webgl'){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl'||kind==='webgl2'||kind==='experimental-webgl'?null:original.call(this,kind,...args);};}
    window.skinCalls=[];
    window.electronAPI=new Proxy({
     getAccounts:async()=>mode==='guest'?[]:[account],getSettings:async()=>({ramMax:4096}),getServerStatus:async()=>({online:false,players:0,maxPlayers:20}),getModpackStatus:async()=>({installed:false}),getLauncherConfig:async()=>null,
     refreshCommunityProfile:async()=>null,
     getCommunitySkin:async()=>{if(mode==='unavailable')throw Error('Сервис скинов недоступен. Попробуйте ещё раз позже.');return saved;},
     chooseSkin:async()=>({png,filename:'hoodie.png'}),
     saveCommunitySkin:async(id,png,model)=>{window.skinCalls.push({id,model});return saved={png,model,sha256:'a'.repeat(64)};},
     resetCommunitySkin:async()=>{window.skinCalls.push({reset:true});return saved=null;},
     openExternal:async url=>window.skinCalls.push({url}),
    },{get:(object,key)=>key in object?object[key]:()=>()=>{}});
   },{mode,png:png()});
   await page.goto('http://sefi.test/');
   await page.getByRole('button',{name:'Аккаунты',exact:true}).click();
   const section=page.locator('section').filter({hasText:'Внешний вид'});
   await section.scrollIntoViewIfNeeded();
   if(mode==='offline'){
    await page.getByRole('button',{name:'Выбрать PNG'}).click();
    await page.getByText('hoodie.png · Предпросмотр, ещё не сохранён').waitFor();
    const preview=page.getByRole('img',{name:/3D-скин персонажа/});
    await page.waitForFunction(()=>document.querySelector('canvas[data-ready="true"]'));
    const classic=await preview.screenshot();
    const bounds=await preview.boundingBox();assert(bounds);
    await page.mouse.move(bounds.x+100,bounds.y+120);await page.mouse.down();
    await page.mouse.move(bounds.x+190,bounds.y+145,{steps:12});await page.mouse.up();
    const turned=await preview.screenshot();assert(!classic.equals(turned),'Dragging must change the rendered 3D view');
    await page.getByRole('button',{name:'Вернуть ракурс'}).click();
    const reset=await preview.screenshot();assert((await difference(page,classic,reset)) < (await difference(page,classic,turned))*0.1+0.0001,'Reset must restore the initial camera within render tolerance');
    await preview.focus();await page.keyboard.press('ArrowRight');
    assert(!(await preview.screenshot()).equals(reset),'Keyboard must rotate the 3D view');
    await page.keyboard.press('Home');
    await page.getByRole('button',{name:'Тонкая · 3 px'}).click();
    assert(!(await preview.screenshot()).equals(classic),'Slim model must change the geometry');
    await page.getByRole('button',{name:'Сохранить',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Скин сохранён'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.skinCalls),[{id:'test',model:'slim'}]);
    await page.waitForFunction(()=>document.querySelector('button[aria-pressed="true"]')?.textContent==='Тонкая · 3 px');
    const head=page.getByRole('img',{name:'Голова SEFI_Player из скина'});
    await head.waitFor();
    await page.waitForFunction(()=>{
      const head=document.querySelector('aside canvas');
      return head && head.getContext('2d').getImageData(0,0,1,1).data[3]===255;
    });
    assert.deepEqual(await head.evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,1,1).data)),[216,168,128,255]);
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(__dirname,'../design/skins-community.png')});
    await page.getByRole('button',{name:'Главная',exact:true}).click();
    await page.getByRole('button',{name:'Аккаунты',exact:true}).click();
    await page.getByRole('button',{name:'Сбросить'}).waitFor();
    await page.getByRole('button',{name:'Сбросить'}).click();
    await page.getByRole('status').filter({hasText:'Скин сброшен'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Сохранить',exact:true}).isDisabled(),true);
    assert.equal(await page.locator('aside canvas').count(),0);
   } else if(mode==='saved'){
    await page.getByRole('img',{name:'Голова SEFI_Player из скина'}).waitFor();
    await page.waitForFunction(()=>document.querySelector('canvas[data-ready="true"]'));
   } else if(mode==='no_webgl'){
    await page.getByRole('button',{name:'Выбрать PNG'}).click();
    await page.getByText('3D-просмотр недоступен на этом устройстве.').waitFor();
    await page.getByRole('button',{name:'Сохранить',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Скин сохранён'}).waitFor();
    await page.getByRole('img',{name:'Голова SEFI_Player из скина'}).waitFor();
   } else if(mode==='microsoft'||mode==='bound'){
    const link=page.getByRole('link',{name:'Изменить на Minecraft.net'});
    await link.click();
    assert.equal(await page.getByRole('button',{name:'Выбрать PNG'}).count(),0);
    assert.equal((await page.evaluate(()=>window.skinCalls))[0].url,'https://www.minecraft.net/en-us/msaprofile/mygames/editskin');
    if(mode==='microsoft')await page.screenshot({path:path.join(__dirname,'../design/skins-microsoft.png')});
   } else if(mode==='guest')assert.equal(await page.getByRole('button',{name:'Выбрать PNG'}).isDisabled(),true);
   else await page.getByRole('alert').filter({hasText:'Сервис скинов недоступен'}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.close();
  }
  console.log('PASS: 3D drag/keyboard rotation, camera reset, slim geometry, sidebar head pixels, startup/revisit, WebGL fallback, save/reset, Microsoft/linked account protection, official hyperlink, guest and API-unavailable states; 1100px layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

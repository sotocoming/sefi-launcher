const {app,nativeImage}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto');
function png(width,height=width){
 function chunk(kind,data){const b=Buffer.from(kind),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);let c=-1;for(const x of Buffer.concat([b,data])){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}crc.writeUInt32BE((c^-1)>>>0);return Buffer.concat([n,b,data,crc]);}
 const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=6;
 const pixels=Buffer.concat(Array.from({length:height},()=>Buffer.concat([Buffer.from([0]),crypto.randomBytes(width*4)])));
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
app.whenReady().then(async()=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(root,'design','native-skins-'));
 let file;
 const ctx={exports:{},Buffer,URL,AbortSignal,process:{env:{}},require(id){if(id==='electron')return {app:{isPackaged:false},nativeImage,dialog:{showOpenDialog:async()=>({filePaths:[file]})}};if(id==='./accounts')return {};return require(id);}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'dist-electron/electron/minecraft/skins.js'),'utf8'),ctx);
 for(const size of [64,128]){
  file=path.join(dir,`skin-${size}.png`);fs.writeFileSync(file,png(size));
  if(size===128)assert(fs.statSync(file).size>65536);
  const draft=await ctx.exports.chooseSkin(null),image=nativeImage.createFromBuffer(Buffer.from(draft.png,'base64'));
  assert.equal(image.getSize().width,size);assert.equal(image.getSize().height,size);
 }
 for(const [w,h] of [[64,128],[128,64],[256,256],[32,32]]){file=path.join(dir,`bad-${w}-${h}.png`);fs.writeFileSync(file,png(w,h));await assert.rejects(ctx.exports.chooseSkin(null));}
 file=path.join(dir,'broken.png');fs.writeFileSync(file,'broken');await assert.rejects(ctx.exports.chooseSkin(null));
 console.log('PASS: real Electron PNG decoding and normalization preserve 64/128 resolution; noisy HD >64 KiB accepted; rectangles, unsupported sizes and corrupt files rejected.');
 app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});

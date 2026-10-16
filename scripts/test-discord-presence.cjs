const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm'),net=require('node:net'),os=require('node:os');
const {rpcFrame,RpcFrames,discordPipe}=require('../dist-electron/electron/discord-rpc');
const {activityFor,playerCount}=require('../dist-electron/electron/discord-presence');
const {watchGamePresence,gameLocation}=require('../dist-electron/electron/game-presence');
const testIcon='https://cdn.discordapp.com/app-icons/1560635017212854363/'+'a'.repeat(32)+'.png?size=512';
const config={server:{name:'Sweet Home',ip:'mc.sotocoming.ru',port:25565,endpoints:[{address:'mc.sotocoming.ru',label:'EURO'},{address:'minecraft.sotocoming.ru',label:'RU'}]}};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<100;i++){if(check())return;await wait(30);}throw Error('Timed out');}
(async()=>{
 const frame=rpcFrame(1,{evt:'READY'}),parser=new RpcFrames();
 assert.equal(parser.push(frame.subarray(0,5)).length,0);
 assert.equal(parser.push(frame.subarray(5,11)).length,0);
 assert.deepEqual(parser.push(Buffer.concat([frame.subarray(11),rpcFrame(3,{heartbeat:1})])).map(v=>v.opcode),[1,3]);
 const oversized=Buffer.alloc(8);oversized.writeUInt32LE(65537,4);assert.throws(()=>new RpcFrames().push(oversized));
 if(process.platform==='win32')assert.equal(discordPipe(0),'\\\\?\\pipe\\discord-ipc-0');
 const active=(location)=>activityFor({status:'running',pid:10},location,config,123,testIcon);
 for(const server of ['mc.sotocoming.ru','MC.SOTOCOMING.RU:25565','minecraft.sotocoming.ru']) {
  const a=active({mode:'multiplayer',server});assert.equal(a.details,'На сервере');assert.equal(a.timestamps.start,123);
  assert.equal(a.assets.large_image,testIcon);assert(!JSON.stringify({details:a.details,state:a.state}).includes(server));
 }
 for(const [dimension,label] of [['minecraft:overworld','Обычный мир'],['minecraft:the_nether','Незер'],['minecraft:the_end','Энд']]) {
  for(const [server,region] of [['mc.sotocoming.ru','EURO'],['minecraft.sotocoming.ru','RU']]) {
   const a=active(gameLocation({mode:'multiplayer',server,dimension,players:12}));
   assert.equal(a.details,'На сервере · 12 игроков');assert.equal(a.state,label+' · '+region);
   assert(!a.details.includes('Sweet Home'));assert.equal(a.timestamps.start,123);
  }
  assert.equal(active({mode:'singleplayer',dimension}).state,label);
 }
 for(const [n,word] of [[1,'игрок'],[2,'игрока'],[4,'игрока'],[11,'игроков'],[12,'игроков'],[21,'игрок'],[25,'игроков']])assert.equal(playerCount(n),n+' '+word);
 const invalidStats=gameLocation({mode:'multiplayer',server:'mc.sotocoming.ru',players:'12',dimension:'private world name'});
 assert.equal(invalidStats.players,undefined);assert.equal(invalidStats.dimension,undefined);
 assert.equal(active({mode:'multiplayer',server:'mc.sotocoming.ru',dimension:'mod:private_location'}).state,'Другой мир · EURO');
 assert.equal(active({mode:'singleplayer'}).details,'Одиночный мир');
 assert.equal(active({mode:'menu'}).details,'В главном меню');
 assert.equal(active(null).details,'Minecraft запущен');
 const other=active({mode:'multiplayer',server:'192.168.1.12:25565'});assert.equal(other.details,'Другой сервер');assert(!JSON.stringify(other).includes('192.168'));
 assert.equal(activityFor({status:'idle'},null,config,123).timestamps,undefined);
 for(const value of [null,{}, {mode:'multiplayer',server:'https://private/path'}, {mode:'multiplayer',server:'x'.repeat(256)}])assert.equal(gameLocation(value),null);
 assert.deepEqual(gameLocation({mode:'menu',secret:'ignored'}),{mode:'menu'});
 // Real local socket: handshake, fragmented READY, PING/PONG, SET_ACTIVITY, disconnect cleanup.
 const endpoint=process.platform==='win32'?'\\\\?\\pipe\\sefi-rpc-test-'+process.pid:path.join(os.tmpdir(),'sefi-rpc-test-'+process.pid);
 const received=[],sockets=new Set();let connections=0,attempts=0;
 const server=net.createServer(socket=>{
  sockets.add(socket);connections++;const frames=new RpcFrames();
  socket.on('data',chunk=>{for(const f of frames.push(chunk)){
   received.push(f);
   if(f.opcode===0){assert.equal(f.value.client_id,'123456789012345678');const ready=rpcFrame(1,{evt:'READY'});socket.write(ready.subarray(0,7));socket.write(Buffer.concat([ready.subarray(7),rpcFrame(3,{test:1})]));}
   else if(f.value.cmd==='SET_ACTIVITY')socket.write(rpcFrame(1,{cmd:'SET_ACTIVITY',nonce:f.value.nonce,data:f.value.args.activity}));
  }});socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});
 });
 await new Promise(resolve=>server.listen(endpoint,resolve));
 const ctx={exports:{},Buffer,process,setTimeout,clearTimeout,Date,require(id){if(id==='node:net')return {createConnection(){attempts++;return net.createConnection(attempts===1?endpoint+'-missing':endpoint);}};return require(id);}};
 vm.runInNewContext(await fs.readFile(path.join(__dirname,'../dist-electron/electron/discord-rpc.js'),'utf8'),ctx);
 const rpc=new ctx.exports.DiscordRpc('123456789012345678',4321);
 try {
  rpc.setActivity(active({mode:'multiplayer',server:'mc.sotocoming.ru'}));rpc.setEnabled(true);
  await until(()=>received.some(f=>f.value.cmd==='SET_ACTIVITY'));
  assert.equal(attempts,2);assert.equal(connections,1);
  const first=received.find(f=>f.value.cmd==='SET_ACTIVITY');assert.equal(first.value.args.pid,4321);assert.equal(first.value.args.activity.details,'На сервере');
  await until(()=>received.some(f=>f.opcode===4));
  rpc.setActivity(active({mode:'menu'}));rpc.setActivity(active({mode:'singleplayer'}));
  await wait(100);assert.equal(received.filter(f=>f.value.cmd==='SET_ACTIVITY').length,1,'Updates must be coalesced and rate-limited');
  rpc.setEnabled(false);await until(()=>received.some(f=>f.value.cmd==='SET_ACTIVITY'&&f.value.args.activity===null));
  rpc.setEnabled(true);await until(()=>connections===2&&received.some(f=>f.value.args?.activity?.details==='Одиночный мир'));
 }finally{rpc.close();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
 // Real per-launch heartbeat file: switch servers, lose telemetry, close without lingering updates.
 const states=[];const watcher=await watchGamePresence(value=>states.push(value));
 try {
  await fs.writeFile(watcher.file,JSON.stringify({mode:'multiplayer',server:'mc.sotocoming.ru'}));
  await wait(2200);assert.equal(states.at(-1).mode,'multiplayer');
  await fs.writeFile(watcher.file,JSON.stringify({mode:'menu'}));await wait(2100);assert.equal(states.at(-1).mode,'menu');
  await fs.utimes(watcher.file,new Date(0),new Date(0));await wait(2100);assert.equal(states.at(-1),null);
  await fs.writeFile(watcher.file,'x'.repeat(2049));await wait(2100);assert.equal(states.at(-1),null);
 }finally{watcher.close();}
 const count=states.length;await wait(2200);assert.equal(states.length,count);
 console.log('PASS: real IPC handshake/fallback/PING/clear/reconnect, bounded fragmented frames, rate limiting, actual server identity, privacy, fresh/stale/oversize telemetry, close cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});

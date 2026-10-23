import net from 'net';
import type { ServerStatus } from '../src/types';

function writeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  while (true) {
    if ((value & ~0x7f) === 0) {
      bytes.push(value);
      break;
    }
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  return Buffer.from(bytes);
}

function readVarInt(buffer: Buffer, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let b: number;
  do {
    if (shift >= 35) throw new Error('Invalid VarInt');
    if (offset >= buffer.length) throw new Error('Buffer underflow');
    b = buffer[offset++];
    value |= (b & 0x7f) << shift;
    shift += 7;
  } while ((b & 0x80) !== 0);
  return [value, offset];
}

export function getServerStatus(host = 'sotocoming.ru', port = 25565): Promise<ServerStatus> {
 const offline:ServerStatus={online:false,players:0,maxPlayers:0,motd:'Сервер недоступен',version:''};
 return new Promise(resolve=>{
  let result=offline, done=false, buffer=Buffer.alloc(0), pingAt=0;
  const finish=()=>{if(done)return;done=true;clearTimeout(deadline);socket.destroy();resolve(result);};
  const socket=net.createConnection({host,port},()=>{
   const hostBuf=Buffer.from(host,'utf8');
   const payload=Buffer.concat([writeVarInt(0),writeVarInt(-1),writeVarInt(hostBuf.length),hostBuf,Buffer.from([port>>8&255,port&255]),writeVarInt(1)]);
   socket.write(Buffer.concat([writeVarInt(payload.length),payload,Buffer.from([1,0])]));
  });
  const deadline=setTimeout(finish,5000);
  socket.on('data',data=>{
   if(done)return;
   buffer=Buffer.concat([buffer,data]);
   if(buffer.length>1024*1024){finish();return;}
   while(buffer.length){
    let length:number, start:number;
    try{[length,start]=readVarInt(buffer,0);}catch{return;}
    if(length<1||length>1024*1024){finish();return;}
    if(buffer.length<start+length)return;
    const packet=buffer.subarray(start,start+length); buffer=buffer.subarray(start+length);
    try{
     const [id,offset]=readVarInt(packet,0);
     if(id===0&&!result.online){
      const [size,jsonAt]=readVarInt(packet,offset);
      if(size<0||jsonAt+size!==packet.length)throw new Error('Invalid status');
      const response=JSON.parse(packet.toString('utf8',jsonAt));
      const description=response.description;
      result={online:true,players:response.players?.online??0,maxPlayers:response.players?.max??0,motd:typeof description==='string'?description:description?.text||'Minecraft Server',version:response.version?.name||'',favicon:response.favicon};
      const ping=Buffer.alloc(10);ping[0]=9;ping[1]=1;ping.writeBigInt64BE(1n,2);pingAt=performance.now();socket.write(ping);
     }else if(id===1&&pingAt&&packet.length===9&&packet.readBigInt64BE(1)===1n){result.pingMs=Math.max(1,Math.round(performance.now()-pingAt));finish();}
    }catch{finish();return;}
   }
  });
  socket.on('error',finish);socket.on('close',finish);
 });
}

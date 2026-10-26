const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {createRequire}=require('node:module');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));const dep=createRequire(path.join(process.argv[3]||root,'package.json'));const ts=dep('typescript');
const requests=[];const moduleResult={exports:{}};
let failureStatus;
class CommunitySessionError extends Error {constructor(message,status){super(message);this.status=status;}}
const code=ts.transpileModule(fs.readFileSync(path.join(root,'electron/minecraft/report-broker.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
vm.runInNewContext(code,{module:moduleResult,exports:moduleResult.exports,Buffer,process,require(name){if(name==='electron')return {app:{on(){}}};if(name==='./community-request')return {CommunitySessionError,communityRequest:async(route,token,body)=>{if(route.endsWith('/tickets'))return {tickets:[{id:42,title:'Проблема запуска',status:'working',status_label:'В работе'}]};requests.push({route,token,body});if(failureStatus)throw new CommunitySessionError('Fixture server error',failureStatus);return {ok:true,id:body.id,ticket_id:42,ticket_error:''};}};return dep(name);}});
(async()=>{
 const broker=await moduleResult.exports.startReportBroker({communityToken:'fixture-only',username:'Fixture'});
 try {
  const url='http://127.0.0.1:'+broker.port+'/sefi/report';const body={id:'11111111-1111-4111-8111-111111111111',title:'Tree animation',description:'Tree falls without animation',steps:'Chop an oak',sections:['build'],diagnostics:{build:{mods:[]}},discord:true};
  async function send(headers){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-SEFI-Report-Key':broker.key,...headers},body:JSON.stringify(body)});}
  assert.equal((await send({'X-SEFI-Report-Key':'0'.repeat(64)})).status,403);
  assert.equal((await send({Origin:'https://hostile.test'})).status,403);
  const hostileHost=await new Promise((resolve,reject)=>{const req=require('node:http').request(url,{method:'POST',headers:{Host:'hostile.test','Content-Type':'application/json','X-SEFI-Report-Key':broker.key}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end(JSON.stringify(body));});assert.equal(hostileHost,403);assert.equal(requests.length,0);const list=await fetch(url+'/tickets',{headers:{'Content-Type':'application/json','X-SEFI-Report-Key':broker.key}});assert.equal(list.status,200);assert.equal((await list.json()).tickets[0].id,42);assert.equal((await fetch(url+'/tickets')).status,403);
  const result=await send({});assert.equal(result.status,200);assert.equal((await result.json()).ticket_id,42);
  assert.equal(requests.length,1);assert.equal(requests[0].route,'/api/public/community/client-report');assert.equal(requests[0].token,'fixture-only');assert.deepEqual(JSON.parse(JSON.stringify(requests[0].body)),body);
  failureStatus=429;const limited=await send({});assert.equal(limited.status,429);const limitedMessage=(await limited.json()).error;assert.match(limitedMessage,/Лимит отправок/);assert.doesNotMatch(limitedMessage,/сессия|войдите|лаунчер/i);
  failureStatus=401;const revoked=await send({});assert.equal(revoked.status,401);assert.match((await revoked.json()).error,/Войдите/);
  failureStatus=503;const unavailable=await send({});assert.equal(unavailable.status,503);assert.doesNotMatch((await unavailable.json()).error,/войдите/i);
  failureStatus=undefined;assert.equal((await send({})).status,200);assert.equal(requests.at(-1).token,'fixture-only');
 } finally {broker.close();}
 const guest=await moduleResult.exports.startReportBroker({username:'Guest'});try{
  const response=await fetch('http://127.0.0.1:'+guest.port+'/sefi/report',{method:'POST',headers:{'Content-Type':'application/json','X-SEFI-Report-Key':guest.key},body:'{}'});assert.equal(response.status,401);
 }finally{guest.close();}
 console.log('PASS: local report bridge, selected diagnostics, guest refusal; rate limit, revoked session and outage remain distinct; retry keeps account');
})().catch(e=>{console.error(e);process.exitCode=1;});

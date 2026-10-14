const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {createRequire}=require('node:module');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));const dep=createRequire(path.join(process.argv[3]||root,'package.json'));const ts=dep('typescript');
const requests=[];const moduleResult={exports:{}};
const code=ts.transpileModule(fs.readFileSync(path.join(root,'electron/minecraft/report-broker.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
vm.runInNewContext(code,{module:moduleResult,exports:moduleResult.exports,Buffer,process,require(name){if(name==='electron')return {app:{on(){}}};if(name==='./community-request')return {communityRequest:async(route,token,body)=>{requests.push({route,token,body});return {ok:true,id:body.id,ticket_id:42,ticket_error:''};}};return dep(name);}});
(async()=>{
 const broker=await moduleResult.exports.startReportBroker({communityToken:'fixture-only',username:'Fixture'});
 try {
  const url='http://127.0.0.1:'+broker.port+'/sefi/report';const body={id:'11111111-1111-4111-8111-111111111111',title:'Tree animation',description:'Tree falls without animation',steps:'Chop an oak',sections:['build'],diagnostics:{build:{mods:[]}},discord:true};
  async function send(headers){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-SEFI-Report-Key':broker.key,...headers},body:JSON.stringify(body)});}
  assert.equal((await send({'X-SEFI-Report-Key':'0'.repeat(64)})).status,403);
  assert.equal((await send({Origin:'https://hostile.test'})).status,403);
  const hostileHost=await new Promise((resolve,reject)=>{const req=require('node:http').request(url,{method:'POST',headers:{Host:'hostile.test','Content-Type':'application/json','X-SEFI-Report-Key':broker.key}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end(JSON.stringify(body));});assert.equal(hostileHost,403);assert.equal(requests.length,0);
  const result=await send({});assert.equal(result.status,200);assert.equal((await result.json()).ticket_id,42);
  assert.equal(requests.length,1);assert.equal(requests[0].route,'/api/public/community/client-report');assert.equal(requests[0].token,'fixture-only');assert.deepEqual(JSON.parse(JSON.stringify(requests[0].body)),body);
 } finally {broker.close();}
 const guest=await moduleResult.exports.startReportBroker({username:'Guest'});try{
  const response=await fetch('http://127.0.0.1:'+guest.port+'/sefi/report',{method:'POST',headers:{'Content-Type':'application/json','X-SEFI-Report-Key':guest.key},body:'{}'});assert.equal(response.status,401);
 }finally{guest.close();}
 console.log('PASS: local report bridge, session-only authentication, denied browser origins/wrong host/key, description and selected diagnostics, guest refusal');
})().catch(e=>{console.error(e);process.exitCode=1;});

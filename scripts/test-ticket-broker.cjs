const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../electron/minecraft/ticket-broker.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const serverKey=crypto.generateKeyPairSync('ed25519');
const account={type:'offline',username:'test_player',uuid:'12345678-1234-1234-1234-123456789abc',communityToken:'TEST_SECRET_MUST_NOT_BE_LOGGED'};
const logs=[];let status=200,calls=0,delay=0;
class CommunitySessionError extends Error {constructor(status){super('TEST_SECRET_MUST_NOT_BE_LOGGED');this.status=status;}}
const api=async route=>{
 if(route.endsWith('/config'))return {version:2,server:'sefi-homestead',public_key:serverKey.publicKey.export({type:'spki',format:'der'}).toString('base64')};
 if(route.endsWith('/prepare'))return {user:{mc_nickname:account.username,mc_verified_at:0}};
 calls++;if(delay)await new Promise(r=>setTimeout(r,delay));
 if(status!==200)throw new CommunitySessionError(status);
 return {ticket:crypto.randomBytes(32).toString('base64url')};
};
const moduleObject={exports:{}};
vm.runInNewContext(compiled,{exports:moduleObject.exports,require:name=>name==='electron'?{app:{on(){}}}:name==='./community-request'?{communityRequest:api,CommunitySessionError}:require(name),Buffer,console:{warn:message=>logs.push(message)},setTimeout},{filename:'ticket-broker.js'});
function challenge(changes={}) {
 const client=crypto.generateKeyPairSync('ed25519');
 const raw=Buffer.from(JSON.stringify({v:2,server:'sefi-homestead',name:account.username,uuid:account.uuid,nonce:crypto.randomBytes(32).toString('base64url'),client_key:client.publicKey.export({type:'spki',format:'der'}).toString('base64'),expires:Math.floor(Date.now()/1000)+45,...changes}));
 return {challenge:raw.toString('base64url'),signature:crypto.sign(null,raw,serverKey.privateKey).toString('base64url')};
}
(async()=>{
 const broker=await moduleObject.exports.startTicketBroker(account);
 const post=async body=>fetch(`http://127.0.0.1:${broker.port}/sefi/game-ticket`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try {
  const old=challenge();let response=await post(old);assert.equal(response.status,200);assert.match((await response.json()).ticket,/^[A-Za-z0-9_-]{43}$/);
  response=await post(old);assert.equal(response.status,403);await response.text();
  status=503;response=await post(challenge());assert.equal(response.status,503);await response.text();
  status=200;delay=150;response=await post(challenge());assert.equal(response.status,200);await response.text();delay=0;
  status=401;response=await post(challenge());assert.equal(response.status,403);await response.text();
  const before=calls;status=200;
  for(const changes of [{expires:Math.floor(Date.now()/1000)-1},{name:'other'},{uuid:'wrong'}]){response=await post(challenge(changes));assert.equal(response.status,403);await response.text();}
  const forged=challenge();forged.signature='A'.repeat(86);response=await post(forged);assert.equal(response.status,403);await response.text();assert.equal(calls,before);
  assert(!logs.join('\n').includes(account.communityToken));
  assert(logs.some(s=>s.includes('status=503')));assert(logs.some(s=>s.includes('status=401')));
  console.log('Broker HTTP: signed proof, replay rejection, temporary failure followed by fresh challenge, delayed response, revoked session, expiry/profile/signature rejection, secret-free diagnostics PASS');
 } finally {broker.close();}
})().catch(error=>{console.error(error);process.exitCode=1});

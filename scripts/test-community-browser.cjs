const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../dist-electron/electron/minecraft/community-browser.js'),'utf8');
let opened,failOpen=false,expire;const mod={exports:{}};
vm.runInNewContext(source,{exports:mod.exports,module:mod,URL,URLSearchParams,Buffer,
setTimeout:(fn,ms)=>{assert.equal(ms,300000);expire=fn;return 1;},clearTimeout:()=>{},
require:id=>id==='electron'?{shell:{openExternal:async u=>{if(failOpen)throw Error('browser');opened=new URL(u);}}}:id==='./browser-auth-page'?{browserAuthPage:invalid=>invalid?'<h1>Invalid</h1>':'<h1>Received</h1>'}:require(id)});
const session='s'.repeat(32),code='x'.repeat(43),challenge='c'.repeat(43);
async function waitOpen(){while(!opened)await new Promise(r=>setTimeout(r,5));return +opened.searchParams.get('port');}
function request(port,url,options={}){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:url,...options},res=>{let body='';res.on('data',b=>body+=b);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.end();});}
(async()=>{
const pending=mod.exports.communityBrowserCode(session,challenge,false);const port=await waitOpen();
await assert.rejects(mod.exports.communityBrowserCode(session,challenge,false),/Вход уже/);
const url='/sefi/callback?session='+session+'&code='+code;
for(const [target,opts]of [[url,{method:'POST'}],[url,{headers:{host:'localhost:'+port}}],[url,{headers:{origin:'https://evil.test'}}],[url+'&session='+session,{}],[url+'&code='+code,{}],[url.replace(session,'a'.repeat(32)),{}],[url.replace(code,'bad'),{}],['/else'+url,{}],['/'+('a'.repeat(2100)),{}]]){
 const result=await request(port,target,opts);assert.equal(result.status,400);assert.equal(result.headers['cache-control'],'no-store');assert.match(result.headers['content-security-policy'],/default-src 'none'/);
}
const result=await request(port,url,{headers:{origin:'https://mc.sotocoming.ru'}});assert.equal(result.status,200);assert.match(result.headers['content-type'],/text\/html/);assert.equal(await pending,code);
opened=undefined;const timeout=mod.exports.communityBrowserCode(session,challenge,false);await waitOpen();const rejected=assert.rejects(timeout,/Время входа/);expire();await rejected;
opened=undefined;const cancel=mod.exports.communityBrowserCode(session,challenge,false);await waitOpen();const canceled=assert.rejects(cancel,/отменён/);mod.exports.cancelCommunityBrowser();await canceled;
failOpen=true;await assert.rejects(mod.exports.communityBrowserCode(session,challenge,false),/Не удалось открыть браузер/);
console.log('PASS: real loopback callback, method/host/origin/session/code/path/length guards, duplicate login, timeout cleanup, browser failure, valid receipt');
})().catch(e=>{console.error(e);process.exitCode=1;});

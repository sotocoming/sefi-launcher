const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let account = {id:'offline',type:'offline',communityToken:'secret-test-token'};
let calls = 0, status = 200;
const context = {exports:{},Buffer,URL,AbortSignal,process:{env:{}},
 require(id) {
  if(id==='electron') return {app:{isPackaged:false}};
  if(id==='./accounts') return {getAccounts:async()=>[account]};
  return require(id);
 },
 fetch: async (url, options) => {
  calls++; assert.equal(url,'https://mc.sotocoming.ru/api/public/community/skin');
  assert.equal(options.headers['X-Community-Token'],'secret-test-token');
  assert.equal(options.redirect,'error');
  if(options.body) {const body=JSON.parse(options.body); assert.equal('id' in body,false);}
  return {status,ok:status===200,text:async()=>JSON.stringify({skin:null})};
 }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist-electron/electron/minecraft/skins.js'),'utf8'),context);
const api=context.exports;
(async()=>{
 assert.equal(await api.getCommunitySkin('offline'),null);
 await api.saveCommunitySkin('offline','AAAA','slim');
 await api.resetCommunitySkin('offline');
 for(const fields of [{type:'microsoft'},{mcType:'microsoft'},{mcVerifiedAt:1},{communityToken:undefined}]) {
  const original=account;account={...original,...fields};const before=calls;
  await assert.rejects(api.getCommunitySkin('offline'));assert.equal(calls,before);account=original;
 }
 assert.throws(()=>api.saveCommunitySkin('offline','A'.repeat(90000),'slim'));
 await assert.rejects(api.getCommunitySkin('missing'));
 status=404;await assert.rejects(api.getCommunitySkin('offline'),/Сервис скинов недоступен/);
 assert.equal(api.skinApiOrigin(),'https://mc.sotocoming.ru');
 context.process.env.SEFI_SKINS_API='http://127.0.0.1:8765';assert.equal(api.skinApiOrigin(),'http://127.0.0.1:8765');
 context.process.env.SEFI_SKINS_API='https://untrusted.test';assert.throws(api.skinApiOrigin);
 console.log('PASS: skin IPC service uses account owner, protects Microsoft profiles, validates input and reports skin service unavailability.');
})().catch(e=>{console.error(e);process.exitCode=1;});

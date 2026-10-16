const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const dependency = createRequire(process.argv[2] || path.resolve(__dirname, '../package.json'));
const ts = dependency('typescript');
const root = path.resolve(__dirname, '..');
const catalog = require('../electron/minecraft/fabric-profiles.json');
const official = {id:'fabric-loader-0.18.4-1.20.1', inheritsFrom:'1.20.1', mainClass:'net.fabricmc.loader.impl.launch.knot.KnotClient', libraries:[{name:'net.fabricmc:fabric-loader:0.18.4',url:'https://maven.fabricmc.net/'}]};
const mirrorBytes = require('node:fs').readFileSync(process.argv[3] || path.join(__dirname, 'fixtures/fabric-profile-1.20.1-0.18.4.json'));
async function check(mode) {
  let calls=[], writes=[], tokenReads=0;
  const module={exports:{}};
  const code=ts.transpileModule(require('node:fs').readFileSync(path.join(root,'electron/minecraft/fabric-profile.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const mocks={
    'fs/promises':{readFile:async()=>{if(mode==='cached')return JSON.stringify(official);throw Object.assign(Error('missing'),{code:'ENOENT'})}},
    './atomic-files':{atomicWrite:async(p,b)=>{writes.push(JSON.parse(b))}},
    './game-integrity':{trustedGameUrl:u=>{if(u!=='https://maven.fabricmc.net/')throw Error('host');return u}},
    './pack-sources':{communityDownloadToken:async()=>{tokenReads++;return mode==='no-token'?undefined:'private-token'}},
    './fabric-profiles.json':catalog,
    electron:{net:{fetch:async(url,options)=>{
      calls.push({url,options});assert.equal(options.redirect,'error');assert.ok(options.signal);
      if(url.startsWith('https://meta.fabricmc.net/')){
        assert.equal(options.headers,undefined);
        if(mode==='official')return new Response(JSON.stringify(official));
        if(mode==='bad-official')return new Response('{}');
        throw Error('net::ERR_CONNECTION_TIMED_OUT');
      }
      assert.ok(url.startsWith('https://mc.sotocoming.ru/api/public/community/download-mirror/'));
      assert.equal(options.headers['X-Community-Token'],'private-token');
      if(mode==='mirror-down')return new Response('',{status:503});
      return new Response(mode==='corrupt'?Buffer.from('{}'):mirrorBytes);
    }}}
  };
  vm.runInNewContext(code,{module,exports:module.exports,require:n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),Buffer,AbortSignal,URL});
  const action=module.exports.ensureFabricProfile('test-game','1.20.1','0.18.4');
  if(['no-token','mirror-down','corrupt'].includes(mode)){await assert.rejects(action,/Не удалось загрузить профиль Fabric/);assert.equal(writes.length,0)}
  else {assert.equal(await action,official.id);assert.equal(writes.length,mode==='cached'?0:1)}
  assert.equal(calls.length,mode==='cached'?0:mode==='official'||mode==='no-token'?1:2);
  if(['official','cached'].includes(mode))assert.equal(tokenReads,0);
}
(async()=>{for(const mode of ['cached','official','timeout','bad-official','no-token','mirror-down','corrupt']){await check(mode);console.log('PASS',mode)}})().catch(e=>{console.error(e);process.exitCode=1});

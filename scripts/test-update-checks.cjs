const fs=require('fs'),ts=require('typescript'),assert=require('assert/strict');require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {UpdateChecks}=require('../electron/update-checks.ts');
(async()=>{let now=0,count=0,blocked=false,state={status:'idle'},fail=false,release;const s=new UpdateChecks({now:()=>now,state:()=>state,blocked:()=>blocked,check:async()=>{count++;if(fail){state={status:'error'};throw Error('offline')}if(release)await new Promise(r=>release=r);state={status:'idle'}}});
await s.run();assert.equal(count,1);now=60_000;await s.run();assert.equal(count,1);await s.run(true);assert.equal(count,2);await s.run(true);assert.equal(count,2);
now+=2*60*60_000;blocked=true;await s.run();assert.equal(count,2);blocked=false;await s.run();assert.equal(count,3);
now+=2*60*60_000;fail=true;await s.run();assert.equal(count,4);now+=14*60_000;await s.run();assert.equal(count,4);now+=60_000;fail=false;await s.run();assert.equal(count,5);
state={status:'ready',version:'new'};now+=3*60*60_000;assert.equal((await s.run(true)).status,'ready');assert.equal(count,5);
state={status:'idle'};release=()=>{};const a=s.run(true),b=s.run(true);assert.equal(count,6);release();await Promise.all([a,b]);assert.equal(count,6);
blocked=true;assert.equal((await s.run(true)).status,'error');console.log('Updater: 2h interval, manual cooldown, game/offline pause, 15m retry, one request, ready preservation PASS');})().catch(e=>{console.error(e);process.exit(1)});

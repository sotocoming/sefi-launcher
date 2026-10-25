const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
let accounts=[],offline=false,user;
const result={exports:{}};
const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../electron/minecraft/accounts.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports:result.exports,module:result,console,require:id=>id==='./account-store'?{readAccounts:async()=>accounts,updateAccounts:async f=>f(accounts)}:id==='./community-request'?{communityRequest:async(route,token)=>{assert.equal(route,'/api/public/community/me');assert.equal(token,'native-token');if(offline)throw Error('offline');return {user};}}:id.startsWith('./')?{}:require(id)});
(async()=>{
 const base={id:'comm_7',username:'Player',uuid:'offline',type:'offline',active:true,communityToken:'native-token',discordId:'old'};
 const ms={id:'ms',username:'Licensed',uuid:'12345678123412341234123456781234',type:'microsoft',active:false};
 for(const mode of ['community','microsoft-unverified','transfer']){
  accounts=mode==='transfer'?[{...base},{...ms}]:mode==='microsoft-unverified'?[{...ms,active:true,communityToken:'native-token'}]:[{...base}];
  user={id:7,mc_nickname:'Player',twitch_login:'player',whitelist_status:'approved',mc_type:mode==='transfer'?'microsoft':'offline',mc_uuid:mode==='transfer'?ms.uuid:null,mc_verified_at:mode==='transfer'?123:0,discord_id:'222222222222222222',discord_username:'player_discord'};
  const fresh=await result.exports.refreshCommunityProfile('native-token');assert(fresh,mode);assert.equal(fresh.discordId,user.discord_id);assert.equal(fresh.discordUsername,user.discord_username);if(mode==='transfer'){assert.equal(accounts.length,1);assert.equal(fresh.id,'ms');assert.equal(fresh.active,true);}
  offline=true;assert.equal(await result.exports.refreshCommunityProfile('native-token'),null);assert.equal(accounts[0].discordId,user.discord_id);offline=false;
  user.discord_id=null;user.discord_username=null;const cleared=await result.exports.refreshCommunityProfile('native-token');assert.equal(cleared.discordId,null);assert.equal(cleared.discordUsername,null);
 }
 accounts=[];assert.equal(await result.exports.refreshCommunityProfile('native-token'),null,'removed accounts are not recreated');
 console.log('PASS: Discord metadata refresh/clear for community, unverified Microsoft and merged profiles, selection transfer, offline preservation and removed-account guard');
})().catch(e=>{console.error(e);process.exitCode=1;});

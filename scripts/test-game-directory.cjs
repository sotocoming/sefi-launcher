const fs = require('fs'), fsp = require('fs/promises'), path = require('path'), os = require('os'), assert = require('assert/strict'), Module = require('module'), ts = require('typescript');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
(async () => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'sefi-path-test-'));
  const api = require('../electron/minecraft/game-directory.ts');
  try {
    assert.equal(api.normalizeGameDirectory('D:\\'), 'D:\\SEFI Minecraft');
    assert.equal(api.normalizeGameDirectory('D:\\Games\\SEFI'), 'D:\\Games\\SEFI');
    assert.equal(api.normalizeGameDirectory('\\\\server\\share\\'), '\\\\server\\share\\SEFI Minecraft');
    assert.throws(() => api.normalizeGameDirectory('relative'), /полный путь/);
    assert.throws(() => api.normalizeGameDirectory(''), /полный путь/);
    const game = path.join(directory, 'new game');
    assert.equal(await api.prepareGameDirectory(game), game);
    assert.equal(await api.prepareGameDirectory(game), game);
    assert.deepEqual(await fsp.readdir(game), [], 'write probe leaves no files');
    const file = path.join(directory, 'file'); await fsp.writeFile(file, 'x');
    await assert.rejects(api.prepareGameDirectory(file), /является файлом/);
    const original = fsp.writeFile;
    fsp.writeFile = async () => { throw Object.assign(Error('denied'), {code:'EPERM'}); };
    try { await assert.rejects(api.prepareGameDirectory(game), e => e.message.includes('Нет доступа для записи') && e.message.includes(game) && e.message.includes('выберите другую')); }
    finally { fsp.writeFile = original; }
    const originalLoad = Module._load;
    Module._load = function(id, parent, ...args) { if (id === 'electron') return {app:{getPath:()=>directory}}; return originalLoad.call(this,id,parent,...args); };
    try {
      const config = require('../electron/config.ts');
      await fsp.writeFile(path.join(directory,'settings.json'), JSON.stringify({gameDirectory:'D:\\', ramMax:8192}));
      const legacy = await config.getSettings();
      assert.equal(legacy.gameDirectory, 'D:\\SEFI Minecraft');
      assert.equal(legacy.ramMax,8192);
      await config.saveSettings({...legacy, gameDirectory:'D:\\'});
      assert.equal(JSON.parse(await fsp.readFile(path.join(directory,'settings.json'),'utf8')).gameDirectory,'D:\\SEFI Minecraft');
    } finally { Module._load = originalLoad; }
    console.log('PASS: drive and UNC root become a dedicated folder; existing/new directories, write probe cleanup, file path and access denial.');
  } finally { await fsp.rm(directory, {recursive:true,force:true}); }
})().catch(error => {console.error(error);process.exitCode=1;});

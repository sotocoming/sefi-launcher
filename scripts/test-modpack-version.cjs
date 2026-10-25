const assert = require('node:assert/strict'), fs = require('node:fs/promises'), sync = require('node:fs');
const path = require('node:path'), os = require('node:os'), vm = require('node:vm'), crypto = require('node:crypto');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const dep = require('node:module').createRequire(path.join(root, 'package.json'));
const catalog = JSON.parse(sync.readFileSync(path.join(root, 'electron/minecraft/modpack-catalog.json')));
(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sefi-version-'));
  try {
    const bytes = Buffer.from('fixture mod');
    await fs.mkdir(path.join(dir, 'mods')); await fs.writeFile(path.join(dir, 'mods/fixture.jar'), bytes);
    const meta = { schema: 2, version: '1.0.0', projectId: catalog.projectId, fileId: catalog.fileId,
      archiveSha256: catalog.archive.sha256, files: [{ name: 'fixture.jar', size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }] };
    const metadata = JSON.stringify(meta); await fs.writeFile(path.join(dir, 'modpack-meta.json'), metadata);
    const config = { modpack: { version: '1.0.0', curseforgeProjectId: catalog.projectId, curseforgeFileId: catalog.fileId, sha256: catalog.archive.sha256 } };
    const mocks = { './pack-sources': {}, './modpack-catalog.json': catalog, '../config': { getLauncherConfig: async () => config }, electron: {}, './atomic-files': {},
      './modpack-download': { safeFileName: name => name, fileSha256: async file => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex') } };
    const result = { exports: {} }; const ts = dep('typescript');
    const code = ts.transpileModule(sync.readFileSync(path.join(root, 'electron/minecraft/modpack.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { module: result, exports: result.exports, require: name => name in mocks ? mocks[name] : dep(name) });
    const status = () => result.exports.getModpackStatus(dir);
    let current = await status(); assert.equal(current.currentVersion, '1.0.0'); assert.equal(current.latestVersion, '1.0.0'); assert.equal(current.updateAvailable, false);
    config.modpack.version = '1.3.7'; current = await status();
    assert.equal(current.updateAvailable, false, 'label correction is not an update');
    assert.equal(current.currentVersion, '1.3.7'); assert.equal(current.latestVersion, '1.3.7');
    config.modpack.version = 'custom-server-label'; current = await status();
    assert.equal(current.currentVersion, 'custom-server-label'); assert.equal(current.updateAvailable, false);
    assert.equal(await fs.readFile(path.join(dir, 'modpack-meta.json'), 'utf8'), metadata, 'status must not rewrite installed metadata');
    config.modpack.curseforgeFileId++; assert.equal((await status()).updateAvailable, true); config.modpack.curseforgeFileId--;
    config.modpack.sha256 = 'a'.repeat(64); assert.equal((await status()).updateAvailable, true); config.modpack.sha256 = catalog.archive.sha256;
    await fs.writeFile(path.join(dir, 'mods/fixture.jar'), 'broken'); assert.equal((await status()).updateAvailable, true);
    await fs.writeFile(path.join(dir, 'mods/fixture.jar'), bytes);
    meta.files.push({name:'sefi-auth-2.0.3.jar',size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
    await fs.writeFile(path.join(dir,'mods/sefi-auth-2.0.3.jar'),bytes);
    await fs.writeFile(path.join(dir,'modpack-meta.json'),JSON.stringify(meta));
    assert.equal((await status()).updateAvailable,true,'old auth metadata requires one repair');
    meta.files[1].name='sefi-auth-2.0.4.jar';await fs.rename(path.join(dir,'mods/sefi-auth-2.0.3.jar'),path.join(dir,'mods/sefi-auth-2.0.4.jar'));
    await fs.writeFile(path.join(dir,'modpack-meta.json'),JSON.stringify(meta));
    assert.equal((await status()).updateAvailable,false,'new auth metadata remains stable after repair');
    await fs.writeFile(path.join(dir, 'modpack-installing.json'), '{}'); assert.equal((await status()).updateAvailable, true);
    console.log('PASS: version comes from server; label changes require no installation or metadata writes; actual artifact changes, corruption and incomplete installation still require repair');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const Module = require('module');
const crypto = require('crypto');
const util = require('util');
const ts = require('typescript');
const AdmZip = require('adm-zip');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
(async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'sefi-java-test-'));
  const originalLoad = Module._load;
  let requests = 0, offline = false, corrupt = false, truncate = false, invalidRuntime = false, ramFailure = false;
  const output = 'openjdk version "21.0.8"\nos.arch = amd64\nsun.arch.data.model = 64\n';
  const execute = () => {};
  const probes = [];
  execute[util.promisify.custom] = async (exe, args, options) => {
    probes.push({ exe, args, options });
    if (!fs.existsSync(exe)) throw Error('ENOENT');
    if (ramFailure && args.some(a => a.startsWith('-Xmx'))) throw { stderr: 'Could not reserve enough space for object heap' };
    const contents = fs.readFileSync(exe, 'utf8');
    return { stdout: '', stderr: contents === 'wrong-version' ? output.replace('21.0.8', '25.0.4') : contents === '32bit' ? output.replace('64', '32') : invalidRuntime ? 'broken' : output };
  };
  Module._load = function(id, parent, ...args) {
    if (id === 'electron') return { app: { getPath: () => root }, net: {} };
    if (id === 'child_process') return { ...originalLoad.call(this, id, parent, ...args), execFile: execute };
    return originalLoad.call(this, id, parent, ...args);
  };
  const zip = new AdmZip(); zip.addFile('jdk-21.0.8-jre/bin/java.exe', Buffer.from('valid'));
  const bytes = zip.toBuffer();
  const pkg = { link: 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.8/runtime.zip', checksum: crypto.createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
  const catalog = [{ binary: { os: 'windows', architecture: 'x64', jvm_impl: 'hotspot', image_type: 'jre', package: pkg }, version: { major: 21 } }];
  const downloadFile = require.resolve('../electron/minecraft/download-http.ts');
  require.cache[downloadFile] = { id: downloadFile, filename: downloadFile, loaded: true, exports: { requestDownload: async url => {
    requests++;
    if (offline) throw Error('offline');
    if (url.includes('/assets/')) return new Response(JSON.stringify(catalog));
    const content = truncate ? bytes.subarray(0, bytes.length - 2) : corrupt ? Buffer.alloc(bytes.length) : bytes;
    return new Response(content);
  } } };
  const java = require('../electron/minecraft/java.ts');
  try {
    assert.equal((await java.getJavaStatus()).status, 'missing');
    assert.equal(requests, 0, 'status must not download');
    assert.throws(() => java.trustedJavaUrl('https://evil.example/runtime.zip'));
    assert.throws(() => java.trustedJavaUrl('http://api.adoptium.net/runtime.zip'));
    assert.throws(() => java.selectJavaPackage([{ ...catalog[0], version: { major: 25 } }], 'x64'));
    assert.throws(() => java.selectJavaPackage([{ ...catalog[0], binary: { ...catalog[0].binary, package: { ...pkg, checksum: 'bad' } } }], 'x64'));
    corrupt = true;
    await assert.rejects(java.getJavaPath(), /SHA256/);
    assert.equal((await java.getJavaStatus()).status, 'missing');
    assert.equal((await fsp.readdir(path.join(root, 'runtimes'))).length, 0, 'failed download leaves no install or temp directory');
    corrupt = false; truncate = true;
    await assert.rejects(java.getJavaPath(), /SHA256/);
    truncate = false;
    const before = requests; const progress = [];
    const [a, b] = await Promise.all([java.getJavaPath(p => progress.push(p)), java.getJavaPath()]);
    assert.equal(a, b); assert.equal(requests - before, 2, 'concurrent requests share one install');
    assert(path.isAbsolute(a)); assert.equal((await java.getJavaStatus()).status, 'ready');
    assert(progress.some(p => p.stage === 'java' && p.percentage === 100));
    offline = true; const cachedRequests = requests;
    assert.equal(await java.resolveJava('', 4096), a); assert.equal(requests, cachedRequests, 'offline launch reuses managed Java');
    assert(probes.some(p => p.args.includes('-Xmx4096M') && p.options.windowsHide && p.options.timeout === 15000));
    ramFailure = true; await assert.rejects(java.resolveJava('', 16384), /уменьшите выделенную память/); ramFailure = false;
    const custom = path.join(root, 'custom java.exe'); await fsp.writeFile(custom, 'wrong-version');
    await assert.rejects(java.resolveJava(custom, 4096), /нужна Java 21/);
    assert.equal((await java.getJavaStatus(custom)).status, 'error');
    await fsp.writeFile(custom, '32bit'); await assert.rejects(java.inspectJava(custom), /64-битная/);
    await assert.rejects(java.inspectJava('java'), /полный путь/);
    // An invalid installation is replaced only after the new archive and executable pass checks.
    offline = false; await fsp.writeFile(a, 'wrong-version');
    assert.equal((await java.getJavaStatus()).status, 'missing');
    const repaired = await java.getJavaPath(); assert.equal(repaired, a); assert.equal((await java.getJavaStatus()).status, 'ready');
    assert.equal((await fsp.readdir(path.join(root, 'runtimes'))).length, 1);
    const badZip = new AdmZip(); badZip.addFile('../escape', Buffer.from('bad')); const unsafe = path.join(root, 'unsafe.zip'); badZip.writeZip(unsafe);
    // AdmZip normalises addFile paths; use a Unix symlink entry for an actual unsafe archive.
    const linkZip = new AdmZip(); linkZip.addFile('runtime/link', Buffer.from('target')); const entry = linkZip.getEntry('runtime/link'); entry.header.attr = (0o120777 << 16) >>> 0; linkZip.writeZip(unsafe);
    assert.throws(() => require('../electron/minecraft/modpack-download.ts').checkedZip(unsafe), /Небезопасный/);
    console.log('PASS: verified install, bad hash, truncated archive, concurrency, offline reuse, Java version/bitness, RAM preflight, repair, safe extraction.');
  } finally { Module._load = originalLoad; await fsp.rm(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });

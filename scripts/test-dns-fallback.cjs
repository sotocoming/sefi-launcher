const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const seed = require('../fallback-endpoints.json');
const source = ts.transpileModule(fs.readFileSync(path.join(root, 'electron/dns-fallback.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

function fixture({ cache, remote, fetchError, writeError, renameError, ready = false } = {}) {
  let isReady = ready, finishReady;
  const readiness = new Promise(resolve => { finishReady = resolve; });
  if (ready) finishReady();
  const events = [], files = new Map();
  if (cache !== undefined) files.set('/profile/fallback-endpoints-cache.json', cache);
  const module = { exports: {} };
  const electron = {
    app: {
      isReady: () => isReady,
      whenReady: () => readiness,
      getPath: () => '/profile',
      commandLine: { appendSwitch(name, value) {
        assert.equal(isReady, false, 'resolver rules must precede ready');
        assert.equal(events.some(e => e.type === 'fetch'), false, 'resolver rules must precede all requests');
        events.push({ type: 'rules', name, value });
      } },
      relaunch: () => events.push({ type: 'relaunch' }),
      exit: code => events.push({ type: 'exit', code }),
    },
    net: { async fetch(url, options) {
      assert.equal(isReady, true, 'remote fetch must follow ready');
      assert.equal(url, 'https://raw.githubusercontent.com/sotocoming/sefi-launcher/master/fallback-endpoints.json');
      assert.equal(options.redirect, 'error');
      assert.equal(options.credentials, 'omit');
      events.push({ type: 'fetch' });
      if (fetchError) throw fetchError;
      return new Response(typeof remote === 'string' ? remote : JSON.stringify(remote ?? {}));
    } },
  };
  const disk = {
    statSync(file) {
      if (!files.has(file)) throw Error('ENOENT');
      return { size: Buffer.byteLength(files.get(file)) };
    },
    readFileSync: file => files.get(file),
    promises: {
      async writeFile(file, data) {
        if (writeError) throw writeError;
        files.set(file, data); events.push({ type: 'write' });
      },
      async rename(from, to) {
        if (renameError) throw renameError;
        files.set(to, files.get(from)); files.delete(from); events.push({ type: 'rename' });
      },
      async unlink(file) { files.delete(file); },
    },
  };
  vm.runInNewContext(source, {
    module, exports: module.exports, Buffer, AbortSignal,
    console: { warn() {} },
    require(name) {
      if (name === 'electron') return electron;
      if (name === 'fs') return disk;
      if (name === 'path') return path.posix;
      if (name === '../fallback-endpoints.json') return require('../fallback-endpoints.json');
      throw Error('Unexpected dependency ' + name);
    },
  });
  return {
    api: module.exports, files, events,
    ready() { isReady = true; events.push({ type: 'ready' }); finishReady(); },
  };
}

(async () => {
  const offline = fixture({ fetchError: Error('ERR_NAME_NOT_RESOLVED') });
  assert.equal(offline.api.resolveGameHost('mc.sotocoming.ru'), 'mc.sotocoming.ru');
  offline.api.initializeDnsFallback();
  offline.api.initializeDnsFallback();
  assert.equal(offline.events.length, 1, 'initialization is synchronous and idempotent');
  const rules = offline.events[0].value;
  assert(rules.includes('MAP mc.sotocoming.ru ' + seed['mc.sotocoming.ru']));
  assert.equal(offline.api.resolveGameAddress('MC.SOTOCOMING.RU:25566'), seed['mc.sotocoming.ru'] + ':25566');
  assert.equal(offline.api.resolveGameAddress('[::1]:25565'), '[::1]:25565');
  assert.equal(offline.api.resolveGameHost('unrelated.example'), 'unrelated.example');
  assert.equal(offline.api.resolveGameHost('toString'), 'toString');
  const pending = offline.api.refreshDnsFallback();
  assert.equal(pending, offline.api.refreshDnsFallback(), 'refresh is single flight');
  await Promise.resolve();
  assert.equal(offline.events.some(e => e.type === 'fetch'), false);
  offline.ready();
  assert.equal(await pending, false);
  assert.equal(offline.api.resolveGameHost('mc.sotocoming.ru'), seed['mc.sotocoming.ru'],
    'routes remain usable if DNS fails after startup');
  assert.equal(offline.events.some(e => e.type === 'relaunch'), false);

  for (const cache of ['{broken', 'x'.repeat(16385),
    JSON.stringify({ 'evil.example': '127.0.0.1', 'mc.sotocoming.ru': '256.0.0.1' })]) {
    const f = fixture({ cache });
    f.api.initializeDnsFallback();
    assert.equal(f.api.resolveGameHost('mc.sotocoming.ru'), seed['mc.sotocoming.ru']);
    assert.equal(f.api.resolveGameHost('evil.example'), 'evil.example');
    assert.doesNotMatch(f.events[0].value, /evil/);
  }

  const changed = fixture({ remote: { 'mc.sotocoming.ru': '203.0.113.20', 'bad, MAP *': '127.0.0.1' } });
  changed.api.initializeDnsFallback(); changed.ready();
  assert.equal(await changed.api.refreshDnsFallback(), true);
  assert.deepEqual(changed.events.map(e => e.type), ['rules', 'ready', 'fetch', 'write', 'rename', 'relaunch', 'exit']);
  assert.equal(changed.api.resolveGameHost('mc.sotocoming.ru'), seed['mc.sotocoming.ru'],
    'Java and Chromium keep the same mapping until restart');
  const saved = changed.files.get('/profile/fallback-endpoints-cache.json');
  assert.equal(JSON.parse(saved)['mc.sotocoming.ru'], '203.0.113.20');
  assert.equal(Object.keys(JSON.parse(saved)).length, 3);

  const restarted = fixture({ cache: saved, remote: { 'mc.sotocoming.ru': '203.0.113.20' } });
  restarted.api.initializeDnsFallback();
  assert.match(restarted.events[0].value, /mc.sotocoming.ru 203.0.113.20/);
  assert.equal(restarted.api.resolveGameHost('mc.sotocoming.ru'), '203.0.113.20');
  restarted.ready();
  assert.equal(await restarted.api.refreshDnsFallback(), false, 'no restart loop for unchanged endpoints');

  for (const failure of [{ writeError: Error('EACCES') }, { renameError: Error('EPERM') }]) {
    const f = fixture({ ...failure, remote: { 'mc.sotocoming.ru': '203.0.113.20' } });
    f.api.initializeDnsFallback(); f.ready();
    assert.equal(await f.api.refreshDnsFallback(), false);
    assert.equal(f.events.some(e => e.type === 'relaunch'), false);
    assert.equal(f.files.has('/profile/fallback-endpoints-cache.json.tmp'), false);
    assert.equal(f.api.resolveGameHost('mc.sotocoming.ru'), seed['mc.sotocoming.ru']);
  }

  for (const remote of ['{broken', 'x'.repeat(16385), { 'mc.sotocoming.ru': '1.2.3.999' }, { 'other.example': '1.2.3.4' }]) {
    const f = fixture({ remote });
    f.api.initializeDnsFallback(); f.ready();
    assert.equal(await f.api.refreshDnsFallback(), false);
    assert.equal(f.events.some(e => e.type === 'relaunch'), false);
  }
  assert.throws(() => fixture({ ready: true }).api.initializeDnsFallback(), /before Electron is ready/);
  const main = fs.readFileSync(path.join(root, 'electron/main.ts'), 'utf8');
  assert.match(main, /initializeDnsFallback\(\);\s*app.whenReady\(\).then\(async \(\) => \{\s*if \(await refreshDnsFallback\(\)\) return;\s*createWindow\(\)/);
  console.log('PASS: actual DNS module initialization, ready ordering, cache, remote validation, restart, failures and startup integration');
})().catch(error => { console.error(error); process.exitCode = 1; });

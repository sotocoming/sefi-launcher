const { chromium } = require(process.env.SEFI_PLAYWRIGHT || 'C:/Users/Creep/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.SEFI_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'sefi.test') return route.abort();
      const file = path.join(__dirname, '../dist', url.pathname === '/' ? 'index.html' : url.pathname);
      await route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html' });
    });
    await page.addInitScript(() => {
      window.launches = [];
      window.electronAPI = new Proxy({
        getAccounts: async () => [{ id: 'fixture', username: 'Player', type: 'microsoft', uuid: 'fixture-uuid', active: true, communityConnected: true, twitchLogin: 'fixture', mcType: 'microsoft', mcUuid: 'fixture-uuid', mcVerifiedAt: 123 }],
        getSettings: async () => JSON.parse(localStorage.getItem('settings') || '{"ramMax":4096}'),
        saveSettings: async settings => { await new Promise(resolve => setTimeout(resolve, 80)); localStorage.setItem('settings', JSON.stringify(settings)); },
        launchGame: async () => { window.launches.push(JSON.parse(localStorage.getItem('settings') || '{}')); },
        getServerStatus: async () => ({ online: true, players: 1, maxPlayers: 20 }),
        getModpackStatus: async () => ({ installed: true }),
        getLauncherConfig: async () => ({ server: { ip: 'mc.sotocoming.ru', port: 25565, name: 'Sweet Home', endpoints: [
          { id: 'primary', label: 'EURO', address: 'mc.sotocoming.ru' },
          { id: 'additional', label: 'RU', address: 'minecraft.sotocoming.ru' },
        ] }, news: [] }),
      }, { get: (target, key) => key in target ? target[key] : () => () => {} });
    });
    await page.goto('http://sefi.test/');
    const toggle = page.getByRole('checkbox', { name: 'Подключаться сразу' });
    const ru = page.getByRole('radio', { name: 'RU: minecraft.sotocoming.ru', exact: true });
    const euro = page.getByRole('radio', { name: 'EURO: mc.sotocoming.ru', exact: true });
    const toggleLabel = page.getByText('Подключаться сразу', { exact: true });
    const play = page.getByRole('button', { name: /^ИГРАТЬ/ });
    await toggle.waitFor();
    await page.waitForTimeout(500); // Let the home entrance animation finish before measuring layout.
    assert.equal(await toggle.isChecked(), false);
    const initialBounds = await play.boundingBox();
    assert.equal(await euro.getAttribute('aria-checked'), 'false');
    assert.equal(await euro.locator('span').first().evaluate(el => getComputedStyle(el).visibility), 'hidden');
    await play.click();
    await page.waitForFunction(() => window.launches.length === 1);
    assert.equal(await page.evaluate(() => window.launches[0].autoConnect === true), false);
    await toggleLabel.click();
    await ru.click();
    await play.click();
    await page.waitForFunction(() => window.launches.length === 2);
    assert.deepEqual(await page.evaluate(() => window.launches[1]), { ramMax: 4096, autoConnect: true, selectedServerId: 'additional' });
    await page.reload();
    await toggle.waitFor();
    await page.waitForTimeout(500); // Let the home entrance animation finish before measuring layout.
    assert.equal(await toggle.isChecked(), true);
    assert.equal(await ru.getAttribute('aria-checked'), 'true');
    assert.deepEqual(await play.boundingBox(), initialBounds, 'controls must not move the Play button');
    await page.screenshot({ path: path.join(__dirname, '../design/quick-play.png') });
    await toggleLabel.click();
    await play.click();
    await page.waitForFunction(() => window.launches.length === 1);
    assert.equal(await page.evaluate(() => window.launches[0].autoConnect), false);
    await page.evaluate(() => localStorage.setItem('settings', JSON.stringify({ ramMax: 4096, autoConnect: true, selectedServerId: 'deleted' })));
    await page.reload();
    await euro.waitFor();
    assert.equal(await play.isDisabled(), true);
    await euro.click();
    assert.equal(await play.isEnabled(), true);
    console.log('PASS: opt-in default, EURO/RU selection, pending saves flushed before launch, persisted selection, disabling and stale selection recovery');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

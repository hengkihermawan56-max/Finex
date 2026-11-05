import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

// Integration tests use deterministic market fixtures. They exercise the real
// web modules and CSP over HTTP; they do not assert live exchange connectivity.
const server = spawn(process.execPath, ['scripts/serve.mjs'], { stdio: 'inherit' });
let browser;
const errors = [];
try {
  await mkdir('test-results', { recursive: true });
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { ready = (await fetch('http://127.0.0.1:4173')).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(ready, 'Local test server did not start');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#candidates-body tr').first().waitFor();
  assert.equal(await page.locator('#agent-list .agent').count(), 6);
  assert.match(await page.locator('#equity').textContent(), /1\.000\.000/);
  assert.match(await page.locator('#notice-text').textContent(), /DEMO/);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.locator('#toggle-run').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('hengki-solana-v1:demo')).running === true);
  await page.reload();
  assert.match(await page.locator('#run-status').textContent(), /dijeda/);
  await page.locator('#toggle-run').click();
  await page.evaluate(() => window.HengkiDesk.pauseForBackground());
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('hengki-solana-v1:demo')).running), false);
  await page.evaluate(() => window.HengkiDesk.resumeForeground());
  const address = 'So11111111111111111111111111111111111111112';
  const pair = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN';
  await page.route('https://api.dexscreener.com/**', async route => {
    const json = route.request().url().includes('profiles') ? [{ chainId: 'solana', tokenAddress: address }] : [{
      chainId: 'solana', pairAddress: pair, baseToken: { address, symbol: 'FIXTURE' }, priceUsd: '100',
      liquidity: { usd: 500000 }, volume: { h1: 200000 }, txns: { m5: { buys: 180, sells: 30 } },
      priceChange: { m5: 5 }, fdv: 10000000, pairCreatedAt: Date.now() - 7200000, dexId: 'test'
    }];
    await route.fulfill({ json });
  });
  await page.locator('#mode-live').click();
  if (await page.locator('#confirm-mode').isVisible()) await page.locator('#confirm-mode').click();
  await page.waitForFunction(() => document.querySelector('#candidates-body').textContent.includes('FIXTURE'));
  assert.match(await page.locator('#equity').textContent(), /1\.000\.000/);
  assert.match(await page.locator('#notice-text').textContent(), /PAPER \+ HARGA PASAR/);
  await page.locator('#toggle-run').click();
  await page.waitForFunction(() => document.querySelector('#positions-list').textContent.includes('FIXTURE'));
  assert.match(await page.locator('#cash').textContent(), /920\.000/);
  await page.screenshot({ path: 'test-results/fixture-position.png', fullPage: true });
  await page.locator('[data-close]').click();
  assert.match(await page.locator('#realized').textContent(), /[-−]/);
  const downloading = page.waitForEvent('download');
  await page.locator('[data-action="export"]').click();
  const download = await downloading;
  assert.match(download.suggestedFilename(), /^HENGKI-live-.*\.csv$/);
  await download.saveAs('test-results/journal-fixture.csv');
  await page.unroute('https://api.dexscreener.com/**');
  await page.route('https://api.dexscreener.com/**', route => route.abort('failed'));
  await page.locator('#refresh').click();
  await page.waitForFunction(() => document.querySelector('#error-banner').textContent.includes('gagal'));
  assert.match(await page.locator('#run-status').textContent(), /dijeda/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#mode-demo').click();
  if (await page.locator('#confirm-mode').isVisible()) await page.locator('#confirm-mode').click();
  await page.locator('.mobile-nav [data-action="settings"]').click();
  await page.locator('input[name="capital"]').fill('2000000');
  await page.locator('#settings-form button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#equity').textContent.includes('2.000.000'));
  const width = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.equal(width.client, width.scroll, 'Mobile document must not overflow horizontally');
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.locator('[data-action="gmgn-server"]').click();
  await page.locator('#gmgn-server-url').fill('http://bot.example.test');
  await page.locator('#gmgn-server-form button[type="submit"]').click();
  assert.match(await page.locator('#form-error').textContent(), /HTTPS/);
  await page.locator('#gmgn-server-url').fill('https://bot.example.test');
  await page.locator('#gmgn-server-form button[type="submit"]').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('hengki-gmgn-server')), 'https://bot.example.test');
  await page.locator('#modal-close').click();
  assert.deepEqual(errors, [], 'No unhandled JavaScript errors');
  const result = { ok: true, scenarios: [
    'desktop layout', 'six modules', 'start and restore paused', 'native lifecycle pause',
    'separate ledgers', 'market fixture entry', 'round-trip costs', 'CSV export',
    'API failure pause', 'settings reset', '390px layout', 'GMGN HTTPS validation', 'GMGN server address persistence'
  ], marketData: 'mocked', pageErrors: errors };
  await writeFile('test-results/result.json', JSON.stringify(result, null, 2));
  console.log('Browser integration checks passed: 13 scenarios, desktop and 390px mobile.');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

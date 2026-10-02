import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { exchangeIds } from '../public/exchanges.js';

const origin = process.env.DASHBOARD_URL || 'http://127.0.0.1:4180';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const now = Date.now();
const market = (hourlyRate, price) => ({ hourlyRate, price, nativeSymbol: 'LIT', rawRate: '0.0012', rateBasis: 'hourly percent',
  fetchedAt: now, sourceAt: now, priceFetchedAt: now, intervalHours: 1, settlement: 'USDG', volume: 1000000 });
const data = { at: now, sources: Object.fromEntries(exchangeIds.map(id => [id, { fetchedAt: now, count: 1 }])), rows: [
  { symbol: 'LIT', assetClass: 'crypto', nado: market(-.00001, 5), lighter_rh: market(.000012, 5.1) },
  { symbol: 'RHONLY', assetClass: 'crypto', lighter_rh: { ...market(0, 2), nativeSymbol: 'RHONLY' } },
] };
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1536, height: 1060 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/funding', route => route.fulfill({ json: data }));
  await page.route('**/api/history?*', route => route.fulfill({ json: [0, 1, 2].map(i => ({ at: now - 120000 + i * 60000, lighter_rh: .000012, nado: -.00001 })) }));
  await page.goto(origin);
  await page.locator('#rows tr[data-detail]').first().waitFor();
  assert.equal(await page.locator('[data-exchange]').count(), 5);
  assert.match(await page.locator('[data-exchange="lighter_rh"]').textContent(), /Robinhood Chain/);
  assert.match(await page.locator('[data-detail="LIT"] td[data-column="lighter_rh"]').textContent(), /0\.0096%/);
  assert.match(await page.locator('[data-detail="LIT"] .positions').textContent(), /LONGNADO.*SHORTLighter RH/);
  assert.equal(await page.locator('[data-detail="RHONLY"] td[data-column="nado"]').textContent(), '-');
  assert.equal(await page.locator('img[src="/assets/lighter-rh.png"]').first().evaluate(el => el.complete && el.naturalWidth > 0), true);
  for (const width of [1536, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 1060 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow ${width}`);
    const widths = await page.locator('th[data-column]').evaluateAll(els => els.map(el => el.getBoundingClientRect().width));
    assert.ok(Math.max(...widths) - Math.min(...widths) < 1);
    assert.equal(await page.locator('th[data-column="lighter_rh"]').evaluate(el => getComputedStyle(el).textAlign), 'center');
  }
  await page.screenshot({ path: 'screenshots/lighter-rh-mobile.png' });
  await page.setViewportSize({ width: 1536, height: 1060 });
  await page.locator('#rows [data-detail="LIT"]').click();
  assert.equal(await page.locator('.detail-rate').count(), 5);
  assert.match(await page.locator('.detail-rate').last().textContent(), /Lighter RH.*USDG/);
  assert.equal(await page.locator('.trade-links a').last().getAttribute('href'), 'https://robinhoodchain.lighter.xyz/trade/LIT');
  await page.locator('#chart-area svg').waitFor();
  assert.equal(await page.locator('#chart-area path[stroke-dasharray="8 3 2 3"]').count(), 1);
  await page.getByRole('button', { name: '상세 닫기' }).click();
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  const csv = await readFile(await (await download).path(), 'utf8');
  assert.match(csv, /lighter_rh_hourly_decimal/);
  await page.locator('[data-mode="gap"]').click();
  assert.match(await page.locator('[data-detail="LIT"] .spread-number').textContent(), /2\.0000%/);
  data.sources.lighter_rh.error = 'RH disconnected';
  await page.locator('#refresh').click();
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('RH disconnected'));
  assert.equal(await page.locator('[data-detail="LIT"] .spread-number').textContent(), '—');
  delete data.sources.lighter_rh.error;
  await page.locator('#refresh').click();
  await page.waitForFunction(() => !document.querySelector('#refresh').disabled);
  await page.locator('[data-mode="funding"]').click();
  await page.locator('[data-exchange="lighter_rh"]').click();
  assert.equal(await page.locator('#rows tr[data-detail]').count(), 1);
  await page.locator('[data-exchange="lighter_rh"]').click();
  await page.locator('#markets').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'screenshots/lighter-rh-five-exchanges.png' });
  assert.deepEqual(errors, []);
  console.log('Lighter RH UI passed: five exchanges, rate units, pair, logo, mobile, detail, RH trade URL, chart, CSV, outage/recovery, selection.');
} finally { await browser.close(); }

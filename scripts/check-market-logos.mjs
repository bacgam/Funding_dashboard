import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { marketLogos } from '../public/market-logos.js';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.DASHBOARD_URL || 'http://127.0.0.1:4180');
  await page.locator('.card').first().waitFor();
  await page.locator('#auto').uncheck();
  const broken = await page.evaluate(async logos => {
    const entries = Object.entries(logos), failures = [];
    let next = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (next < entries.length) {
        const [symbol, source] = entries[next++];
        const image = new Image();
        image.src = source;
        try { await image.decode(); if (!image.naturalWidth) failures.push(symbol); }
        catch { failures.push(symbol); }
      }
    }));
    return failures;
  }, marketLogos);
  assert.deepEqual(broken, [], 'Every collected logo must decode in the browser');
  assert.equal(await page.locator('.card .market-logo').count(), 3);
  assert.equal(await page.locator('#rows .market-logo').count(), await page.locator('#rows tr[data-detail]').count());
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.opportunities').offsetTop - 24));
  await page.screenshot({ path: 'screenshots/market-logos-desktop.png' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole('searchbox').fill('VVV');
    assert.equal(await page.locator('#rows .market-logo').isVisible(), true);
    await page.locator('#markets').scrollIntoViewIfNeeded();
    if (width === 390) await page.screenshot({ path: 'screenshots/market-logos-mobile.png' });
    await page.getByRole('searchbox').fill('');
  }
  await page.route(`**${marketLogos.VVV}`, route => route.fulfill({ status: 404, body: '' }));
  await page.reload();
  await page.getByRole('searchbox').fill('VVV');
  await page.locator('#rows .market-initials').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#rows .market-logo').count(), 0);
  await page.getByRole('searchbox').fill('BTC');
  await page.getByRole('searchbox').fill('VVV');
  assert.equal(await page.locator('#rows .market-initials').isVisible(), true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ logos: Object.keys(marketLogos).length, broken, cards: true, mobile: true, fallback: true, errors }));
} finally { await browser.close(); }

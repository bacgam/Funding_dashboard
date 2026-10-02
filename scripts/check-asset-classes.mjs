import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({channel:'msedge',headless:true});
const now = Date.now();
const market = (hourlyRate, price) => ({hourlyRate,price,sourceAt:now,fetchedAt:now,priceFetchedAt:now,volume:10000,intervalHours:1});
const data = {at:now,sources:Object.fromEntries(['nado','variational','hyperliquid','xyz'].map(id=>[id,{fetchedAt:now}])),rows:[
  {symbol:'BTC',name:'Bitcoin',assetClass:'crypto',nado:market(.001,100),variational:market(.002,101)},
  {symbol:'ETH',name:'Ethereum',assetClass:'crypto',nado:market(.001,100)},
  {symbol:'NVDA',name:'NVIDIA',assetClass:'rwa',nado:market(.001,100),variational:market(.004,104)},
  {symbol:'XAU',name:'Gold',assetClass:'rwa',nado:market(.001,100),variational:market(.005,105)},
]};
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/funding',route=>route.fulfill({json:data}));
  await page.goto(process.env.DASHBOARD_URL || 'http://127.0.0.1:4180');
  await page.locator('#rows tr[data-detail]').first().waitFor();
  const symbols=()=>page.locator('#rows tr[data-detail]').evaluateAll(rows=>rows.map(r=>r.dataset.detail).sort());
  const top=()=>page.locator('#top-cards').textContent();
  const summary=()=>page.locator('.overview').textContent();
  for(const mode of ['funding','gap']) {
    await page.locator(`[data-mode="${mode}"]`).click();
    assert.equal(await page.locator('[data-asset-class="crypto"]').getAttribute('aria-pressed'),'true');
    assert.deepEqual(await symbols(),['BTC','ETH']);
    const originalSummary=await summary(), originalTop=await top();
    assert.match(originalTop,/NVIDIA/); // RWA opportunities remain in TOP 3 with Crypto selected.
    await page.locator('[data-asset-class="rwa"]').click();
    assert.deepEqual(await symbols(),['NVDA','XAU']);
    assert.equal(await summary(),originalSummary);
    assert.equal(await top(),originalTop);
    const download=page.waitForEvent('download');await page.locator('#export').click();
    const csv=await readFile(await(await download).path(),'utf8');
    assert.match(csv,/"NVDA"/);assert.match(csv,/"XAU"/);assert.doesNotMatch(csv,/"BTC"/);
    await page.locator('#search').fill('NVDA');
    await page.locator('[data-asset-class="crypto"]').click();
    assert.equal(await page.locator('#search').inputValue(),'NVDA');
    assert.deepEqual(await symbols(),[]);
    await page.locator('#search').fill('');
    await page.locator('#common-only').check();
    assert.deepEqual(await symbols(),['BTC']);
    await page.locator('#common-only').uncheck();
    await page.locator('[data-asset-class="rwa"]').click();
    await page.locator(`[data-mode="${mode==='gap'?'funding':'gap'}"]`).click();
    assert.equal(await page.locator('[data-asset-class="rwa"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-asset-class="crypto"]').click();
  }
  await page.locator('[data-asset-class="rwa"]').click();
  await page.reload();await page.locator('#rows tr[data-detail]').first().waitFor();
  assert.deepEqual(await symbols(),['BTC','ETH']);
  await page.locator('[data-mode="gap"]').click();
  for(const width of [1440,1180,768,390,320]) {
    await page.setViewportSize({width,height:1000});
    await page.locator('[data-asset-class="rwa"]').click();assert.deepEqual(await symbols(),['NVDA','XAU']);
    await page.locator('[data-asset-class="crypto"]').click();assert.deepEqual(await symbols(),['BTC','ETH']);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  assert.deepEqual(errors,[]);
  console.log('Crypto/RWA passed: both pages, Crypto default, unchanged summary/TOP 3, CSV, search/common filters, navigation, reload, mobile.');
} finally { await browser.close(); }

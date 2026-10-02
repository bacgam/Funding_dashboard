import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin = process.env.DASHBOARD_URL || 'http://127.0.0.1:4180';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ids = ['nado','variational','hyperliquid','xyz'];
const now = Date.now();
const market = (hourlyRate, price, nativeSymbol = 'BTC') => ({ hourlyRate, price, nativeSymbol, sourceAt:null, fetchedAt:now, priceFetchedAt:now, intervalHours:1, settlement:'USDC', volume:1000000 });
// Synthetic categories keep venue layout checks independent of check-asset-classes.mjs.
const fixture = () => ({ at:now, sources:Object.fromEntries(ids.map(id=>[id,{fetchedAt:now}])), rows:[
  {symbol:'BTC',assetClass:'crypto',name:'Bitcoin',nado:market(.001,100),variational:market(-.001,105),hyperliquid:market(.004,101),xyz:market(.002,102,'xyz:BTC')},
  {symbol:'NVDA',assetClass:'crypto',name:'NVIDIA',variational:market(.001,120,'NVDA'),xyz:market(.003,122,'xyz:NVDA')},
  {symbol:'ONLY',assetClass:'crypto',name:'Only Hyperliquid',xyz:market(0,10,'xyz:ONLY')},
] });
const errors = [];
try {
  const page = await browser.newPage({viewport:{width:1536,height:1060}});
  page.on('pageerror',e=>errors.push(e.message));
  let data = fixture();
  await page.route('**/api/funding',route=>route.fulfill({json:data}));
  await page.route('**/api/history?*',route=>route.fulfill({json:[0,1,2].map(i=>({at:now-120000+i*60000,nado:.001,variational:-.001,hyperliquid:.004,xyz:.002}))}));
  await page.goto(origin);
  await page.locator('#rows tr[data-detail]').first().waitFor();
  assert.equal(await page.locator('[data-exchange]').count(),5);
  await page.locator('[data-exchange="lighter_rh"]').click();
  assert.equal(await page.locator('#common-only').isChecked(),false);
  assert.equal(await page.locator('#rows tr[data-detail]').count(),3);
  assert.equal(await page.locator('[data-detail="NVDA"] td[data-column="nado"]').textContent(),'-');
  assert.equal(await page.locator('[data-detail="ONLY"] td[data-column="variational"]').textContent(),'-');
  assert.match(await page.locator('[data-detail="BTC"] .positions').textContent(),/LONGVariational.*SHORTHyperliquid/);
  assert.match(await page.locator('[data-detail="BTC"] .spread-number').textContent(),/4\.0000%/);
  assert.match(await page.locator('[data-detail="BTC"] td[data-column="xyz"]').textContent(),/1\.6000%/);
  assert.equal(await page.locator('[data-detail="NVDA"] td[data-column="hyperliquid"]').textContent(),'-');
  const widths = () => page.locator('th[data-column]:visible').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().width));
  const three = await widths();
  assert.ok(Math.max(...three)-Math.min(...three)<1);
  await page.locator('[data-exchange="variational"]').click();
  await page.locator('[data-exchange="xyz"]').click();
  const two = await widths();
  assert.ok(two[0]>three[0]);
  assert.ok(Math.abs(two[0]-two[1])<1);
  assert.match(await page.locator('[data-detail="BTC"] .positions').textContent(),/LONGNADO.*SHORTHyperliquid/);
  assert.match(await page.locator('[data-detail="BTC"] .spread-number').textContent(),/2\.4000%/);
  await page.locator('#common-only').check();
  assert.equal(await page.locator('#rows tr[data-detail]').count(),1);
  await page.locator('#common-only').uncheck();
  await page.locator('[data-exchange="nado"]').click();
  assert.equal((await widths()).length,1);
  assert.equal(await page.locator('.card').count(),0);
  await page.locator('[data-exchange="hyperliquid"]').click();
  assert.equal(await page.locator('#rows tr[data-detail]').count(),0);
  assert.equal(await page.locator('#rows td').getAttribute('colspan'),'5');
  for(const id of ids) await page.locator(`[data-exchange="${id}"]`).click();
  await page.locator('#common-only').check();
  assert.equal(await page.locator('#rows tr[data-detail]').count(),2);
  await page.locator('#common-only').uncheck();
  await page.locator('[data-mode="gap"]').click();
  assert.match(await page.locator('[data-detail="BTC"] .spread-number').textContent(),/5\.0000%/);
  assert.match(await page.locator('[data-detail="BTC"] .positions').textContent(),/LONGNADO.*SHORTVariational/);
  assert.equal(await page.locator('[data-detail="NVDA"] td[data-column="nado"]').textContent(),'-');
  await page.locator('#rows [data-detail="NVDA"]').click();
  assert.equal(await page.locator('.detail-rate').count(),4);
  assert.match(await page.locator('.detail-rate').last().textContent(),/xyz:NVDA/);
  assert.match(await page.locator('.trade-links a').last().getAttribute('href'),/xyz%3ANVDA/);
  await page.locator('#chart-area svg').waitFor();
  assert.equal(await page.locator('#chart-area path').count(),4);
  assert.equal(await page.locator('#chart-area path[stroke-dasharray]').count(),2);
  await page.locator('#cost').fill('0');
  assert.equal(await page.locator('#calc-output strong').first().textContent(),'$480.00');
  await page.getByRole('button',{name:'상세 닫기'}).click();
  const downloading = page.waitForEvent('download');
  await page.locator('#export').click();
  const csv = await readFile(await (await downloading).path(),'utf8');
  assert.match(csv,/hyperliquid_mark_price/); assert.match(csv,/xyz_mark_price/); assert.match(csv,/xyz:NVDA/);
  assert.match(csv,/"NVDA","","120","","122"/);
  data = fixture(); data.sources.xyz.error = 'HTTP 429';
  await page.locator('#refresh').click();
  await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('429'));
  assert.equal(await page.locator('[data-detail="NVDA"] .spread-number').textContent(),'—');
  assert.match(await page.locator('[data-detail="BTC"] .positions').textContent(),/NADO.*Variational/);
  assert.match(await page.locator('[data-detail="BTC"] td[data-column="hyperliquid"]').textContent(),/\$101\.00/);
  data = fixture(); await page.locator('#refresh').click();
  await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  await page.locator('[data-mode="funding"]').click();
  await page.locator('#markets').scrollIntoViewIfNeeded();
  await page.screenshot({path:'screenshots/hyperliquid-four-exchanges.png'});
  for(const width of [1440,1180,1024,768,390,320]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow at ${width}`);
    const w = await widths(); assert.ok(Math.max(...w)-Math.min(...w)<1);
  }
  await page.locator('#rows [data-detail="NVDA"]').click();
  assert.equal(await page.locator('#detail').evaluate(el=>el.scrollWidth>el.clientWidth),false);
  await page.getByRole('button',{name:'상세 닫기'}).click();
  await page.screenshot({path:'screenshots/hyperliquid-mobile.png'});

  // An additional registry entry must automatically add its filter/column and rebalance widths.
  const extra = await browser.newPage({viewport:{width:1536,height:1060}});
  extra.on('pageerror',e=>errors.push(e.message));
  const registry = await readFile(new URL('../public/exchanges.js',import.meta.url),'utf8');
  await extra.route('**/exchanges.js',route=>route.fulfill({contentType:'text/javascript',body:registry.replace('\n];',"\n  {id:'extra',name:'Example',logo:'/assets/nado.png',description:'Test',url:'https://example.com',color:'var(--positive)'},\n];")}));
  const four = fixture(); four.sources.extra = {fetchedAt:now}; four.rows[0].extra = market(-.004,99);
  await extra.route('**/api/funding',route=>route.fulfill({json:four}));
  await extra.goto(origin);
  await extra.locator('#rows tr[data-detail]').first().waitFor();
  assert.equal(await extra.locator('[data-exchange]').count(),6);
  const fourWidths = await extra.locator('th[data-column]:visible').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().width));
  assert.ok(Math.max(...fourWidths)-Math.min(...fourWidths)<1);
  assert.ok(fourWidths[0]<three[0]);
  assert.match(await extra.locator('[data-detail="BTC"] .positions').textContent(),/LONGExample.*SHORTHyperliquid/);
  assert.deepEqual(errors,[]);
  console.log('Hyperliquid UI passed: 0–5 exchanges, equal/resizing columns, missing listings, selected pairs, stock details, chart, CSV, partial outage, mobile.');
} finally { await browser.close(); }

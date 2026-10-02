import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const origin=process.env.DASHBOARD_URL || 'http://127.0.0.1:4180';
const browser=await chromium.launch({channel:'msedge',headless:true});
const market=(price,extra={})=>({price,priceFetchedAt:Date.now(),fetchedAt:Date.now(),sourceAt:Date.now(),hourlyRate:.001,intervalHours:1,volume:1000000,settlement:'USDC',...extra});
const row=(symbol,a,b)=>({symbol,name:symbol,nado:a,variational:b,comparable:true,spreadHourly:.001,long:'variational',short:'nado'});
function fixture(){return {at:Date.now(),sources:{nado:{fetchedAt:Date.now()},variational:{fetchedAt:Date.now()}},rows:[
  row('BTC',market(100,{hourlyRate:.002}),market(102)),
  row('ETH',market(105),market(100)),
  row('PEPE',market(.00001),market(.000011)),
  row('EQUAL',market(100),market(100)),
  row('MISSING',market(null),market(100)),
  row('SKEW',market(100,{priceFetchedAt:Date.now()-45000}),market(110)),
  row('SINGLE',undefined,market(100))
]};}
try {
  const page=await browser.newPage({viewport:{width:1440,height:1050}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let data=fixture();
  await page.route('**/api/funding',route=>route.fulfill({json:data}));
  await page.route('**/api/history?*',route=>route.fulfill({json:[]}));
  await page.goto(origin);
  await page.locator('[data-mode="gap"]').click();
  await page.waitForFunction(()=>document.querySelector('#common-count').textContent==='4');
  assert.equal(await page.locator('#periods').isVisible(),false);
  assert.equal(await page.locator('.card').first().getAttribute('data-detail'),'PEPE');
  assert.match(await page.locator('.card').first().textContent(),/10\.0000%/);
  await page.getByRole('searchbox').fill('BTC');
  assert.match(await page.locator('#rows .spread-number').textContent(),/2\.0000%/);
  assert.match(await page.locator('#rows .positions').textContent(),/LONGNADO.*SHORTVariational/);
  await page.locator('[data-unit="bps"]').click();
  assert.match(await page.locator('#rows .spread-number').textContent(),/200\.00/);
  await page.locator('[data-unit="percent"]').click();
  await page.locator('#rows tr[data-detail]').click();
  assert.equal(await page.locator('#detail-gap').isVisible(),true);
  assert.match(await page.locator('#detail-gap').textContent(),/-1\.9608%/);
  assert.match(await page.locator('#detail-gap .calc-explain').textContent(),/-0\.8000%/);
  assert.match(await page.locator('#calc-position').textContent(),/LONGVariational.*SHORTNADO/);
  await page.locator('#cost').fill('20');
  assert.equal(await page.locator('.detail-rate img').count(),3);
  await page.getByRole('button',{name:'상세 닫기'}).click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();
  const download=await downloadPromise;assert.match(download.suggestedFilename(),/^price-gap-/);
  const csv=await readFile(await download.path(),'utf8');assert.match(csv,/gap_decimal_low_basis/);assert.match(csv,/"BTC","100","102","","2","0.02"/);
  await page.locator('[data-exchange="variational"]').click();
  assert.equal(await page.locator('#rows .spread-number').textContent(),'—');
  assert.equal(await page.locator('.card').count(),0);
  await page.locator('[data-exchange="variational"]').click();
  await page.getByRole('searchbox').fill('');
  await page.locator('[data-sort="spread"]').click();
  assert.equal(await page.locator('#rows tr').first().getAttribute('data-detail'),'EQUAL');
  await page.locator('[data-sort="spread"]').click();
  await page.locator('#markets').scrollIntoViewIfNeeded();
  await page.screenshot({path:'screenshots/gap-desktop-fixture.png'});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('searchbox').fill('PEPE');
  assert.match(await page.locator('#rows .price-cell').first().textContent(),/0\.00001/);
  await page.locator('#rows tr').click();
  assert.equal(await page.evaluate(()=>document.querySelector('#detail').scrollWidth>document.querySelector('#detail').clientWidth),false);
  await page.screenshot({path:'screenshots/gap-detail-mobile-fixture.png'});
  await page.getByRole('button',{name:'상세 닫기'}).click();
  await page.getByRole('searchbox').fill('SKEW');assert.equal(await page.locator('#rows .spread-number').textContent(),'—');
  await page.getByRole('searchbox').fill('MISSING');assert.equal(await page.locator('#rows .spread-number').textContent(),'—');
  await page.getByRole('searchbox').fill('');
  data=fixture();data.sources.nado.error='HTTP 429';await page.locator('#refresh').click();
  await page.waitForFunction(()=>document.querySelector('#common-count').textContent==='0');assert.equal(await page.locator('.card').count(),0);
  data=fixture();data.rows.forEach(r=>{if(r.nado)r.nado.priceFetchedAt-=121000;if(r.variational)r.variational.priceFetchedAt-=121000;});
  await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#refresh').disabled===false);
  assert.equal(await page.locator('.card').count(),0);assert.equal(await page.locator('#common-count').textContent(),'0');
  data=fixture();await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#common-count').textContent==='4');
  await page.locator('#menu-toggle').click();
  await page.locator('[data-mode="funding"]').click();assert.equal(await page.locator('#periods').isVisible(),true);
  await page.locator('[data-hours="8760"]').click();assert.match(await page.locator('#basis').textContent(),/APR/);
  assert.deepEqual(errors,[]);
  console.log('Gap browser checks passed: math, direction, funding distinction, BPS, sort, filters, CSV, precision, stale/error states, mobile, mode switching');
}finally{await browser.close();}

import test from 'node:test';
import assert from 'node:assert/strict';
import { priceGap } from '../public/price-gap.js';
import { parseNado, parseVariational, mergeMarkets } from '../server/markets.mjs';
const now = 1788800000000;
const market = (price, extra = {}) => ({symbol:'BTC', price, priceFetchedAt:now, fetchedAt:now, sourceAt:now, hourlyRate:.001, ...extra});
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-12, `${a} != ${b}`);

test('gap uses lower price as denominator and preserves signed NADO premium', () => {
  const row = priceGap(market(100),market(102),now);
  assert.equal(row.priceGap,2); near(row.priceGapRatio,.02); near(row.nadoPremium,-2/102);
  assert.equal(row.priceLong,'nado'); assert.equal(row.priceShort,'variational');
  const reversed=priceGap(market(102),market(100),now);
  near(reversed.priceGapRatio,.02);near(reversed.nadoPremium,.02);assert.equal(reversed.priceLong,'variational');
});
test('equal prices have zero gap and no direction', () => {
  const row=priceGap(market(100),market(100),now);
  assert.equal(row.priceComparable,true);assert.equal(row.priceGapRatio,0);assert.equal(row.priceLong,null);assert.equal(row.priceShort,null);
});
test('missing, zero, negative, nonfinite prices and one-sided listings have no gap', () => {
  for(const price of [undefined,null,0,-1,NaN,Infinity,'100']) {
    const row=priceGap(market(price),market(100),now);assert.equal(row.priceComparable,false);assert.equal(row.priceGap,null);
  }
  assert.equal(priceGap(undefined,market(100),now).priceComparable,false);
});
test('price age, source failure, missing time, future time and receive skew suppress gap', () => {
  for(const extra of [{priceFetchedAt:now-120001},{priceStale:true},{priceFetchedAt:null},{priceFetchedAt:now+60001},{priceFetchedAt:now-30001}]) {
    assert.equal(priceGap(market(100,extra),market(102),now).priceComparable,false);
  }
  assert.equal(priceGap(market(100,{priceFetchedAt:now-30000}),market(102),now).priceComparable,true);
  assert.equal(priceGap(market(100,{priceFetchedAt:now-120001}),market(102,{priceFetchedAt:now-120001}),now).priceComparable,false);
});
test('gap direction can incur funding expense, independent of funding direction', () => {
  const row=mergeMarkets({nado:{markets:[market(100,{hourlyRate:.002})]},variational:{markets:[market(102,{hourlyRate:.001})]}},now)[0];
  assert.equal(row.long,'variational');assert.equal(row.priceLong,'nado');near(row.gapFundingHourly,-.001);
});
test('fresh prices remain comparable when funding timestamp or rate is unavailable', () => {
  const row=mergeMarkets({nado:{markets:[market(100,{sourceAt:null,hourlyRate:null})]},variational:{markets:[market(102)]}},now)[0];
  assert.equal(row.comparable,false);assert.equal(row.priceComparable,true);assert.equal(row.gapFundingHourly,null);
});
test('failed source suppresses price comparison even while cached prices remain fresh', () => {
  const row=mergeMarkets({nado:{markets:[market(100)],error:'HTTP 429'},variational:{markets:[market(102)]}},now)[0];
  assert.equal(row.nado.priceStale,true);assert.equal(row.priceComparable,false);assert.equal(row.priceLong,null);
});
test('thousand-unit contracts compare with unscaled underlying and retain price receive time', () => {
  const nado=parseNado({data:{symbols:{PEPE:{symbol:'kPEPE-PERP',type:'perp',trading_status:'live',product_id:2}}}},
    {PEPE:{product_id:2,mark_price:.01}},{2:{funding_rate_x18:'0',update_time:now/1000}},now,now-1000)[0];
  const variational=parseVariational({listings:[{ticker:'PEPE',mark_price:.000011,funding_rate:0,funding_interval_s:3600,quotes:{updated_at:'2020-01-01'}}]},now)[0];
  assert.equal(nado.priceFetchedAt,now-1000);assert.equal(variational.priceFetchedAt,now);
  near(priceGap(nado,variational,now).priceGapRatio,.1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHyperliquid, hyperliquidSymbol, selectHyperliquidMarkets, createHyperliquidFetcher } from '../server/hyperliquid.mjs';
import { compareMarkets } from '../public/comparison.js';
import { mergeMarkets } from '../server/markets.mjs';

const now = 1800000000000;
const payload = (name = 'BTC', funding = '0.0000125') => [{ universe: [{ name }], collateralToken: 0 }, [{ funding, markPx: '100', openInterest: '2', dayNtlVlm: '1000' }]];
test('Hyperliquid hourly funding, USD open interest and thousand-unit prices', () => {
  const market = parseHyperliquid(payload('kPEPE'), now)[0];
  assert.equal(market.hourlyRate, .0000125);
  assert.equal(market.price, .1);
  assert.equal(market.symbol, 'PEPE');
  assert.equal(market.openInterest, 200);
  assert.equal(market.intervalHours, 1);
  assert.equal(market.sourceAt, null);
  assert.ok(market.nextFundingAt > now);
  for (const rate of [null, '', 'bad']) assert.equal(parseHyperliquid(payload('BTC', rate), now)[0].hourlyRate, null);
  assert.equal(parseHyperliquid(payload('BTC', '0'), now)[0].hourlyRate, 0);
  assert.equal(parseHyperliquid(payload('BTC', '-0.001'), now)[0].hourlyRate, -.001);
});
test('delisted entries retain context indexing; malformed payload and unknown collateral rejected', () => {
  const data = [{universe:[{name:'OLD',isDelisted:true},{name:'BTC'}],collateralToken:0},[{funding:'99'},payload()[1][0]]];
  assert.equal(parseHyperliquid(data, now)[0].hourlyRate, .0000125);
  assert.throws(() => parseHyperliquid([data[0], []], now));
  assert.throws(() => parseHyperliquid([{...data[0],collateralToken:9999},data[1]], now));
});
test('stock identities merge explicitly; colliding tickers and unknown contracts remain separate', () => {
  assert.equal(hyperliquidSymbol('xyz:NVDA','xyz').symbol, 'NVDA');
  assert.equal(hyperliquidSymbol('para:STX','para').symbol, 'para:STX');
  assert.equal(hyperliquidSymbol('xyz:QNT','xyz').symbol, 'xyz:QNT');
  assert.equal(hyperliquidSymbol('flx:GAS','flx').symbol, 'flx:GAS');
  assert.equal(hyperliquidSymbol('xyz:BRENTOIL','xyz').symbol, 'BZ');
  assert.equal(hyperliquidSymbol('xyz:SILVER','xyz').symbol, 'XAG');
  assert.deepEqual(hyperliquidSymbol('hyna:1000PEPE','hyna'), {symbol:'PEPE',multiplier:1000});
  assert.deepEqual(parseHyperliquid(payload('flx:NVDA'),now,'flx'), []);
  const markets = parseHyperliquid(payload('xyz:NVDA'),now,'xyz');
  assert.equal(selectHyperliquidMarkets(markets)[0].nativeSymbol, 'xyz:NVDA');
});
const market = (hourlyRate, price, extra = {}) => ({symbol:'BTC',hourlyRate,price,fetchedAt:now,priceFetchedAt:now,sourceAt:now,...extra});
test('three-venue extrema and selected pair are recomputed independently for prices and funding', () => {
  const row = {nado:market(.001,100),variational:market(-.001,105),hyperliquid:market(.004,101)};
  const all = compareMarkets(row, Object.keys(row), now);
  assert.equal(all.long, 'variational'); assert.equal(all.short, 'hyperliquid');
  assert.equal(all.spreadHourly, .005);
  assert.equal(all.priceLong, 'nado'); assert.equal(all.priceShort, 'variational');
  assert.equal(all.priceGapRatio, .05); assert.equal(all.gapFundingHourly, -.002);
  const pair = compareMarkets(row, ['nado','hyperliquid'], now);
  assert.equal(pair.spreadHourly, .003); assert.equal(pair.priceGapRatio, .01);
  assert.equal(compareMarkets(row, ['hyperliquid'],now).spreadHourly, null);
});
test('missing and failed venues never become zero; healthy remaining pair still compares', () => {
  const rows = mergeMarkets({nado:{markets:[market(.001,100)]},variational:{markets:[]},hyperliquid:{markets:[market(.003,105)]}},now);
  assert.equal(rows[0].variational, undefined); assert.equal(rows[0].spreadHourly,.002);
  const row = {nado:market(.001,100),variational:market(.002,101),hyperliquid:market(9,200,{stale:true,priceStale:true})};
  const result = compareMarkets(row,Object.keys(row),now);
  assert.equal(result.short,'variational'); assert.equal(result.priceShort,'variational');
  assert.equal(compareMarkets({...row,nado:null},['nado','hyperliquid'],now).comparable,false);
});
test('HIP-3 caches for 30 seconds, preserves contract on failure and recovers independently', async t => {
  let clock = now, failXyz = false;
  t.mock.method(Date, 'now', () => clock);
  const calls = [];
  const fetcher = createHyperliquidFetcher(async (_url, body) => {
    calls.push(body);
    if (body.type === 'perpDexs') return [null,{name:'xyz'}];
    if (body.dex === 'xyz' && failXyz) throw new Error('HTTP 429');
    return payload(body.dex ? 'xyz:NVDA' : 'BTC');
  });
  const first = await fetcher(); assert.equal(first.markets.length,2);
  clock += 5000; await fetcher();
  assert.equal(calls.filter(c => c.dex === 'xyz').length,1);
  clock += 25000; failXyz = true;
  const failed = await fetcher();
  assert.match(failed.warning,/429/);
  assert.equal(failed.markets.find(m=>m.symbol==='NVDA').sourceError,'HTTP 429');
  assert.equal(failed.markets.find(m=>m.symbol==='BTC').sourceError,null);
  assert.equal(failed.groups.hyperliquid.error, null);
  assert.match(failed.groups.xyz.error, /429/);
  clock += 30000; failXyz = false;
  assert.equal((await fetcher()).warning,null);
});

test('base and XYZ contracts of the same asset survive selection and compare independently', () => {
  const base = parseHyperliquid(payload('NVDA', '.001'), now)[0];
  const hip3 = parseHyperliquid(payload('xyz:NVDA', '.002'), now, 'xyz')[0];
  const selected = selectHyperliquidMarkets([hip3, base]);
  assert.equal(selected.length, 2);
  const row = mergeMarkets({hyperliquid:{markets:[base]},xyz:{markets:[hip3]}},now)[0];
  assert.equal(row.hyperliquid.nativeSymbol, 'NVDA');
  assert.equal(row.xyz.nativeSymbol, 'xyz:NVDA');
  assert.equal(row.long, 'hyperliquid');
  assert.equal(row.short, 'xyz');
  assert.equal(row.spreadHourly, .001);
  assert.equal(compareMarkets(row, ['hyperliquid'], now).comparable, false);
});

test('base failure does not suppress XYZ; other discovered DEXes are never requested', async t => {
  t.mock.method(Date, 'now', () => now);
  const fetcher = createHyperliquidFetcher(async (_url, body) => {
    if (body.type === 'perpDexs') return [null,{name:'hyna'},{name:'xyz'},{name:'para'},{name:'io'},{name:'mkts'}];
    if (!body.dex) throw new Error('HTTP 503');
    assert.equal(body.dex, 'xyz');
    return payload('xyz:NVDA', '.002');
  });
  const {groups} = await fetcher();
  assert.match(groups.hyperliquid.error, /503/);
  assert.equal(groups.xyz.error, null);
  assert.equal(groups.xyz.warning, null);
  assert.equal(groups.xyz.markets[0].hourlyRate, .002);
});

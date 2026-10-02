import test from 'node:test';
import assert from 'node:assert/strict';
import { number, canonical, parseNado, parseVariational, mergeMarkets } from '../server/markets.mjs';
const now = Date.now();
const symbols = { data: { symbols: { BTC: { type:'perp', symbol:'BTC-PERP', product_id:2, trading_status:'live' }, ETH: { type:'perp', symbol:'ETH-PERP', product_id:4, trading_status:'not_tradable' } } } };
const contracts = { BTC: { product_id:2, mark_price:60000, quote_volume:12345, open_interest_usd:999, next_funding_rate_timestamp:Math.floor(now/1000)+3600 } };
const rates = { 2: { funding_rate_x18:'300000000000000', update_time:String(Math.floor(now/1000)) } };
const listing = { ticker:'BTC', name:'Bitcoin', funding_rate:'0.1095', funding_interval_s:28800, mark_price:'60000', open_interest:{long_open_interest:'20',short_open_interest:'30'} };
function near(a,b) {assert.ok(Math.abs(a-b)<1e-12, `${a} != ${b}`);}
test('NADO daily x18 becomes hourly rate; non-live markets excluded',()=>{const a=parseNado(symbols,contracts,rates,now);assert.equal(a.length,1);near(a[0].hourlyRate,.0003/24);assert.equal(a[0].intervalHours,1);});
test('Variational annual decimal is divided by 8760, not settlement interval',()=>{const a=parseVariational({listings:[listing,{...listing,funding_interval_s:14400}]},now);near(a[0].hourlyRate,.0000125);near(a[0].hourlyRate,a[1].hourlyRate);assert.equal(a[0].intervalHours,8);assert.equal(a[1].intervalHours,4);assert.equal(a[0].openInterest,50);});
test('equal daily and annual funding produce zero spread and no direction',()=>{const rows=mergeMarkets({nado:{markets:parseNado(symbols,contracts,rates,now)},variational:{markets:parseVariational({listings:[listing]},now)}},now);near(rows[0].spreadHourly,0);assert.equal(rows[0].long,null);assert.equal(rows[0].short,null);});
for (const [a,b,long] of [[.002,.001,'variational'],[-.002,-.001,'nado'],[-.001,.001,'nado']]) {
  test(`correct long/short sign for ${a} and ${b}`,()=>{const m={symbol:'BTC',fetchedAt:now,sourceAt:now};const r=mergeMarkets({nado:{markets:[{...m,hourlyRate:a}]},variational:{markets:[{...m,hourlyRate:b}]}},now)[0];assert.equal(r.long,long);near(r.spreadHourly,Math.abs(a-b));});
}
test('missing funding never becomes zero',()=>{for(const value of [null,undefined,'',true,'bad',Infinity])assert.equal(number(value),null);assert.equal(number('0'),0);const r=parseVariational({listings:[{...listing,funding_rate:undefined}]},now)[0];assert.equal(r.hourlyRate,null);assert.equal(parseNado(symbols,contracts,{},now)[0].hourlyRate,null);});
test('missing or invalid interval suppresses Variational comparison',()=>{for(const value of [0,null,undefined,-1,'bad'])assert.equal(parseVariational({listings:[{...listing,funding_interval_s:value}]},now)[0].hourlyRate,null);});
test('old quote timestamp is not funding timestamp',()=>{const m=parseVariational({listings:[{...listing,quotes:{updated_at:'2020-01-01'}}]},now)[0];assert.equal(m.sourceAt,null);assert.ok(m.quoteAt<now);});
test('stale source or failed fetch cannot produce an opportunity',()=>{const m={symbol:'BTC',fetchedAt:now,sourceAt:now,hourlyRate:.001};for(const source of [{markets:[m],error:'HTTP 429'},{markets:[{...m,sourceAt:now-121000}]},{markets:[{...m,fetchedAt:now-121000}]}]){const r=mergeMarkets({nado:source,variational:{markets:[{...m,hourlyRate:.002}]}},now)[0];assert.equal(r.comparable,false);assert.equal(r.spreadHourly,null);assert.equal(r.long,null);}});
test('single exchange is retained without a fabricated spread',()=>{const r=mergeMarkets({variational:{markets:parseVariational({listings:[listing]},now)}},now)[0];assert.equal(r.symbol,'BTC');assert.equal(r.spreadHourly,null);});
test('explicit thousand-token mapping converts price, not funding rate',()=>{assert.deepEqual(canonical('kPEPE-PERP'),{symbol:'PEPE',multiplier:1000});assert.deepEqual(canonical('kUNKNOWN-PERP'),{symbol:'kUNKNOWN',multiplier:1});const s={data:{symbols:{PEPE:{...symbols.data.symbols.BTC,symbol:'kPEPE-PERP'}}}};const m=parseNado(s,contracts,rates,now)[0];assert.equal(m.price,60);near(m.hourlyRate,.0003/24);});
test('invalid response shape is rejected',()=>{assert.throws(()=>parseVariational({},now));assert.throws(()=>parseNado({},contracts,rates,now));});
test('non-numeric coercions are not treated as rates',()=>{for(const v of [' ',[],{},false])assert.equal(number(v),null);});
test('NADO without source timestamp cannot be compared',()=>{const m={symbol:'BTC',fetchedAt:now,sourceAt:null,hourlyRate:.001};const r=mergeMarkets({nado:{markets:[m]},variational:{markets:[{...m,hourlyRate:.002}]}},now)[0];assert.equal(r.comparable,false);});

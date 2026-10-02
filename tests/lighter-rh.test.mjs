import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLighterRh, createLighterRhFetcher, fetchLighterRhStats, LIGHTER_RH_BOOKS, LIGHTER_RH_STREAM } from '../server/lighter-rh.mjs';
import { mergeMarkets } from '../server/markets.mjs';
import { classifyMarket } from '../public/asset-classes.js';

const at = 1790387865184;
const book = (symbol = 'LIT', market_id = 5, extra = {}) => ({ symbol, market_id, market_type: 'perp', status: 'active', ...extra });
const books = (...items) => ({ code: 200, order_book_details: items.length ? items : [book()] });
const packet = (extra = {}, timestamp = at) => ({ channel: 'market_stats:all', timestamp,
  market_stats: { 5: { symbol: 'LIT', market_id: 5, current_funding_rate: '0.0012', funding_rate: '-0.2',
    funding_timestamp: at - 3600000, mark_price: '4.89', last_trade_price: '8',
    open_interest: '3967284.48', daily_quote_token_volume: 11740640.62, ...extra } } });

test('RH current estimate is hourly percent; mark and OI use websocket values', () => {
  const [m] = parseLighterRh(books(), packet(), at);
  assert.equal(m.hourlyRate, .0012 / 100);
  assert.equal(m.hourlyRate * 8 * 100, .0096);
  assert.equal(m.exchange, 'lighter_rh');
  assert.equal(m.settlement, 'USDG');
  assert.equal(m.price, 4.89);
  assert.equal(m.openInterest, 3967284.48);
  assert.equal(m.sourceAt, at);
  assert.ok(m.nextFundingAt > at);
  assert.equal(parseLighterRh(books(), packet({ current_funding_rate: '0' }), at)[0].hourlyRate, 0);
  assert.equal(parseLighterRh(books(), packet({ current_funding_rate: '-0.02' }), at)[0].hourlyRate, -.0002);
});

test('missing/invalid rates never fall back to previous funding or other venues', () => {
  for (const value of [undefined, null, '', 'NaN', false]) {
    assert.equal(parseLighterRh(books(), packet({ current_funding_rate: value }), at)[0].hourlyRate, null);
  }
  const [m] = parseLighterRh(books(), packet({ symbol: 'BTC' }), at);
  assert.equal(m.hourlyRate, null);
  assert.equal(m.price, null);
  assert.equal(parseLighterRh(books(book('ETH', 0)), packet(), at)[0].hourlyRate, null);
  assert.throws(() => parseLighterRh({ code: 500 }, packet(), at));
  assert.throws(() => parseLighterRh(books(), packet({}, null), at));
});

test('only active perpetuals, with distinct Robinhood AI identity and RWA categories', () => {
  const data = books(book(), book('BTC', 1, { status: 'inactive' }), book('USDG', 2, { market_type: 'spot' }), book('AI', 45));
  const markets = parseLighterRh(data, packet(), at);
  assert.deepEqual(markets.map(m => m.symbol), ['LIT', 'lighter_rh:AI']);
  assert.equal(classifyMarket(markets[1]), 'crypto');
  for (const symbol of ['ASTS', 'CLSK', 'LUNR', 'QBTS', 'RGTI', 'SGOV', 'SLV', 'USO', 'WULF', 'SHEIN', 'AMC']) {
    assert.equal(classifyMarket({ symbol }), 'rwa', symbol);
  }
});

test('old and future stream timestamps exclude funding and prices despite fresh receipt', () => {
  for (const timestamp of [at - 120001, at + 60001]) {
    const markets = parseLighterRh(books(), packet({}, timestamp), at);
    const [row] = mergeMarkets({ lighter_rh: { markets } }, at);
    assert.equal(row.lighter_rh.stale, true);
    assert.equal(row.lighter_rh.priceStale, true);
  }
});

test('fetcher uses RH host, caches discovery for a minute, and propagates outages', async t => {
  let now = at, calls = 0, failed = false;
  t.mock.method(Date, 'now', () => now);
  const fetcher = createLighterRhFetcher(async url => {
    assert.equal(url, LIGHTER_RH_BOOKS); assert.equal(new URL(url).hostname, 'api.rh.lighter.xyz');
    calls++; return books();
  }, async () => { if (failed) throw Error('disconnected'); return packet({}, now); });
  await fetcher(); now += 5000; await fetcher(); assert.equal(calls, 1);
  now += 60000; await fetcher(); assert.equal(calls, 2);
  failed = true; await assert.rejects(fetcher, /disconnected/);
});

class FakeSocket extends EventTarget {
  static instance;
  constructor(url) { super(); assert.equal(url, LIGHTER_RH_STREAM); FakeSocket.instance = this; this.sent = []; queueMicrotask(() => this.dispatchEvent(new Event('open'))); }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { this.closed = true; this.dispatchEvent(new Event('close')); }
  message(data) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
}
test('snapshot stream subscribes once, handles ping, ignores partial updates, and closes', async () => {
  const pending = fetchLighterRhStats(FakeSocket);
  await Promise.resolve();
  const socket = FakeSocket.instance;
  socket.message({ type: 'ping' });
  socket.message({ ...packet(), type: 'update/market_stats' });
  assert.equal(socket.closed, undefined);
  socket.message({ ...packet(), type: 'subscribed/market_stats' });
  assert.equal((await pending).timestamp, at);
  assert.deepEqual(socket.sent, [{ type: 'subscribe', channel: 'market_stats/all' }, { type: 'pong' }]);
  assert.equal(socket.closed, true);
});
test('stream timeout, early close, API error and invalid JSON reject and close', async () => {
  await assert.rejects(fetchLighterRhStats(FakeSocket, 5), /시간 초과/);
  assert.equal(FakeSocket.instance.closed, true);
  for (const trigger of [s => s.close(), s => s.message({ type: 'error' }), s => s.dispatchEvent(new MessageEvent('message', { data: '{' }))]) {
    const pending = fetchLighterRhStats(FakeSocket);
    trigger(FakeSocket.instance);
    await assert.rejects(pending);
    assert.equal(FakeSocket.instance.closed, true);
  }
});

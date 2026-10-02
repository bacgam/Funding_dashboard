import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createFeed, endpoints } from '../server/feed.mjs';

test('legacy history stays readable without assigning mixed Hyperliquid rates to split groups', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'funding-feed-test-'));
  t.after(async () => {
    const target = resolve(directory);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith('funding-feed-test-'));
    await rm(target, { recursive: true, force: true });
  });
  const at = Date.now();
  await writeFile(join(directory, 'history.json'), JSON.stringify([
    { at: at - 60000, rates: { NVDA: [.001, -.001] } },
    { at, rates: { NVDA: { nado: .001, variational: -.001, hyperliquid: 0 } } },
    { at: at - 1, hyperliquidSplit: true, rates: { NVDA: { hyperliquid: .004, hip3: .009 } } },
    { at: at + 1, hyperliquidSplit: true, rates: { NVDA: { hyperliquid: .002, xyz: .003 } } },
  ]));
  const feed = createFeed(pathToFileURL(directory + sep));
  assert.deepEqual(await feed.history('NVDA'), [
    { at: at - 60000, nado: .001, variational: -.001, hyperliquid: null, xyz: null, lighter_rh: null },
    { at, nado: .001, variational: -.001, hyperliquid: null, xyz: null, lighter_rh: null },
    { at: at - 1, nado: null, variational: null, hyperliquid: .004, xyz: null, lighter_rh: null },
    { at: at + 1, nado: null, variational: null, hyperliquid: .002, xyz: .003, lighter_rh: null },
  ]);
});

test('five-second refresh shares requests, expires cache and preserves minute history', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'funding-feed-test-'));
  t.after(async () => {
    const target = resolve(directory);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith('funding-feed-test-'));
    await rm(target, { recursive: true, force: true });
  });
  let now = Date.now(), calls = 0, hold = null;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    if (hold) await hold;
    if (url === endpoints.hyperliquid) {
      const request = JSON.parse(options.body);
      if (request.type === 'perpDexs') return Response.json([null,{name:'xyz'}]);
      if (request.dex === 'xyz') return Response.json([{universe:[{name:'xyz:NVDA'}],collateralToken:0},[{markPx:'102',funding:'0.00003'}]]);
      return Response.json([{universe:[{name:'NVDA'}],collateralToken:0},[{markPx:'101',funding:'0.00002',dayNtlVlm:'1000'}]]);
    }
    const bodies = {
      [endpoints.nadoSymbols]: {status:'success', data:{symbols:{NVDA:{type:'perp',symbol:'NVDA-PERP',product_id:2,trading_status:'live'}}}},
      [endpoints.nadoContracts]: {NVDA:{product_id:2,mark_price:100}},
      [endpoints.nadoRates]: {2:{funding_rate_x18:'300000000000000',update_time:now/1000}},
      [endpoints.lighterRh]: {code:200,order_book_details:[{market_id:15,symbol:'NVDA',market_type:'perp',status:'active'}]},
      [endpoints.variational]: {listings:[{ticker:'NVDA',mark_price:102,funding_rate:.1095,funding_interval_s:3600}]},
    };
    assert.ok(url in bodies);
    return Response.json(bodies[url]);
  });
  let lighterFails = false;
  const feed = createFeed(pathToFileURL(directory + sep), { lighterRhStats: async () => {
    if (lighterFails) throw new Error('RH disconnected');
    return {channel:'market_stats:all',timestamp:now,market_stats:{15:{market_id:15,symbol:'NVDA',current_funding_rate:'0.005',mark_price:'103'}}};
  } });
  const first = await feed.refresh();
  assert.equal(first.refreshSeconds, 5);
  assert.equal(first.rows[0].priceComparable, true);
  assert.equal(calls, 8);
  assert.equal(first.sources.hyperliquid.count, 1);
  assert.equal(first.rows[0].hyperliquid.hourlyRate, 0.00002);
  assert.equal(first.sources.xyz.count, 1);
  assert.equal(first.sources.lighter_rh.count, 1);
  assert.equal(first.rows[0].lighter_rh.hourlyRate, .00005);
  assert.equal(first.rows[0].lighter, undefined);
  assert.equal(first.rows[0].xyz.hourlyRate, 0.00003);
  assert.equal(first.rows[0].xyz.exchange, 'xyz');
  now += 4000;
  await Promise.all(Array.from({length:10}, () => feed.refresh()));
  assert.equal(calls, 8, 'manual refreshes within cache window do not call exchanges');
  now += 1000;
  let release;
  hold = new Promise(resolve => { release = resolve; });
  const pending = Array.from({length:10}, () => feed.refresh());
  now += 10000;
  pending.push(feed.refresh());
  release(); hold = null;
  const results = await Promise.all(pending);
  assert.equal(calls, 13, 'slow in-flight collection stays shared even across later ticks');
  assert.ok(results.every(data => data.lastAttempt === first.lastAttempt + 5000));
  assert.equal((await feed.history('NVDA')).length, 1);
  now += 5000;
  const next = await feed.refresh();
  assert.equal(calls, 18);
  assert.ok(next.sources.nado.fetchedAt > first.sources.nado.fetchedAt);
  now += 60000;
  await feed.refresh();
  assert.equal((await feed.history('NVDA')).length, 2, 'history remains minute-based');
  assert.equal((await feed.history('NVDA'))[0].hyperliquid, 0.00002);
  assert.equal((await feed.history('NVDA'))[0].xyz, 0.00003);
  assert.equal((await feed.history('NVDA'))[0].lighter_rh, .00005);
  now += 5000; lighterFails = true;
  const outage = await feed.refresh();
  assert.match(outage.sources.lighter_rh.error, /RH disconnected/);
  assert.equal(outage.rows[0].lighter_rh.stale, true);
  assert.equal(outage.rows[0].lighter_rh.priceStale, true);
  assert.equal(outage.rows[0].hyperliquid.stale, false);
  now += 5000; lighterFails = false;
  assert.equal((await feed.refresh()).rows[0].lighter_rh.stale, false);
});

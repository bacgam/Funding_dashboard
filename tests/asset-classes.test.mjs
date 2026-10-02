import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMarket } from '../public/asset-classes.js';
import { mergeMarkets } from '../server/markets.mjs';

test('RWA includes equities, ETFs, indices, commodities, forex and gold-backed tokens', () => {
  for (const symbol of ['NVDA','COIN','SKHX','KLAC','SPY','TMF','WTI','UKOILP','XAU','EURUSD','PAXG','XAUT','xyz:SP500','xyz:QNT']) {
    assert.equal(classifyMarket({symbol}), 'rwa', symbol);
  }
});
test('crypto tickers and RWA project tokens do not inherit a similarly named equity classification', () => {
  for (const symbol of ['BTC','ETH','ONDO','LINK','SPX','QNT','STX','xyz:BTC']) {
    assert.equal(classifyMarket({symbol}), 'crypto', symbol);
  }
});
test('merged rows carry the asset class without depending on exchange selection', () => {
  const market = symbol => ({symbol,sourceAt:null,fetchedAt:Date.now(),hourlyRate:0});
  const rows = mergeMarkets({variational:{markets:[market('NVDA'),market('BTC')]},xyz:{markets:[market('xyz:SP500')]}});
  assert.equal(rows.find(r=>r.symbol==='NVDA').assetClass, 'rwa');
  assert.equal(rows.find(r=>r.symbol==='BTC').assetClass, 'crypto');
  assert.equal(rows.find(r=>r.symbol==='xyz:SP500').assetClass, 'rwa');
});

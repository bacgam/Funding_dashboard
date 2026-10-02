import { priceIsStale } from '../public/price-gap.js';
import { compareMarkets } from '../public/comparison.js';
import { classifyMarket } from '../public/asset-classes.js';
export const HOUR = 3600000;
export const STALE_MS = 120000;
export function number(value) {
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
const scaledSymbols = { kPEPE: 'PEPE', kBONK: 'BONK', kSHIB: 'SHIB' };
export function canonical(raw) {
  const base = raw.replace(/-PERP$/, '');
  return { symbol: scaledSymbols[base] ?? base, multiplier: scaledSymbols[base] ? 1000 : 1 };
}
export function parseNado(symbolsPayload, contracts, rates, fetchedAt, priceFetchedAt = fetchedAt) {
  const symbols = symbolsPayload?.data?.symbols;
  if (!symbols || !contracts || !rates) throw new Error('NADO 응답 형식이 변경되었습니다.');
  const byId = new Map(Object.values(contracts).map(c => [c.product_id, c]));
  return Object.values(symbols).filter(s => s.type === 'perp' && s.trading_status === 'live').map(s => {
    const c = byId.get(s.product_id), r = rates[s.product_id];
    const { symbol, multiplier } = canonical(s.symbol);
    const raw = number(r?.funding_rate_x18);
    const daily = raw === null ? null : raw / 1e18;
    const update = number(r?.update_time);
    return { symbol, nativeSymbol: s.symbol, multiplier, exchange: 'nado', settlement: 'USDT0',
      hourlyRate: daily === null ? null : daily / 24, rawRate: r?.funding_rate_x18 ?? null, rateBasis: '24h x18',
      intervalHours: 1, sourceAt: update === null ? null : update * 1000, fetchedAt,
      nextFundingAt: number(c?.next_funding_rate_timestamp) === null ? null : c.next_funding_rate_timestamp * 1000,
      price: number(c?.mark_price) === null ? null : c.mark_price / multiplier, priceFetchedAt,
      volume: number(c?.quote_volume), openInterest: number(c?.open_interest_usd) };
  });
}
export function parseVariational(payload, fetchedAt) {
  if (!Array.isArray(payload?.listings)) throw new Error('Variational 응답 형식이 변경되었습니다.');
  return payload.listings.filter(l => typeof l.ticker === 'string' && (!l.instrument_type || l.instrument_type === 'perpetual' || l.instrument_type === 'perp')).map(l => {
    const annual = number(l.funding_rate), interval = number(l.funding_interval_s);
    const longOi = number(l.open_interest?.long_open_interest), shortOi = number(l.open_interest?.short_open_interest);
    return { symbol: l.ticker, nativeSymbol: l.ticker, multiplier: 1, name: l.name, exchange: 'variational', settlement: 'USDC',
      hourlyRate: annual === null || !interval || interval < 0 ? null : annual / 8760,
      rawRate: l.funding_rate ?? null, rateBasis: 'annual decimal', intervalHours: interval > 0 ? interval / 3600 : null,
      sourceAt: null, fetchedAt, priceFetchedAt: fetchedAt, nextFundingAt: null, price: number(l.mark_price), volume: number(l.volume_24h),
      quoteAt: Number.isFinite(Date.parse(l.quotes?.updated_at)) ? Date.parse(l.quotes.updated_at) : null,
      openInterest: longOi === null || shortOi === null ? null : longOi + shortOi };
  });
}
export function mergeMarkets(sources, now = Date.now()) {
  const rows = new Map();
  for (const [exchange, source] of Object.entries(sources)) {
    for (const market of source.markets ?? []) {
      const stale = Boolean(source.error || market.sourceError) || (exchange === 'nado' && market.sourceAt === null) || now - market.fetchedAt > STALE_MS ||
        (market.sourceAt !== null && (now - market.sourceAt > STALE_MS || market.sourceAt > now + 60000));
      const row = rows.get(market.symbol) ?? { symbol: market.symbol, name: market.name ?? market.symbol };
      row[exchange] = { ...market, stale, priceStale: Boolean(source.error || market.sourceError) || priceIsStale(market, now) };
      if (market.name) row.name = market.name;
      rows.set(market.symbol, row);
    }
  }
  return [...rows.values()].map(row => {
    return { ...row, assetClass: classifyMarket(row), ...compareMarkets(row, Object.keys(sources), now) };
  }).sort((a, b) => (b.spreadHourly ?? -1) - (a.spreadHourly ?? -1) || a.symbol.localeCompare(b.symbol));
}

import { priceGap } from './price-gap.js';

// Recompute from the selected venues, never from a precomputed two-venue spread.
export function compareMarkets(row, ids, now = Date.now()) {
  const funding = ids.filter(id => row[id] && !row[id].stale && Number.isFinite(row[id].hourlyRate));
  funding.sort((a, b) => row[a].hourlyRate - row[b].hourlyRate || a.localeCompare(b));
  const comparable = funding.length >= 2;
  const spreadHourly = comparable ? row[funding.at(-1)].hourlyRate - row[funding[0]].hourlyRate : null;
  const hasEdge = comparable && spreadHourly > 1e-14;
  let best = priceGap(null, null, now);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j];
    const pair = priceGap(row[a], row[b], now);
    if (pair.priceComparable && (!best.priceComparable || pair.priceGapRatio > best.priceGapRatio)) {
      const translate = id => id === 'nado' ? a : id === 'variational' ? b : null;
      best = { ...pair, priceLong: translate(pair.priceLong), priceShort: translate(pair.priceShort) };
    }
  }
  return { ...best, nadoPremium: priceGap(row.nado, row.variational, now).nadoPremium,
    comparable, spreadHourly, long: hasEdge ? funding[0] : null, short: hasEdge ? funding.at(-1) : null };
}

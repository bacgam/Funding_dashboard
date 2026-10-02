const MAX_AGE = 120000;
const MAX_SKEW = 30000;

export function priceIsStale(market, now = Date.now()) {
  const at = market?.priceFetchedAt;
  return !market || !!market.priceStale || !Number.isFinite(at) || at <= 0 ||
    now - at > MAX_AGE || at > now + 60000;
}

// Both prices are normalized to one underlying unit by the exchange adapters.
export function priceGap(nado, variational, now = Date.now()) {
  const empty = { priceComparable: false, priceGap: null, priceGapRatio: null,
    nadoPremium: null, priceLong: null, priceShort: null, gapFundingHourly: null };
  if ([nado, variational].some(m => priceIsStale(m, now) || !Number.isFinite(m.price) || m.price <= 0) ||
      Math.abs(nado.priceFetchedAt - variational.priceFetchedAt) > MAX_SKEW) return empty;
  const difference = Math.abs(nado.price - variational.price);
  const ratio = difference / Math.min(nado.price, variational.price);
  const premium = (nado.price - variational.price) / variational.price;
  if (![difference, ratio, premium].every(Number.isFinite)) return empty;
  const long = difference > 0 ? (nado.price < variational.price ? 'nado' : 'variational') : null;
  const short = long ? (long === 'nado' ? 'variational' : 'nado') : null;
  const markets = { nado, variational };
  const funding = long && !nado.stale && !variational.stale &&
    Number.isFinite(nado.hourlyRate) && Number.isFinite(variational.hourlyRate)
    ? markets[short].hourlyRate - markets[long].hourlyRate : null;
  return { priceComparable: true, priceGap: difference, priceGapRatio: ratio,
    nadoPremium: premium, priceLong: long, priceShort: short, gapFundingHourly: funding };
}

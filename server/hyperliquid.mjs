import { canonical, number, HOUR } from './markets.mjs';

export const HYPERLIQUID_INFO = 'https://api.hyperliquid.xyz/info';
export const HIP3_REFRESH_MS = 30000;
// Explicit identities prevent stock STX / crypto STX, commodity GAS / crypto GAS,
// and index SP500 / crypto SPX from being accidentally combined.
const stocks = new Set(('TSLA NVDA HOOD INTC PLTR COIN META AAPL MSFT ORCL GOOGL AMZN AMD MU SNDK MSTR CRCL NFLX COST LLY TSM RIVN BABA USAR CRWV URNM GME EWY EWJ HIMS DKNG LITE XLE BX MRVL RKLB EWZ ZM EBAY ARM EWT ASML BB DELL IBM AVGO NOW NBIS WDC NOK SMH BE QCOM STRC AMAT GEV KORU SOXL MAGS IREN NET CRWD RDDT AAOI MRNA XBI BMNR COHR GLW CRDO LRCX VST TER CIEN MELI SMCI IGV SOFI TTWO CIFR RTX IONQ GPRO KWEB').split(' '));
for (const symbol of 'SKHX SMSN SOFTBANK HYUNDAI KIOXIA UNITREE MINIMAX ZHIPU IBIDEN GIGADEV CXMT NAVER TENCENT CAMBRICON INNOLIGHT XIAOMI'.split(' ')) stocks.add(symbol);
const hip3Aliases = { 'xyz:BRENTOIL': 'BZ', 'xyz:CL': 'CL', 'xyz:NATGAS': 'NATGAS', 'xyz:GOLD': 'XAU', 'xyz:SILVER': 'XAG' };
const hip3Crypto = new Set('BTC ETH HYPE SOL LIT ZEC XRP BNB DOGE SUI PUMP FARTCOIN ENA XMR LTC LINK XPL IP BCH ADA'.split(' '));
const scaled = { kLUNC: 'LUNC', kFLOKI: 'FLOKI', kDOGS: 'DOGS', kNEIRO: 'NEIRO', '1000PEPE': 'PEPE' };
const collateralNames = { 0: 'USDC', 235: 'USDe', 268: 'USDT0', 360: 'USDH' };

export function hyperliquidSymbol(nativeSymbol, dex = '') {
  const base = dex ? nativeSymbol.slice(dex.length + 1) : nativeSymbol;
  if (!dex) return scaled[base] ? { symbol: scaled[base], multiplier: 1000 } : canonical(base);
  if (hip3Aliases[nativeSymbol]) return { symbol: hip3Aliases[nativeSymbol], multiplier: 1 };
  if (['hyna', 'flx', 'cash'].includes(dex) && hip3Crypto.has(base)) return { symbol: base, multiplier: 1 };
  if (nativeSymbol === 'hyna:1000PEPE') return { symbol: 'PEPE', multiplier: 1000 };
  if (stocks.has(base)) return { symbol: base, multiplier: 1 };
  // Unknown or ambiguous products remain visible under their full contract name.
  return { symbol: nativeSymbol, multiplier: 1 };
}

export function parseHyperliquid(payload, fetchedAt, dex = '') {
  if (dex && dex !== 'xyz') return [];
  if (!Array.isArray(payload?.[0]?.universe) || !Array.isArray(payload?.[1]) || payload[0].universe.length !== payload[1].length) {
    throw new Error('Hyperliquid 응답 형식이 변경되었습니다.');
  }
  const settlement = collateralNames[payload[0].collateralToken];
  // Unknown collateral is not assumed to be USD.
  if (!settlement) throw new Error(`지원하지 않는 Hyperliquid 결제 통화: ${payload[0].collateralToken}`);
  return payload[0].universe.flatMap((asset, i) => {
    if (asset.isDelisted || typeof asset.name !== 'string' || (dex && !asset.name.startsWith(`${dex}:`))) return [];
    const ctx = payload[1][i];
    const { symbol, multiplier } = hyperliquidSymbol(asset.name, dex);
    const mark = number(ctx?.markPx), oi = number(ctx?.openInterest);
    return [{ symbol, nativeSymbol: asset.name, exchange: dex ? 'xyz' : 'hyperliquid', dex, settlement, multiplier,
      hourlyRate: number(ctx?.funding), rawRate: ctx?.funding ?? null, rateBasis: 'hourly decimal', intervalHours: 1,
      sourceAt: null, fetchedAt, priceFetchedAt: fetchedAt, nextFundingAt: (Math.floor(fetchedAt / HOUR) + 1) * HOUR,
      price: mark === null ? null : mark / multiplier, volume: number(ctx?.dayNtlVlm),
      openInterest: oi === null || mark === null ? null : oi * mark }];
  });
}

export function selectHyperliquidMarkets(markets) {
  const priority = dex => !dex ? 0 : dex === 'xyz' ? 1 : 2;
  const selected = new Map();
  // Stable venue priority also keeps historical series on the same contract.
  for (const market of [...markets].sort((a, b) => priority(a.dex) - priority(b.dex) || a.nativeSymbol.localeCompare(b.nativeSymbol))) {
    const key = `${market.exchange}:${market.symbol}`;
    if (!selected.has(key)) selected.set(key, market);
  }
  return [...selected.values()];
}

export function createHyperliquidFetcher(json) {
  let dexes = [], discoveryAt = null, discoveryWarning = null;
  const cache = new Map();
  return async function fetchHyperliquid() {
    const now = Date.now();
    if (discoveryAt === null || now - discoveryAt >= 3600000) {
      discoveryAt = now;
      try {
        const result = await json(HYPERLIQUID_INFO, { type: 'perpDexs' });
        if (!Array.isArray(result)) throw new Error('XYZ 목록 형식 오류');
        dexes = [...new Set(result.filter(d => d?.name === 'xyz').map(d => d.name))];
        discoveryWarning = null;
      } catch (error) { discoveryWarning = `XYZ 목록: ${error.message}`; discoveryAt = now - 3540000; }
    }
    await Promise.all(['', ...dexes].map(async dex => {
      const previous = cache.get(dex);
      if (dex && previous && now - previous.attemptedAt < HIP3_REFRESH_MS) return;
      try {
        const data = await json(HYPERLIQUID_INFO, { type: 'metaAndAssetCtxs', dex });
        cache.set(dex, { attemptedAt: now, markets: parseHyperliquid(data, Date.now(), dex), error: null });
      } catch (error) {
        cache.set(dex, { attemptedAt: now, markets: previous?.markets ?? [], error: error.message });
      }
    }));
    const entries = ['', ...dexes].map(dex => [dex, cache.get(dex)]);
    const markets = selectHyperliquidMarkets(entries.flatMap(([, source]) => source.markets.map(m => ({ ...m, sourceError: source.error }))));
    const groups = Object.fromEntries(['hyperliquid', 'xyz'].map(id => {
      const selected = markets.filter(m => m.exchange === id);
      const groupEntries = entries.filter(([dex]) => Boolean(dex) === (id === 'xyz'));
      const warnings = groupEntries.filter(([, s]) => s.error).map(([dex, s]) => `${dex || '기본 마켓'}: ${s.error}`);
      if (id === 'xyz' && discoveryWarning) warnings.unshift(discoveryWarning);
      const warning = warnings.join(' / ') || null;
      const error = warning && !selected.some(m => !m.sourceError && Number.isFinite(m.hourlyRate)) ? warning : null;
      return [id, { markets: selected, warning, error }];
    }));
    return { markets, groups, warning: groups.xyz.warning || groups.hyperliquid.warning };
  };
}

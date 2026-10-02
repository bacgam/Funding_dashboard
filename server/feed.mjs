import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { parseNado, parseVariational, mergeMarkets } from './markets.mjs';
import { createHyperliquidFetcher, HYPERLIQUID_INFO } from './hyperliquid.mjs';
import { createLighterRhFetcher, LIGHTER_RH_BOOKS } from './lighter-rh.mjs';
import { exchangeIds } from '../public/exchanges.js';
export const REFRESH_INTERVAL_MS = 5000;
// Allow timer jitter while sharing one collection across tabs and manual refreshes.
const MIN_REFRESH_INTERVAL_MS = REFRESH_INTERVAL_MS - 500;
export const endpoints = {
  nadoSymbols: 'https://gateway.prod.nado.xyz/v1/query?type=symbols',
  nadoContracts: 'https://archive.prod.nado.xyz/v2/contracts?edge=false',
  nadoRates: 'https://archive.prod.nado.xyz/v1',
  variational: 'https://omni-client-api.prod.ap-northeast-1.variational.io/metadata/stats',
  hyperliquid: HYPERLIQUID_INFO,
  lighterRh: LIGHTER_RH_BOOKS,
};
async function json(url, body) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`공개 API HTTP ${response.status}`);
  return response.json();
}
export async function fetchNado() {
  const [s, contractResponse] = await Promise.all([json(endpoints.nadoSymbols),
    json(endpoints.nadoContracts).then(data => ({ data, at: Date.now() }))]);
  if (s.status !== 'success' || !s.data?.symbols) throw new Error('NADO 종목 목록 조회 실패');
  const ids = Object.values(s.data.symbols).filter(x => x.type === 'perp' && x.trading_status === 'live').map(x => x.product_id);
  const r = await json(endpoints.nadoRates, { funding_rates: { product_ids: ids } });
  const markets = parseNado(s, contractResponse.data, r, Date.now(), contractResponse.at);
  if (!markets.some(m => m.hourlyRate !== null)) throw new Error('NADO 유효 펀딩비 없음');
  return markets;
}
export async function fetchVariational() {
  const markets = parseVariational(await json(endpoints.variational), Date.now());
  if (!markets.some(m => m.hourlyRate !== null)) throw new Error('Variational 유효 펀딩비 없음');
  return markets;
}
export function createFeed(directory, { lighterRhStats } = {}) {
  const sources = Object.fromEntries(exchangeIds.map(id => [id, { markets: [] }]));
  const fetchers = { nado: fetchNado, variational: fetchVariational, hyperliquid: createHyperliquidFetcher(json),
    lighter_rh: createLighterRhFetcher(json, lighterRhStats) };
  let inFlight, lastAttempt = 0, history = [], storageError = null;
  const file = new URL('history.json', directory);
  const ready = mkdir(directory, { recursive: true }).then(async () => {
    try { const saved = JSON.parse(await readFile(file, 'utf8')); if (Array.isArray(saved)) history = saved.filter(s => s.at > Date.now() - 86400000).slice(-1440); }
    catch (e) { if (e.code !== 'ENOENT') storageError = '이력 파일을 읽지 못했습니다.'; }
  }).catch(() => { storageError = '이력 저장 폴더에 접근할 수 없습니다.'; });
  function snapshot() {
    const now = Date.now();
    return { at: now, lastAttempt, refreshSeconds: REFRESH_INTERVAL_MS / 1000, storageError,
      sources: Object.fromEntries(Object.entries(sources).map(([key, s]) => [key, {
        count: s.markets.length, fetchedAt: s.fetchedAt ?? null, error: s.error ?? null, warning: s.warning ?? null,
      }])), rows: mergeMarkets(sources, now) };
  }
  async function refresh() {
    if (inFlight) return inFlight;
    if (Date.now() - lastAttempt < MIN_REFRESH_INTERVAL_MS) return snapshot();
    lastAttempt = Date.now();
    inFlight = (async () => {
      await ready;
      await Promise.all(Object.entries(fetchers).map(async ([key, fetcher]) => {
        try {
          const result = await fetcher();
          const updates = result.groups ?? { [key]: Array.isArray(result) ? { markets: result } : result };
          for (const [id, source] of Object.entries(updates)) sources[id] = { error: null, ...source, fetchedAt: Date.now() };
        } catch (e) {
          for (const id of key === 'hyperliquid' ? ['hyperliquid', 'xyz'] : [key]) {
            sources[id].error = e.name === 'TimeoutError' ? 'API 응답 시간 초과' : e.message;
          }
        }
      }));
      const data = snapshot();
      if (!history.length || data.at - history.at(-1).at >= 60000) {
        const rates = Object.fromEntries(data.rows.map(r => [r.symbol, Object.fromEntries(exchangeIds.map(id => [id, r[id] && !r[id].stale ? r[id].hourlyRate : null]))]));
        if (Object.keys(rates).length) {
          history = [...history.filter(h => h.at > data.at - 86400000), { at: data.at, hyperliquidSplit: true, rates }].slice(-1440);
          try { await writeFile(new URL('history.tmp', directory), JSON.stringify(history)); await rename(new URL('history.tmp', directory), file); storageError = null; }
          catch { storageError = '이력을 디스크에 저장하지 못했습니다.'; }
        }
      }
      return snapshot();
    })().finally(() => { inFlight = null; });
    return inFlight;
  }
  return { refresh, snapshot, async history(symbol) {
    await ready;
    return history.map(h => {
      const saved = h.rates?.[symbol];
      const rates = Array.isArray(saved) ? { nado: saved[0], variational: saved[1] } : saved;
      // Older Hyperliquid points mixed base and HIP-3 without recording the contract.
      // Preserve the stored data, but never assign that ambiguous series to either new group.
      return { at: h.at, ...Object.fromEntries(exchangeIds.map(id => [id,
        ['hyperliquid', 'xyz'].includes(id) && !h.hyperliquidSplit ? null : rates?.[id] ?? null])) };
    });
  } };
}

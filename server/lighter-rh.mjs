import { number, HOUR } from './markets.mjs';

// Robinhood Chain only. Reserve `lighter` for a future, separate mainnet adapter.
export const LIGHTER_RH_API = 'https://api.rh.lighter.xyz/api/v1';
export const LIGHTER_RH_STREAM = 'wss://api.rh.lighter.xyz/stream';
export const LIGHTER_RH_BOOKS = `${LIGHTER_RH_API}/orderBookDetails`;
const DISCOVERY_MS = 60000;

export function parseLighterRh(books, packet, fetchedAt) {
  if (books?.code !== 200 || !Array.isArray(books.order_book_details) ||
      packet?.channel !== 'market_stats:all' || !packet.market_stats ||
      Array.isArray(packet.market_stats) || number(packet.timestamp) === null || packet.timestamp <= 0) {
    throw new Error('Lighter RH 응답 형식이 변경되었습니다.');
  }
  return books.order_book_details.flatMap(book => {
    if (book.market_type !== 'perp' || book.status !== 'active' || typeof book.symbol !== 'string') return [];
    const stats = packet.market_stats[book.market_id];
    const matches = stats?.market_id === book.market_id && stats.symbol === book.symbol;
    const current = matches ? number(stats.current_funding_rate) : null;
    // AI is Artificial Inu on Robinhood Chain, not another venue's AI token/stock.
    const symbol = book.symbol === 'AI' ? 'lighter_rh:AI' : book.symbol;
    const sourceAt = matches ? number(packet.timestamp) : null;
    return [{ symbol, nativeSymbol: book.symbol, marketId: book.market_id,
      exchange: 'lighter_rh', network: 'robinhood', settlement: 'USDG', multiplier: 1,
      name: book.symbol === 'AI' ? 'Artificial Inu (Robinhood Chain)' : undefined,
      hourlyRate: current === null ? null : current / 100,
      rawRate: matches ? stats.current_funding_rate ?? null : null,
      rateBasis: 'hourly percent · next funding estimate', intervalHours: 1,
      sourceAt, fetchedAt, priceFetchedAt: sourceAt,
      nextFundingAt: sourceAt === null ? null : (Math.floor(sourceAt / HOUR) + 1) * HOUR,
      price: matches ? number(stats.mark_price) : null,
      volume: matches ? number(stats.daily_quote_token_volume) : null,
      // market_stats open_interest is quote notional, unlike REST orderBookDetails.
      openInterest: matches ? number(stats.open_interest) : null,
    }];
  });
}

// Fetch one full public snapshot and close the socket. At five-second polling this
// uses 12 connections/minute, below the documented 255 new connections/minute/IP.
export function fetchLighterRhStats(Socket = WebSocket, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const socket = new Socket(LIGHTER_RH_STREAM);
    let done = false;
    const finish = (error, packet) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error); else resolve(packet);
    };
    const timer = setTimeout(() => finish(new Error('Lighter RH API 응답 시간 초과')), timeoutMs);
    socket.addEventListener('open', () => { if (!done) socket.send(JSON.stringify({ type: 'subscribe', channel: 'market_stats/all' })); });
    socket.addEventListener('message', event => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === 'ping') socket.send(JSON.stringify({ type: 'pong' }));
        else if (packet.type === 'error' || packet.error) finish(new Error('Lighter RH 스트림 조회 실패'));
        else if (packet.type === 'subscribed/market_stats' && packet.channel === 'market_stats:all') finish(null, packet);
      } catch { finish(new Error('Lighter RH 스트림 응답 형식 오류')); }
    });
    socket.addEventListener('error', () => finish(new Error('Lighter RH 스트림 연결 실패')));
    socket.addEventListener('close', () => finish(new Error('Lighter RH 스트림 연결 종료')));
  });
}

export function createLighterRhFetcher(json, stats = fetchLighterRhStats) {
  let books, discoveryAt = 0;
  return async () => {
    const [metadata, packet] = await Promise.all([
      books && Date.now() - discoveryAt < DISCOVERY_MS ? books : json(LIGHTER_RH_BOOKS),
      stats(),
    ]);
    const markets = parseLighterRh(metadata, packet, Date.now());
    if (!markets.some(m => m.hourlyRate !== null)) throw new Error('Lighter RH 유효 펀딩비 없음');
    if (metadata !== books) { books = metadata; discoveryAt = Date.now(); }
    return markets;
  };
}

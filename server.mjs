import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createFeed, REFRESH_INTERVAL_MS } from './server/feed.mjs';
import { marketLogos } from './public/market-logos.js';
const port = Number(process.env.PORT || 4180);
const feed = createFeed(new URL('./data/', import.meta.url));
const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'], '/assets/nado.png': ['assets/nado.png', 'image/png'], '/assets/variational.svg': ['assets/variational.svg', 'image/svg+xml'] };
files['/price-gap.js'] = ['price-gap.js', 'text/javascript'];
files['/assets/fonts/PretendardVariable.woff2'] = ['assets/fonts/PretendardVariable.woff2', 'font/woff2'];
files['/market-logos.js'] = ['market-logos.js', 'text/javascript'];
files['/navigation.js'] = ['navigation.js', 'text/javascript'];
files['/exchanges.js'] = ['exchanges.js', 'text/javascript'];
files['/comparison.js'] = ['comparison.js', 'text/javascript'];
files['/asset-classes.js'] = ['asset-classes.js', 'text/javascript'];
files['/assets/hyperliquid.png'] = ['assets/hyperliquid.png', 'image/png'];
files['/assets/xyz.png'] = ['assets/xyz.png', 'image/png'];
files['/assets/lighter-rh.png'] = ['assets/lighter-rh.png', 'image/png'];
const logoTypes = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' };
for (const path of Object.values(marketLogos)) {
  if (/^\/assets\/markets\/[a-f0-9]{20}\.(png|jpg|webp|svg)$/.test(path)) {
    files[path] = [path.slice(1), logoTypes[path.split('.').at(-1)]];
  }
}
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
  try {
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/funding') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(await feed.refresh()));
    } else if (url.pathname === '/api/history') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(await feed.history((url.searchParams.get('symbol') ?? '').slice(0,60))));
    } else if (files[url.pathname]) {
      const [name, type] = files[url.pathname];
      if (url.pathname.startsWith('/assets/markets/')) res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Type', type.startsWith('text/') ? `${type}; charset=utf-8` : type);
      res.end(await readFile(new URL(`./public/${name}`, import.meta.url)));
    } else { res.writeHead(404).end('Not found'); }
  } catch(e) { console.error(e); res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: '대시보드 서버 오류' })); }
});
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `포트 ${port}이 사용 중입니다. 실행 중인 대시보드를 확인하세요.` : e); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  console.log(`PERPDEX Funding Desk: http://127.0.0.1:${port}`);
  void feed.refresh();
  const timer = setInterval(() => void feed.refresh(), REFRESH_INTERVAL_MS);
  timer.unref();
});

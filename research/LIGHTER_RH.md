# Lighter on Robinhood Chain

Verified 2026-09-26 against the Robinhood deployment. Do not substitute the original Lighter mainnet endpoints.

- [Getting started](https://apidocs.rh.lighter.xyz/docs/get-started) specifies `https://api.rh.lighter.xyz/`.
- [Order book details](https://apidocs.rh.lighter.xyz/reference/orderbookdetails): active perpetual market IDs and symbols. The live response contained 57 perpetuals.
- [WebSocket market stats](https://apidocs.rh.lighter.xyz/docs/websocket): subscribe to `market_stats/all`. `current_funding_rate` estimates the upcoming payment; `funding_rate` is the previous settlement and `funding_timestamp` is its settlement time, not the current quote timestamp.
- [Official trading page](https://robinhoodchain.lighter.xyz/trade/LIT), bundle `index-CbDBelFL.js`: the one-hour label formats `current_funding_rate` directly as a percentage. The funding explanation specifies hourly payments. Thus `0.0012` means 0.0012% per hour, or 0.000012 hourly decimal. Eight-hour display is 0.0096%. The app uses `wss://api.rh.lighter.xyz/stream`.
- The REST `/funding-rates` response includes other exchanges and period-normalized comparison rates. It is deliberately not the source for current hourly funding.
- Live stats report LIT open interest around 3.96 million in quote notional, whereas REST book details report base units. Do not multiply websocket `open_interest` by price again.
- `/api/v1/assetDetails` identifies margin asset 3 as USDG; the official app includes USDG deposits on Robinhood Chain. Treat it as 1 USD consistently with other supported dollar collateral.
- [Rate limits](https://apidocs.rh.lighter.xyz/docs/rate-limits): 255 new websocket connections/minute/IP, 200 client messages/minute. One snapshot every five seconds uses 12 connections and subscriptions/minute; the feed shares collection across clients. Each request times out after 12 seconds and closes its socket; a subsequent collection reconnects.
- Stock/ETF identities were checked against official app token descriptions. Artificial Inu (`AI`) is a Robinhood memecoin and remains `lighter_rh:AI`; SLV and USO are ETF contracts, not XAG and WTI. New equities/ETFs are included in the shared RWA list.
- Logo source: [official touch icon](https://robinhoodchain.lighter.xyz/apple-touch-icon.png), saved without modifying brand artwork.

Data timestamps use the top-level websocket `timestamp`, not `funding_timestamp`. Missing markets/rates stay null, and stale or failed observations are excluded from comparisons. History is stored under `lighter_rh`; `lighter` remains available for the future mainnet integration.

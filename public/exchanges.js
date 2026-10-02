// Register display metadata here; filters, columns, details and exports use this list.
export const exchanges = [
  { id: 'nado', name: 'NADO', logo: '/assets/nado.png', description: 'Ink · USDT0', url: 'https://app.nado.xyz', color: 'var(--positive)' },
  { id: 'variational', name: 'Variational', logo: '/assets/variational.svg', description: 'Arbitrum · USDC', url: 'https://omni.variational.io', color: 'var(--negative)' },
  { id: 'hyperliquid', name: 'Hyperliquid', logo: '/assets/hyperliquid.png', description: '기본 무기한 마켓', url: 'https://app.hyperliquid.xyz/trade', color: 'var(--positive)', dash: '6 4' },
  { id: 'xyz', name: 'XYZ', logo: '/assets/xyz.png', description: 'Hyperliquid · XYZ 마켓', url: 'https://app.hyperliquid.xyz/trade', color: 'var(--negative)', dash: '2 4' },
  { id: 'lighter_rh', name: 'Lighter RH', logo: '/assets/lighter-rh.png', description: 'Robinhood Chain · USDG', url: 'https://robinhoodchain.lighter.xyz/trade', color: 'var(--positive)', dash: '8 3 2 3' },
];
export const exchangeIds = exchanges.map(exchange => exchange.id);

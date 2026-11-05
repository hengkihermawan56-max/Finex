const API = 'https://api.dexscreener.com';
export const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const num = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;

export function normalizePair(pair, observedAt = Date.now()) {
  if (pair?.chainId !== 'solana' || !ADDRESS.test(pair?.baseToken?.address || '') ||
    !ADDRESS.test(pair?.pairAddress || '')) return null;
  const priceUsd = num(pair.priceUsd);
  if (!(priceUsd > 0)) return null;
  return {
    key: pair.pairAddress, tokenAddress: pair.baseToken.address,
    symbol: String(pair.baseToken.symbol || 'TOKEN').slice(0, 25),
    name: String(pair.baseToken.name || '').slice(0, 70),
    chainId: 'solana', source: 'live', priceUsd,
    liquidityUsd: num(pair.liquidity?.usd), volumeH1: num(pair.volume?.h1),
    buysM5: num(pair.txns?.m5?.buys), sellsM5: num(pair.txns?.m5?.sells),
    changeM5: num(pair.priceChange?.m5), changeH1: num(pair.priceChange?.h1),
    fdvUsd: num(pair.fdv), createdAt: num(pair.pairCreatedAt), observedAt,
    dex: String(pair.dexId || '').slice(0, 30)
  };
}

async function getJson(url, fetchFn = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetchFn(url, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
    if (!res.ok) throw new Error(`API pasar HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

// Discovery uses *latest profiles*, not a complete list of new tokens or a
// direct Pump.fun/Raydium feed. No paid-boost ranking is used as a trading signal.
export async function loadLiveQuotes(positions = [], watchlist = [], fetchFn = fetch) {
  let profiles = [], warning = '';
  try {
    const data = await getJson(`${API}/token-profiles/latest/v1`, fetchFn);
    if (!Array.isArray(data)) throw new Error('Respons profil tidak valid');
    profiles = data.filter(x => x.chainId === 'solana' && ADDRESS.test(x.tokenAddress || ''));
  } catch (err) { warning = 'Penemuan profil gagal; hanya pantau alamat tersimpan.'; }
  const tokens = [...new Set([...positions.map(p => p.tokenAddress), ...watchlist,
    ...profiles.map(p => p.tokenAddress)].filter(t => ADDRESS.test(t)))].slice(0, 30);
  if (!tokens.length) {
    if (warning) throw new Error('Data pasar tidak tersedia. Coba lagi atau gunakan mode Demo.');
    return { quotes: [], warning: 'Belum ada profil Solana; tambahkan alamat token di pengaturan.', fetchedAt: Date.now() };
  }
  const data = await getJson(`${API}/tokens/v1/solana/${tokens.join(',')}`, fetchFn);
  if (!Array.isArray(data)) throw new Error('Respons harga tidak valid.');
  const now = Date.now();
  const all = data.map(p => normalizePair(p, now)).filter(Boolean);
  const byToken = new Map();
  for (const q of all) {
    if (!tokens.includes(q.tokenAddress)) continue;
    if (!byToken.has(q.tokenAddress) || (q.liquidityUsd || 0) > (byToken.get(q.tokenAddress).liquidityUsd || 0)) byToken.set(q.tokenAddress, q);
  }
  // Held positions retain their exact entry pool. A different pool's price may
  // not trigger a stop or close a position with a stale quote.
  const quotes = [...byToken.values()];
  for (const p of positions) {
    const exact = all.find(q => q.key === p.key && q.tokenAddress === p.tokenAddress);
    if (exact && !quotes.some(q => q.key === exact.key)) quotes.push(exact);
  }
  return { quotes, warning, fetchedAt: now };
}

export function createDemoFeed(seed = 20261105) {
  let x = seed >>> 0;
  const random = () => { x += 0x6D2B79F5; let t = x; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const names = ['KOMET-D','KODOK-D','NORI-D','BARA-D','MEONG-D','PANDA-D','ORBIT-D','HUJAN-D'];
  const prices = names.map((_, i) => 0.002 * (i + 1));
  return {
    next(now = Date.now()) {
      return names.map((symbol, i) => {
        const move = (random() - 0.5) * 0.13;
        prices[i] = Math.max(0.0000001, prices[i] * (1 + move));
        return { key: `demo-pool-${i}`, tokenAddress: `demo-token-${i}`, chainId: 'solana',
          source: 'demo', symbol, name: 'Token fiktif untuk latihan', priceUsd: prices[i],
          liquidityUsd: 40_000 + random() * 650_000, volumeH1: 5_000 + random() * 320_000,
          buysM5: Math.floor(10 + random() * 220), sellsM5: Math.floor(10 + random() * 160),
          changeM5: move * 100, changeH1: (random() - 0.5) * 30,
          fdvUsd: 5_000_000 + i * 500_000, createdAt: now - (i + 1) * 7_200_000,
          observedAt: now, dex: 'Demo' };
      });
    },
    // Restoring a demo does not silently rebase a held token to a new price path.
    resume(positions = []) {
      for (const p of positions) {
        const i = names.indexOf(p.symbol);
        if (i >= 0 && p.markUsd > 0) prices[i] = p.markUsd;
      }
    }
  };
}

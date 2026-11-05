// All amounts in the ledger are IDR. Quotes are USD, converted at a fixed,
// user-specified reference rate. This engine cannot submit blockchain transactions.
export const SCHEMA = 1;
export const STALE_MS = 60_000;
export const DEFAULT_SETTINGS = Object.freeze({
  capital: 1_000_000, usdIdr: 16_000, positionPct: 8, maxPositions: 3,
  stopPct: 6, takeProfitPct: 12, trailPct: 4, trailActivationPct: 8,
  maxLossPct: 5, feePct: 0.3, slippagePct: 0.5,
  minLiquidity: 50_000, minVolumeH1: 10_000, minBuysM5: 25,
  minAgeMinutes: 30, minScore: 70, cooldownMinutes: 5
});

const RANGES = {
  capital: [10_000, 1e12], usdIdr: [1, 1e6], positionPct: [1, 20],
  maxPositions: [1, 5], stopPct: [1, 30], takeProfitPct: [2, 100],
  trailPct: [1, 20], trailActivationPct: [2, 50], maxLossPct: [1, 25],
  feePct: [0, 5], slippagePct: [0, 20], minLiquidity: [1_000, 1e10],
  minVolumeH1: [100, 1e10], minBuysM5: [1, 100_000],
  minAgeMinutes: [1, 1440], minScore: [1, 100], cooldownMinutes: [1, 1440]
};
const positive = x => Number.isFinite(x) && x > 0;
const nonnegative = x => Number.isFinite(x) && x >= 0;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function validateSettings(input = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...input };
  for (const [key, [min, max]] of Object.entries(RANGES)) {
    if (!Number.isFinite(settings[key]) || settings[key] < min || settings[key] > max)
      throw new Error(`Pengaturan ${key} harus di antara ${min} dan ${max}.`);
  }
  if (!Number.isInteger(settings.maxPositions) || !Number.isInteger(settings.minBuysM5))
    throw new Error('Jumlah posisi dan transaksi beli harus bilangan bulat.');
  if (settings.positionPct * settings.maxPositions > 80)
    throw new Error('Total alokasi posisi maksimal 80% saldo.');
  if (settings.trailActivationPct <= settings.trailPct)
    throw new Error('Aktivasi trailing harus lebih tinggi daripada jarak trailing.');
  return Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(k => [k, settings[k]]));
}

export function newSession(settings = DEFAULT_SETTINGS, mode = 'demo', now = Date.now()) {
  if (!['demo', 'live'].includes(mode)) throw new Error('Mode tidak dikenal.');
  settings = validateSettings(settings);
  return {
    schema: SCHEMA, settings, mode, running: false, riskHalted: false,
    createdAt: now, cash: settings.capital, netFlows: settings.capital,
    positions: [], closed: [], journal: [], history: [{ t: now, equity: settings.capital }],
    cooldowns: {}, counters: { scans: 0, examined: 0, passed: 0, entries: 0 },
    lastDataAt: 0, lastReport: null, sequence: 0
  };
}

export function validQuote(q, mode, now = Date.now()) {
  return !!q && q.source === mode && q.chainId === 'solana' &&
    typeof q.key === 'string' && q.key.length > 0 && q.key.length <= 100 &&
    typeof q.tokenAddress === 'string' && q.tokenAddress.length > 0 &&
    positive(q.priceUsd) && positive(q.observedAt) &&
    q.observedAt <= now + 1000 && now - q.observedAt <= STALE_MS;
}

export function estimatedValue(position, settings) {
  return position.quantity * position.markUsd * settings.usdIdr *
    (1 - settings.slippagePct / 100) * (1 - settings.feePct / 100);
}

export function portfolio(state, now = Date.now()) {
  const invested = state.positions.reduce((n, p) => n + estimatedValue(p, state.settings), 0);
  const equity = state.cash + invested;
  const pnl = equity - state.netFlows;
  const wins = state.closed.filter(t => t.pnl > 0).length;
  return { equity, invested, pnl, pnlPct: state.netFlows ? pnl / state.netFlows * 100 : 0,
    realized: state.closed.reduce((n, p) => n + p.pnl, 0),
    trades: state.closed.length, wins, winRate: state.closed.length ? wins / state.closed.length * 100 : null,
    stalePositions: state.positions.filter(p => now - p.lastQuoteAt > STALE_MS).length
  };
}

// Score is a heuristic from 0–100. It is NOT a probability of profit or token safety.
export function evaluate(q, settings, now = Date.now()) {
  const reasons = [];
  if (!positive(q.liquidityUsd) || q.liquidityUsd < settings.minLiquidity) reasons.push('Likuiditas rendah/tidak tersedia');
  if (!nonnegative(q.volumeH1) || q.volumeH1 < settings.minVolumeH1) reasons.push('Volume 1 jam kurang');
  if (!nonnegative(q.buysM5) || q.buysM5 < settings.minBuysM5) reasons.push('Transaksi beli 5m kurang');
  if (!nonnegative(q.sellsM5)) reasons.push('Data transaksi jual tidak tersedia');
  const total = (q.buysM5 || 0) + (q.sellsM5 || 0);
  const ratio = total > 0 ? q.buysM5 / total : 0;
  if (ratio < 0.55) reasons.push('Rasio beli di bawah 55%');
  if (!Number.isFinite(q.changeM5) || q.changeM5 < 0.5 || q.changeM5 > 20) reasons.push('Momentum 5m di luar 0,5–20%');
  if (!positive(q.createdAt) || now - q.createdAt < settings.minAgeMinutes * 60_000 || q.createdAt > now)
    reasons.push('Umur pool belum memenuhi syarat');
  if (!positive(q.fdvUsd)) reasons.push('FDV tidak tersedia');
  else if (positive(q.liquidityUsd) && q.fdvUsd / q.liquidityUsd > 50) reasons.push('FDV/likuiditas di atas 50×');
  const score = Math.round(
    clamp(Math.log10(Math.max(1, q.liquidityUsd || 0) / settings.minLiquidity + 1) * 36, 0, 25) +
    clamp(Math.log10(Math.max(1, q.volumeH1 || 0) / settings.minVolumeH1 + 1) * 32, 0, 20) +
    clamp(ratio * 30, 0, 30) +
    clamp((Number.isFinite(q.changeM5) ? q.changeM5 : 0) * 2, 0, 15) +
    (q.buysM5 >= settings.minBuysM5 * 2 ? 10 : 5)
  );
  if (score < settings.minScore) reasons.push(`Skor ${score} di bawah ${settings.minScore}`);
  return { quote: q, score, ratio, reasons, passed: reasons.length === 0 };
}

export function logEvent(state, type, message, now = Date.now(), details = {}) {
  state.journal.unshift({ id: ++state.sequence, t: now, type, message: String(message).slice(0, 300), ...details });
  state.journal = state.journal.slice(0, 1000);
}

export function openPosition(state, q, now = Date.now(), score = null) {
  const s = state.settings;
  if (!state.running || state.riskHalted || !validQuote(q, state.mode, now)) return false;
  if (state.positions.length >= s.maxPositions || state.positions.some(p => p.tokenAddress === q.tokenAddress)) return false;
  if ((state.cooldowns[q.tokenAddress] || 0) > now) return false;
  const budget = Math.min(portfolio(state, now).equity * s.positionPct / 100, state.cash);
  if (budget < 10_000 || !positive(budget)) return false;
  const fillIdr = q.priceUsd * s.usdIdr * (1 + s.slippagePct / 100);
  const quantity = budget / (fillIdr * (1 + s.feePct / 100));
  const position = {
    id: ++state.sequence, key: q.key, tokenAddress: q.tokenAddress,
    symbol: String(q.symbol || 'TOKEN').slice(0, 25), source: state.mode,
    quantity, cost: budget, entryUsd: q.priceUsd * (1 + s.slippagePct / 100),
    entryFee: budget - quantity * fillIdr,
    markUsd: q.priceUsd, lastQuoteAt: q.observedAt, openedAt: now,
    peakValue: 0, score
  };
  position.peakValue = estimatedValue(position, s);
  state.cash -= budget;
  if (Math.abs(state.cash) < 1e-7) state.cash = 0;
  state.positions.push(position);
  state.counters.entries += 1;
  logEvent(state, 'buy', `Beli simulasi ${position.symbol}`, now, { amount: budget, token: q.tokenAddress });
  return true;
}

export function closePosition(state, key, q, reason = 'Manual', now = Date.now()) {
  const index = state.positions.findIndex(p => p.key === key);
  if (index < 0 || !validQuote(q, state.mode, now) || q.key !== key) return false;
  const p = state.positions[index];
  if (q.tokenAddress !== p.tokenAddress) return false;
  p.markUsd = q.priceUsd;
  p.lastQuoteAt = q.observedAt;
  const proceeds = estimatedValue(p, state.settings);
  const pnl = proceeds - p.cost;
  const trade = { ...p, closedAt: now, exitUsd: q.priceUsd * (1 - state.settings.slippagePct / 100),
    exitFee: p.quantity * q.priceUsd * state.settings.usdIdr *
      (1 - state.settings.slippagePct / 100) * state.settings.feePct / 100,
    proceeds, pnl, pnlPct: pnl / p.cost * 100, reason };
  state.cash += proceeds;
  state.positions.splice(index, 1);
  state.closed.push(trade);
  // Keep the complete closed-trade ledger. Never truncate financial history.
  state.cooldowns[p.tokenAddress] = now + state.settings.cooldownMinutes * 60_000;
  logEvent(state, 'sell', `${p.symbol} · ${reason}`, now, { amount: proceeds, pnl, token: p.tokenAddress });
  return trade;
}

export function processTick(state, inputQuotes, now = Date.now()) {
  const quotes = inputQuotes.filter(q => validQuote(q, state.mode, now));
  const byKey = new Map(quotes.map(q => [q.key, q]));
  const s = state.settings;
  state.counters.scans += 1;
  state.counters.examined += quotes.length;
  if (quotes.length) state.lastDataAt = Math.max(...quotes.map(q => q.observedAt));
  for (const p of [...state.positions]) {
    const q = byKey.get(p.key);
    if (!q || p.tokenAddress !== q.tokenAddress) continue;
    p.markUsd = q.priceUsd;
    p.lastQuoteAt = q.observedAt;
    const value = estimatedValue(p, s);
    p.peakValue = Math.max(p.peakValue, value);
    const gain = (value / p.cost - 1) * 100;
    const peakGain = (p.peakValue / p.cost - 1) * 100;
    let reason = null;
    if (state.riskHalted) reason = 'Batas rugi sesi';
    else if (gain <= -s.stopPct) reason = 'Stop loss';
    else if (gain >= s.takeProfitPct) reason = 'Take profit';
    else if (peakGain >= s.trailActivationPct && value <= p.peakValue * (1 - s.trailPct / 100)) reason = 'Trailing stop';
    if (reason) closePosition(state, p.key, q, reason, now);
  }
  if (portfolio(state, now).pnlPct <= -s.maxLossPct && !state.riskHalted) {
    state.running = false;
    state.riskHalted = true;
    logEvent(state, 'risk', 'Batas rugi sesi tercapai. Beli dihentikan; posisi dengan harga segar ditutup.', now);
    for (const p of [...state.positions]) {
      const q = byKey.get(p.key);
      if (q) closePosition(state, p.key, q, 'Batas rugi sesi', now);
    }
  }
  const uniqueTokens = new Set();
  const candidates = quotes.filter(q => {
    if (uniqueTokens.has(q.tokenAddress)) return false;
    uniqueTokens.add(q.tokenAddress); return true;
  }).map(q => evaluate(q, s, now)).sort((a, b) => b.score - a.score);
  const passed = candidates.filter(c => c.passed);
  state.counters.passed += passed.length;
  const entriesBefore = state.counters.entries;
  if (state.running && !state.riskHalted) for (const c of passed) openPosition(state, c.quote, now, c.score);
  const report = { t: now, scanned: quotes.length, passed: passed.length,
    entered: state.counters.entries - entriesBefore,
    candidates: candidates.map(({ quote: q, ...rest }) => ({ ...rest, key: q.key, symbol: q.symbol, tokenAddress: q.tokenAddress })) };
  state.lastReport = report;
  state.history.push({ t: now, equity: portfolio(state, now).equity });
  state.history = state.history.slice(-600);
  for (const [token, until] of Object.entries(state.cooldowns)) if (until < now) delete state.cooldowns[token];
  return report;
}

export function moveVirtualCash(state, amount, now = Date.now()) {
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1e12) throw new Error('Nominal tidak valid.');
  if (amount < 0 && -amount > state.cash) throw new Error('Saldo bebas tidak cukup.');
  if (state.netFlows + amount < 10_000) throw new Error('Sisa modal sesi minimal Rp10.000.');
  if (state.positions.length) throw new Error('Tutup semua posisi sebelum mengubah modal sesi.');
  if (state.riskHalted) throw new Error('Mulai sesi baru setelah batas rugi tercapai.');
  state.cash += amount;
  state.netFlows += amount;
  state.history.push({ t: now, equity: portfolio(state, now).equity });
  logEvent(state, 'cash', amount > 0 ? 'Tambah modal virtual' : 'Kurangi modal virtual', now, { amount });
}

// Accept persisted state only after structural and ledger invariants hold.
// A restored session always requires a deliberate restart; cached prices cannot trade.
export function restoreSession(raw, expectedMode) {
  if (!raw || raw.schema !== SCHEMA || raw.mode !== expectedMode) throw new Error('Format sesi tidak sesuai.');
  const settings = validateSettings(raw.settings);
  if (!nonnegative(raw.cash) || !positive(raw.netFlows) || !positive(raw.createdAt) ||
    !Array.isArray(raw.positions) || !Array.isArray(raw.closed) ||
    !Array.isArray(raw.history) || !Array.isArray(raw.journal) ||
    raw.positions.length > settings.maxPositions) throw new Error('Data sesi rusak.');
  const addresses = new Set();
  for (const p of [...raw.positions, ...raw.closed]) {
    if (!p || typeof p.key !== 'string' || typeof p.tokenAddress !== 'string' ||
      typeof p.symbol !== 'string' || !positive(p.quantity) || !positive(p.cost) ||
      !positive(p.entryUsd) || !positive(p.markUsd) || !positive(p.openedAt) || !nonnegative(p.entryFee) ||
      !positive(p.lastQuoteAt) || !nonnegative(p.peakValue) || p.source !== expectedMode)
      throw new Error('Data posisi tidak valid.');
  }
  for (const p of raw.positions) {
    if (addresses.has(p.tokenAddress)) throw new Error('Posisi ganda tidak valid.');
    addresses.add(p.tokenAddress);
  }
  for (const t of raw.closed) if (!Number.isFinite(t.pnl) || !Number.isFinite(t.pnlPct) ||
    !nonnegative(t.proceeds) || !positive(t.exitUsd) || !nonnegative(t.exitFee) ||
    typeof t.reason !== 'string' || !positive(t.closedAt) || t.closedAt < t.openedAt ||
    Math.abs(t.proceeds - t.cost - t.pnl) > 0.01 ||
    Math.abs(t.pnl / t.cost * 100 - t.pnlPct) > 0.0001) throw new Error('Jurnal transaksi tidak valid.');
  const expectedCash = raw.netFlows + raw.closed.reduce((n, t) => n + t.pnl, 0) - raw.positions.reduce((n, p) => n + p.cost, 0);
  if (Math.abs(expectedCash - raw.cash) > 0.05) throw new Error('Rekonsiliasi saldo gagal.');
  if (raw.history.some(p => !positive(p.t) || !nonnegative(p.equity)) || !Number.isSafeInteger(raw.sequence) || raw.sequence < 0 ||
    !raw.counters || Object.values(raw.counters).some(v => !Number.isSafeInteger(v) || v < 0) ||
    !['scans','examined','passed','entries'].every(k => Number.isSafeInteger(raw.counters[k]))) throw new Error('Riwayat sesi tidak valid.');
  const state = structuredClone(raw);
  state.settings = settings;
  state.running = false;
  state.riskHalted = !!raw.riskHalted;
  state.lastReport = null;
  state.cooldowns = Object.fromEntries(Object.entries(raw.cooldowns || {}).filter(([k,v]) => k.length <= 100 && Number.isFinite(v)));
  return state;
}

export function csvForTrades(state) {
  const cell = v => {
    let text = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(text) && typeof v !== 'number') text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = [['mode','token','address','open_utc','close_utc','cost_idr','proceeds_idr','pnl_idr','pnl_pct','reason'],
    ...state.closed.map(t => [state.mode, t.symbol, t.tokenAddress, new Date(t.openedAt).toISOString(),
      new Date(t.closedAt).toISOString(), Number(t.cost.toFixed(2)), Number(t.proceeds.toFixed(2)), Number(t.pnl.toFixed(2)), Number(t.pnlPct.toFixed(4)), t.reason])];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}

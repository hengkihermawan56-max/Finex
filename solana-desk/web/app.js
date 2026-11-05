import { DEFAULT_SETTINGS, STALE_MS, newSession, restoreSession, portfolio,
  estimatedValue, validQuote, processTick, closePosition, moveVirtualCash,
  logEvent, csvForTrades, validateSettings } from './engine.js';
import { createDemoFeed, loadLiveQuotes, ADDRESS } from './market.js';

const $ = id => document.getElementById(id);
const idrFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const smallFormat = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const pctFormat = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 5 });
const clock = t => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const idr = n => idrFormat.format(n);
const pct = n => `${n > 0 ? '+' : ''}${pctFormat.format(n)}%`;
const color = n => n > 0.001 ? 'positive' : n < -0.001 ? 'negative' : 'neutral';
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageKey = mode => `hengki-solana-v1:${mode}`;
const blockedModes = new Set();
let toastTimer, storageWarning = false, feedError = '', feedWarning = '';
let mode = 'demo', watchlist = [], quotes = [], busy = false, requestId = 0, nextPoll = 0, nativeBackground = false;
try {
  mode = localStorage.getItem('hengki-solana-mode') === 'live' ? 'live' : 'demo';
  const list = JSON.parse(localStorage.getItem('hengki-solana-watchlist') || '[]');
  if (Array.isArray(list)) watchlist = list.filter(x => typeof x === 'string' && ADDRESS.test(x)).slice(0, 10);
} catch { storageWarning = true; }

function loadSession(currentMode) {
  try {
    const raw = localStorage.getItem(storageKey(currentMode));
    return raw ? restoreSession(JSON.parse(raw), currentMode) : newSession(DEFAULT_SETTINGS, currentMode);
  } catch {
    blockedModes.add(currentMode);
    return newSession(DEFAULT_SETTINGS, currentMode);
  }
}
let state = loadSession(mode);
let demoFeed = createDemoFeed(Date.now() >>> 0);
demoFeed.resume(state.positions);

const paths = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  layers:'<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  list:'<path d="M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="currentColor"/><circle cx="16" cy="17" r="3" fill="currentColor"/>',
  wallet:'<path d="M20 7H4V4h14M4 7v13h17V7M21 11h-6v5h6"/><path d="M17 13.5h.1"/>',
  trend:'<path d="m3 17 6-6 4 4 8-10M15 5h6v6"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  play:'<path d="m8 5 11 7-11 7z"/>', pause:'<path d="M8 5v14M16 5v14"/>',
  refresh:'<path d="M21 4v6h-6M3 20v-6h6M20 10a8 8 0 0 0-14-5M4 14a8 8 0 0 0 14 5"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 6h.01"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  filter:'<path d="M3 4h18l-7 8v6l-4 3v-9z"/>',
  chart:'<path d="M4 3v17h17M8 15v-4M13 15V7M18 15V5"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-8z"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  buy:'<path d="M12 20V4m-6 6 6-6 6 6"/>', sell:'<path d="M12 4v16m-6-6 6 6 6-6"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.info}</svg>`;
function icons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon)); }
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 4500); }

function persist() {
  if (blockedModes.has(mode)) return;
  try {
    localStorage.setItem(storageKey(mode), JSON.stringify(state));
    localStorage.setItem('hengki-solana-mode', mode);
    localStorage.setItem('hengki-solana-watchlist', JSON.stringify(watchlist));
  } catch {
    if (!storageWarning) toast('Penyimpanan lokal penuh/tidak tersedia. Ekspor jurnal sebelum menutup aplikasi.');
    storageWarning = true;
  }
}

function renderChart() {
  const data = state.history.slice(-160);
  if (!data.length) return;
  let min = Math.min(...data.map(p => p.equity)), max = Math.max(...data.map(p => p.equity));
  const pad = Math.max((max - min) * 0.22, state.netFlows * 0.002);
  min -= pad; max += pad;
  const coords = data.length === 1 ? [[0, 90], [700, 90]] : data.map((p, i) => [i / (data.length - 1) * 700, 160 - ((p.equity - min) / (max - min)) * 140]);
  const d = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  $('chart-line').setAttribute('d', d);
  $('chart-area').setAttribute('d', `${d} L700 180 L0 180Z`);
  const last = coords[coords.length - 1];
  $('chart-tip').setAttribute('cx', last[0]); $('chart-tip').setAttribute('cy', last[1]);
  $('chart-start').textContent = clock(data[0].t);
  $('chart-end').textContent = clock(data[data.length - 1].t);
  $('equity-chart').setAttribute('aria-label', `Ekuitas virtual ${idr(data[0].equity)} menjadi ${idr(data[data.length - 1].equity)}. Rentang vertikal mengikuti data.`);
}

function render() {
  const now = Date.now(), p = portfolio(state, now), s = state.settings;
  $('equity').textContent = idr(p.equity);
  $('pnl-percent').textContent = pct(p.pnlPct); $('pnl-percent').className = `performance ${color(p.pnl)}`;
  $('pnl').textContent = `${p.pnl > 0 ? '+' : ''}${idr(p.pnl)}`; $('pnl').className = color(p.pnl);
  $('net-flow').textContent = idr(state.netFlows);
  $('cash').textContent = idr(state.cash);
  $('realized').textContent = idr(p.realized); $('realized').className = color(p.realized);
  $('trade-count').textContent = `${p.trades} transaksi selesai`;
  $('winrate').textContent = p.winRate === null ? '—' : `${pctFormat.format(p.winRate)}%`;
  $('win-detail').textContent = p.trades ? `${p.wins} untung dari ${p.trades} transaksi` : 'Belum ada transaksi selesai';
  const fresh = state.lastDataAt && now - state.lastDataAt <= STALE_MS;
  $('feed-time').textContent = state.lastDataAt ? `${fresh ? 'Data' : 'Data lama'} ${clock(state.lastDataAt)}` : 'Belum ada data';
  $('run-status').textContent = state.riskHalted ? 'Batas rugi tercapai' : state.running ? 'Berjalan · paper' : 'Beli dijeda';
  $('status-dot').className = `status-dot ${state.running ? '' : 'paused'}`;
  $('toggle-label').textContent = state.running ? 'Jeda beli baru' : 'Mulai bot';
  $('toggle-run').classList.toggle('paused-action', state.running);
  $('toggle-run').firstElementChild.innerHTML = icon(state.running ? 'pause' : 'play');
  $('toggle-run').disabled = state.riskHalted || busy || blockedModes.has(mode);
  $('module-status').textContent = state.running ? 'RUNNING' : 'READY';
  $('source-label').textContent = mode === 'demo' ? 'DEMO FEED' : fresh ? 'DEXSCREENER' : 'MENUNGGU DATA';
  $('scan-interval').textContent = mode === 'demo' ? 'Demo · pembaruan 4 detik' : 'Harga pasar · pembaruan 15 detik';
  $('quote-count').textContent = `${quotes.length} pool terpantau`;
  $('notice').classList.toggle('live', mode === 'live');
  $('notice-text').textContent = mode === 'demo'
    ? 'MODE DEMO · Harga token fiktif untuk latihan. Seluruh saldo dan transaksi bersifat virtual.'
    : `PAPER + HARGA PASAR · Harga DEX Screener, transaksi virtual. Kurs referensi manual USD/IDR ${smallFormat.format(s.usdIdr)}; dapat diubah pada pengaturan.`;
  $('mode-demo').classList.toggle('selected', mode === 'demo');
  $('mode-live').classList.toggle('selected', mode === 'live');
  $('mode-demo').setAttribute('aria-pressed', mode === 'demo');
  $('mode-live').setAttribute('aria-pressed', mode === 'live');
  const warning = blockedModes.has(mode) ? 'Data tersimpan gagal direkonsiliasi. Sesi asli belum ditimpa. Pilih Sesi baru untuk mengatur ulang mode ini.'
    : feedError || (p.stalePositions ? `${p.stalePositions} posisi memakai harga lama. Ekuitas adalah nilai terakhir; stop menunggu data segar.` : '') || feedWarning;
  $('error-banner').hidden = !warning; $('error-banner').textContent = warning;
  $('risk-allocation').textContent = `${s.positionPct}%`;
  $('risk-stops').textContent = `−${s.stopPct}% / +${s.takeProfitPct}%`;
  $('risk-session').textContent = `−${s.maxLossPct}%`;
  $('risk-slots').textContent = `${state.positions.length} / ${s.maxPositions}`;
  $('allocation-bar').style.width = `${Math.min(100, p.invested / Math.max(1, p.equity) * 100)}%`;
  $('risk-caption').textContent = `Estimasi per sisi: biaya ${s.feePct}% + slippage ${s.slippagePct}%. Stop dievaluasi pada harga saat pembaruan; hasil dapat melewati batas.`;
  ['side-position-count', 'position-badge'].forEach(id => $(id).textContent = state.positions.length);
  $('refresh').disabled = busy;
  renderChart(); renderAgents(); renderCandidates(now); renderPositions(now); renderJournal();
}

function renderAgents() {
  const c = state.counters, r = state.lastReport;
  const rows = [
    ['Scout','search', mode === 'demo' ? 'Sumber harga fiktif' : 'Profil terbaru + watchlist', `${quotes.length} pool`],
    ['Filter','filter','Likuiditas, volume, umur & rasio beli',`${r?.passed || 0}/${r?.scanned || 0} lolos`],
    ['Analyst','chart','Skor momentum; bukan peluang profit',r?.candidates[0] ? `Top ${r.candidates[0].score}/100` : 'Menunggu'],
    ['Executor','bolt','Catat beli & jual virtual',`${c.entries} beli`],
    ['Risk','shield',`Stop −${state.settings.stopPct}% · trailing ${state.settings.trailPct}%`,state.riskHalted ? 'HALTED' : `${state.positions.length} posisi`],
    ['Journal','list','Riwayat keputusan & hasil sesi',`${state.closed.length} selesai`]
  ];
  $('agent-list').innerHTML = rows.map(([name,i,desc,value]) => `<div class="agent"><span class="agent-symbol">${icon(i)}</span><div class="agent-text"><strong>${name}</strong><small>${esc(desc)}</small></div><span class="agent-value">${esc(value)}</span></div>`).join('');
}

function renderCandidates(now) {
  const list = state.lastReport?.candidates || [];
  const byKey = new Map(quotes.map(q => [q.key, q]));
  const rows = list.slice(0, 8).map(c => {
    const q = byKey.get(c.key); if (!q) return '';
    const isFresh = validQuote(q, mode, now);
    const title = c.passed ? 'Seluruh syarat strategi terpenuhi; keamanan on-chain belum diverifikasi.' : c.reasons.join(' · ');
    return `<tr><td><button class="text-button token-cell" data-token="${esc(q.key)}" aria-label="Detail token ${esc(q.symbol)}"><span class="token-avatar">${esc(q.symbol.slice(0,1))}</span><span class="token-info"><b>${esc(q.symbol)}</b><small>${esc(q.dex)} · ${mode === 'demo' ? 'fiktif' : q.tokenAddress.slice(0,4)+'…'+q.tokenAddress.slice(-4)}</small></span></button></td><td>${esc(usdFormat.format(q.priceUsd))}</td><td class="${Number.isFinite(q.changeM5) ? color(q.changeM5) : 'neutral'}">${Number.isFinite(q.changeM5) ? esc(pct(q.changeM5)) : '—'}</td><td>${q.liquidityUsd === null ? '—' : '$'+esc(smallFormat.format(q.liquidityUsd))}</td><td><span class="score">${c.score}</span></td><td><span class="filter-pill ${!c.passed || !isFresh ? 'fail' : ''}" title="${esc(title)}">${!isFresh ? 'Data lama' : c.passed ? 'Lolos aturan' : 'Lewati'}</span></td></tr>`;
  }).join('');
  $('candidates-body').innerHTML = rows || '<tr><td colspan="6"><div class="empty-state"><span class="empty-title">Menunggu data token</span>Pindai data atau tambahkan alamat Solana di pengaturan.</div></td></tr>';
  $('market-note').textContent = mode === 'demo' ? 'Token berakhiran -D adalah fiktif. Skor tinggi tetap dapat menghasilkan kerugian.'
    : 'Kandidat dari profil terbaru DEX Screener + watchlist; bukan seluruh token baru Solana. Ketuk token untuk alasan filter.';
}

function renderPositions(now) {
  $('positions-list').innerHTML = state.positions.length ? state.positions.map(p => {
    const value = estimatedValue(p, state.settings), gain = value - p.cost;
    const q = quotes.find(q => q.key === p.key && q.tokenAddress === p.tokenAddress);
    const stale = !q || !validQuote(q, mode, now);
    return `<div class="position-row"><div class="token-cell"><span class="token-avatar">${esc(p.symbol.slice(0,1))}</span><span class="token-info"><b>${esc(p.symbol)}</b><small>${stale ? 'Harga lama · tunggu pembaruan' : 'Harga terpantau'} · ${esc(clock(p.openedAt))}</small></span></div><div class="position-value position-cost">${esc(idr(p.cost))}<small>Modal termasuk biaya beli</small></div><div class="position-value ${color(gain)}">${esc(idr(gain))}<small class="${color(gain)}">${esc(pct(gain/p.cost*100))} · ${esc(idr(value))}</small></div><button class="outline-button" data-close="${esc(p.key)}" ${stale ? 'disabled' : ''}>Tutup</button></div>`;
  }).join('') : '<div class="empty-state"><span class="empty-title">Belum ada posisi terbuka</span>Mulai bot untuk membeli secara virtual ketika syarat strategi terpenuhi.</div>';
}

function renderJournal() {
  const rows = state.journal.slice(0, 20);
  $('journal-list').innerHTML = rows.length ? rows.map(e => `<div class="journal-row"><span class="journal-time">${esc(clock(e.t))}</span><span class="journal-type ${esc(e.type)}">${icon(e.type === 'buy' ? 'buy' : e.type === 'sell' ? 'sell' : e.type === 'risk' ? 'shield' : 'info')}</span><span class="journal-message">${esc(e.message)}</span><span class="journal-amount ${Number.isFinite(e.pnl) ? color(e.pnl) : ''}">${Number.isFinite(e.pnl) ? esc(idr(e.pnl)) : Number.isFinite(e.amount) ? esc(idr(e.amount)) : ''}</span></div>`).join('') : '<div class="empty-state"><span class="empty-title">Sesi siap dimulai</span>Jurnal akan mencatat keputusan saat Anda menjalankan bot.</div>';
}

async function refreshMarket() {
  if (busy || document.hidden || nativeBackground) return;
  const version = ++requestId, session = state, currentMode = mode;
  busy = true; render();
  try {
    const result = currentMode === 'demo' ? { quotes: demoFeed.next(), warning: '' } : await loadLiveQuotes(session.positions, watchlist);
    if (version !== requestId || session !== state) return;
    quotes = result.quotes;
    feedWarning = result.warning || ''; feedError = '';
    if (!quotes.length && state.running) {
      state.running = false;
      logEvent(state, 'risk', 'Tidak ada harga valid. Beli dijeda.');
    }
    processTick(state, quotes);
    persist();
  } catch (err) {
    if (version !== requestId || session !== state) return;
    state.running = false;
    feedError = 'Data pasar gagal diperbarui. Beli dijeda; periksa internet lalu tekan Mulai bot. Harga terakhir tetap ditampilkan.';
    logEvent(state, 'risk', 'Pembaruan pasar gagal; beli dijeda.');
    persist();
  } finally {
    if (version === requestId) { busy = false; nextPoll = Date.now() + (mode === 'demo' ? 4000 : 15000); render(); }
  }
}

function showModal(title, content) {
  $('modal-title').textContent = title; $('modal-body').innerHTML = content;
  icons($('modal-body')); if (!$('modal').open) $('modal').showModal();
}
const formError = message => { const el = $('form-error'); if (el) el.textContent = message; };

function resetCurrent(settings = state.settings) {
  state.running = false; requestId++; busy = false;
  state = newSession(settings, mode);
  blockedModes.delete(mode);
  quotes = []; feedError = ''; feedWarning = '';
  demoFeed = createDemoFeed(Date.now() >>> 0);
  persist(); $('modal').close(); render(); refreshMarket();
}

function showSettings() {
  const fields = [
    ['capital','Modal awal virtual (Rp)',1000], ['usdIdr','USD/IDR referensi manual',1],
    ['positionPct','Alokasi per posisi (%)',1], ['maxPositions','Maksimal posisi bersamaan',1],
    ['stopPct','Stop loss (%)',0.5], ['takeProfitPct','Take profit (%)',0.5],
    ['trailPct','Jarak trailing (%)',0.5], ['trailActivationPct','Aktivasi trailing pada profit (%)',0.5],
    ['maxLossPct','Batas rugi sesi (%)',0.5], ['minScore','Skor minimal (1–100)',1],
    ['feePct','Biaya simulasi per sisi (%)',0.1], ['slippagePct','Slippage per sisi (%)',0.1],
    ['minLiquidity','Likuiditas minimal (USD)',1000], ['minVolumeH1','Volume 1 jam minimal (USD)',1000],
    ['minBuysM5','Transaksi beli 5m minimal',1], ['minAgeMinutes','Umur pool minimal (menit)',1],
    ['cooldownMinutes','Jeda beli ulang token (menit)',1]
  ];
  showModal('Pengaturan sesi', `<p class="modal-intro">Menyimpan pengaturan membuat sesi baru pada mode <b>${mode === 'demo' ? 'Demo' : 'Harga pasar'}</b> dan menghapus jurnal mode ini. Ekspor CSV lebih dahulu bila diperlukan. Kurs adalah asumsi manual, bukan kurs terkini.</p><form id="settings-form"><div class="form-grid">${fields.map(([key,label,step]) => `<label>${esc(label)}<input name="${key}" type="number" required step="any" value="${state.settings[key]}" inputmode="decimal"></label>`).join('')}</div><label class="field">Watchlist alamat mint Solana (opsional, maksimal 10)<textarea name="watchlist" rows="3" placeholder="Satu alamat per baris">${esc(watchlist.join('\n'))}</textarea><small>Gunakan alamat mint, bukan nama token. Aktif hanya pada mode Harga pasar.</small></label><div id="form-error" class="form-error" role="alert"></div><div class="form-actions"><button type="button" data-dismiss>Batal</button><button class="confirm" type="submit">Simpan sesi baru</button></div></form>`);
  $('settings-form').addEventListener('submit', e => {
    e.preventDefault();
    try {
      const data = new FormData(e.target), input = { ...state.settings };
      for (const [key] of fields) input[key] = Number(data.get(key));
      const settings = validateSettings(input);
      const list = String(data.get('watchlist')).split(/[\s,;]+/).filter(Boolean);
      if (list.length > 10 || list.some(t => !ADDRESS.test(t))) throw new Error('Watchlist harus berisi maksimal 10 alamat mint Solana yang valid.');
      watchlist = [...new Set(list)]; resetCurrent(settings); toast('Sesi baru disimpan. Tekan Mulai bot untuk menjalankan.');
    } catch (err) { formError(err.message); }
  });
}

function exportCsv() {
  const csv = csvForTrades(state), filename = `HENGKI-${mode}-${new Date().toISOString().slice(0,10)}.csv`;
  if (globalThis.AndroidExport?.saveCsv) { globalThis.AndroidExport.saveCsv(csv); toast('Pilih lokasi untuk menyimpan jurnal.'); return; }
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  toast(`${state.closed.length} transaksi selesai diekspor.`);
}

const actions = {
  settings: showSettings,
  export: exportCsv,
  reset() {
    showModal('Mulai sesi baru', `<p class="modal-intro">Saldo akan kembali ke <b>${esc(idr(state.settings.capital))}</b>. Posisi dan jurnal pada mode ${mode === 'demo' ? 'Demo' : 'Harga pasar'} akan dihapus. Mode lain tetap tersimpan.</p><div class="form-actions"><button id="export-before-reset">Ekspor CSV</button><button data-dismiss>Batal</button><button id="confirm-reset" class="confirm">Mulai sesi baru</button></div>`);
    $('export-before-reset').onclick = exportCsv;
    $('confirm-reset').onclick = () => { resetCurrent(); toast('Sesi diatur ulang.'); };
  },
  cash() {
    if (state.positions.length) { toast('Tutup semua posisi sebelum mengubah modal virtual.'); return; }
    showModal('Ubah modal virtual', `<p class="modal-intro">Saldo bebas ${esc(idr(state.cash))}. Masukkan angka positif untuk menambah atau negatif untuk mengurangi modal. Perubahan modal tidak dihitung sebagai profit. Tidak ada transfer uang nyata.</p><form id="cash-form"><label class="field">Perubahan modal (Rp)<input type="number" name="amount" step="1000" required placeholder="Contoh: 100000 atau -50000" inputmode="text"></label><div class="form-error" id="form-error" role="alert"></div><div class="form-actions"><button type="button" data-dismiss>Batal</button><button type="submit" class="confirm">Simpan perubahan</button></div></form>`);
    $('cash-form').onsubmit = e => {
      e.preventDefault();
      try { moveVirtualCash(state, Number(new FormData(e.target).get('amount'))); persist(); $('modal').close(); render(); toast('Modal virtual diperbarui.'); }
      catch (err) { formError(err.message); }
    };
  },
  about() {
    showModal('Strategi & sumber data', `<p class="modal-intro">HENGKI Solana Desk v1.0.0 · Enam modul perangkat lunak berbasis aturan. Semua keputusan dan hasil adalah simulasi.</p><ol class="about-list"><li><b>Scout:</b> mode Demo membuat token fiktif. Mode Harga pasar membaca profil terbaru DEX Screener serta watchlist, maksimal 30 alamat per siklus. Ini bukan pemindai seluruh token baru di Pump.fun/Raydium.</li><li><b>Filter:</b> memeriksa likuiditas, volume 1h, transaksi 5m, rasio beli ≥55%, momentum 5m 0,5–20%, umur pool dan FDV/likuiditas ≤50×. Data yang hilang tidak dianggap lolos.</li><li><b>Analyst:</b> skor 0–100 merangkum momentum, likuiditas dan aktivitas. Skor bukan probabilitas profit. Verifikasi mint/freeze authority, holder dan penguncian LP belum diterapkan.</li><li><b>Executor:</b> mencatat beli/jual virtual dalam rupiah, menggunakan kurs manual tetap serta estimasi biaya dan slippage per sisi. Tidak menautkan dompet atau menandatangani transaksi.</li><li><b>Risk:</b> memantau stop loss, take profit, trailing stop, batas rugi sesi dan jeda beli ulang. Stop hanya dievaluasi saat ada harga segar; gap harga dapat membuat kerugian melewati batas. Harga DEX merupakan snapshot agregator, bukan kuotasi eksekusi.</li><li><b>Journal:</b> menyimpan sesi Demo dan Harga pasar secara terpisah pada perangkat. Buka ulang aplikasi selalu dalam keadaan beli dijeda. Aplikasi tidak memantau posisi ketika ditutup atau dipindahkan ke latar belakang.</li></ol><p class="modal-note">Referensi: <a href="https://docs.dexscreener.com/api/reference" target="_blank" rel="noopener noreferrer">DEX Screener API</a> · <a href="https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts" target="_blank" rel="noopener noreferrer">GitHub Actions</a></p>`);
  }
};

async function switchMode(next) {
  if (next === mode || !['demo', 'live'].includes(next)) return;
  const apply = () => {
    state.running = false; persist(); requestId++; busy = false;
    mode = next; state = loadSession(mode); quotes = []; feedError = ''; feedWarning = '';
    demoFeed = createDemoFeed(Date.now() >>> 0); demoFeed.resume(state.positions);
    persist(); $('modal').close(); render(); refreshMarket();
  };
  if (state.positions.length) {
    showModal('Pindah sumber data', '<p class="modal-intro">Posisi sesi ini disimpan dan berhenti dipantau sampai Anda kembali ke mode ini. Saldo kedua mode terpisah.</p><div class="form-actions"><button data-dismiss>Batal</button><button id="confirm-mode" class="confirm">Pindah mode</button></div>');
    $('confirm-mode').onclick = apply;
  } else apply();
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]'); if (a) actions[a.dataset.action]?.();
  const m = e.target.closest('[data-mode]'); if (m) switchMode(m.dataset.mode);
  if (e.target.closest('[data-dismiss]')) $('modal').close();
  const close = e.target.closest('[data-close]');
  if (close) {
    const q = quotes.find(q => q.key === close.dataset.close);
    const result = closePosition(state, close.dataset.close, q, 'Manual');
    if (!result) toast('Harga tidak segar. Perbarui data lebih dahulu.');
    else { persist(); render(); toast('Posisi virtual ditutup.'); }
  }
  const token = e.target.closest('[data-token]');
  if (token) {
    const q = quotes.find(q => q.key === token.dataset.token);
    const c = state.lastReport?.candidates.find(c => c.key === token.dataset.token);
    if (!q || !c) return;
    showModal(`Detail ${q.symbol}`, `<p class="modal-intro">${mode === 'demo' ? 'Token fiktif · harga demo' : 'Solana · DEX Screener'} · Skor strategi ${c.score}/100.</p><div class="full-address">${esc(q.tokenAddress)}</div><ul class="about-list">${c.reasons.length ? c.reasons.map(r => `<li>${esc(r)}</li>`).join('') : '<li>Semua syarat strategi terpenuhi.</li>'}<li>Keamanan on-chain belum diverifikasi.</li><li>Data diterima perangkat: ${esc(clock(q.observedAt))}.</li></ul>${mode === 'live' && ADDRESS.test(q.key) ? `<a class="outline-button" target="_blank" rel="noopener noreferrer" href="https://dexscreener.com/solana/${esc(q.key)}">Lihat pool di DEX Screener ↗</a>` : ''}`);
  }
});
$('modal-close').onclick = () => $('modal').close();
$('refresh').onclick = refreshMarket;
$('toggle-run').onclick = async () => {
  if (busy || state.riskHalted || blockedModes.has(mode)) return;
  if (state.running) { state.running = false; logEvent(state, 'info', 'Beli baru dijeda; posisi tetap dipantau saat aplikasi terbuka.'); persist(); render(); return; }
  state.running = true; logEvent(state, 'info', 'Bot paper dimulai. Pembelian mengikuti syarat strategi.');
  persist(); await refreshMarket();
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Invalidate in-flight responses too; a late response must never open a trade.
    requestId++; busy = false;
    if (state.running) { state.running = false; logEvent(state, 'risk', 'Aplikasi masuk latar belakang. Beli dijeda; pemantauan berhenti sampai dibuka lagi.'); persist(); }
  } else { render(); refreshMarket(); }
});
window.addEventListener('pagehide', () => { state.running = false; persist(); });
globalThis.HengkiDesk = Object.freeze({
  pauseForBackground() {
    nativeBackground = true; requestId++; busy = false;
    if (state.running) logEvent(state, 'risk', 'Aplikasi masuk latar belakang. Beli dan pemantauan dijeda.');
    state.running = false; persist();
  },
  resumeForeground() { nativeBackground = false; state.running = false; render(); refreshMarket(); }
});

icons(); render();
if (storageWarning) toast('Penyimpanan perangkat tidak tersedia; sesi mungkin tidak tersimpan.');
refreshMarket();
setInterval(() => { if (document.hidden || nativeBackground) return; if (!busy && Date.now() >= nextPoll) refreshMarket(); else render(); }, 1000);
if ('serviceWorker' in navigator && location.protocol === 'https:' && location.hostname !== 'appassets.androidplatform.net') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

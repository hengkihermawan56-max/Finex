import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, STALE_MS, newSession, validQuote, evaluate, openPosition,
  closePosition, processTick, portfolio, moveVirtualCash, restoreSession, csvForTrades,
  validateSettings } from '../web/engine.js';
const T = 1793836800000;
function quote(overrides = {}) { return { key:'pool-one',tokenAddress:'token-one',source:'demo',chainId:'solana',symbol:'TEST-D',
  priceUsd:1, observedAt:T, liquidityUsd:500_000,volumeH1:200_000,buysM5:180,sellsM5:30,
  changeM5:5,fdvUsd:10_000_000,createdAt:T-3600_000, ...overrides }; }
function started(settings = {}) { const s = newSession({ ...DEFAULT_SETTINGS,...settings },'demo',T); s.running=true; return s; }
const near = (a,b) => assert.ok(Math.abs(a-b) < 0.00001, `${a} != ${b}`);

test('new sessions start paused with Rp1m and zero profit', () => {
  const s=newSession(DEFAULT_SETTINGS,'demo',T), p=portfolio(s,T);
  assert.equal(s.running,false); assert.equal(p.equity,1_000_000); assert.equal(p.pnl,0); assert.equal(p.winRate,null);
});
test('invalid numeric configuration and excessive allocation rejected', () => {
  for(const patch of [{capital:NaN},{feePct:-1},{usdIdr:0},{maxPositions:1.5},{positionPct:20,maxPositions:5},{trailPct:10,trailActivationPct:5}])
    assert.throws(()=>validateSettings(patch));
});
test('quotes must match mode, chain, timestamp and finite positive price', () => {
  assert.ok(validQuote(quote(),'demo',T));
  for(const patch of [{source:'live'},{chainId:'ethereum'},{priceUsd:0},{priceUsd:NaN},{priceUsd:Infinity},{observedAt:T-STALE_MS-1},{observedAt:T+5000}])
    assert.equal(validQuote(quote(patch),'demo',T),false);
});
test('missing liquidity, age, transaction and momentum fields cannot pass a filter', () => {
  assert.ok(evaluate(quote(),DEFAULT_SETTINGS,T).passed);
  for(const patch of [{liquidityUsd:null},{volumeH1:undefined},{createdAt:undefined},{sellsM5:null},{buysM5:null},{changeM5:NaN},{fdvUsd:null}])
    assert.equal(evaluate(quote(patch),DEFAULT_SETTINGS,T).passed,false);
});
test('8% budget includes entry fee and cash never goes negative', () => {
  const s=started(); assert.equal(openPosition(s,quote(),T),true);
  assert.equal(s.cash,920_000); assert.equal(s.positions[0].cost,80_000);
  const q=80_000/(1.005*16_000*1.003); near(s.positions[0].quantity,q);
  assert.equal(openPosition(s,quote(),T),false);
});
test('round trip at unchanged price loses costs instead of generating profit', () => {
  const s=started(); openPosition(s,quote(),T); const t=closePosition(s,'pool-one',quote(),'Manual',T);
  const expected=80_000/1.005/1.003*0.995*0.997;
  near(t.proceeds,expected); near(t.pnl,expected-80_000);
  assert.ok(t.pnl<0); near(portfolio(s,T).equity,1_000_000+t.pnl);
  assert.equal(portfolio(s,T).winRate,0);
});
test('stale, wrong-pool or other-mode quote cannot close an active position', () => {
  const s=started(); openPosition(s,quote(),T);
  assert.equal(closePosition(s,'pool-one',quote({observedAt:T-STALE_MS-10}),'Manual',T),false);
  assert.equal(closePosition(s,'pool-one',quote({source:'live'}),'Manual',T),false);
  assert.equal(closePosition(s,'pool-one',quote({key:'other-pool'}),'Manual',T),false);
  assert.equal(closePosition(s,'pool-one',quote({tokenAddress:'other-token'}),'Manual',T),false);
  assert.equal(s.positions.length,1);
});
test('stop loss closes at the observed price and respects cooldown', () => {
  const s=started(); openPosition(s,quote(),T);
  processTick(s,[quote({priceUsd:0.90,observedAt:T+15000})],T+15000);
  assert.equal(s.positions.length,0); assert.equal(s.closed.length,1);
  assert.equal(s.closed[0].reason,'Stop loss'); assert.ok(s.closed[0].pnlPct < -6);
  assert.equal(openPosition(s,quote({observedAt:T+16000}),T+16000),false);
});
test('take profit is net of estimated costs', () => {
  const s=started(); openPosition(s,quote(),T);
  processTick(s,[quote({priceUsd:1.16,observedAt:T+15000})],T+15000);
  assert.equal(s.closed[0].reason,'Take profit'); assert.ok(s.closed[0].pnlPct >= 12);
});
test('trailing stop activates after net profit threshold', () => {
  const s=started({takeProfitPct:50}); openPosition(s,quote(),T);
  processTick(s,[quote({priceUsd:1.13,observedAt:T+15000})],T+15000);
  assert.equal(s.positions.length,1);
  processTick(s,[quote({priceUsd:1.07,observedAt:T+30000})],T+30000);
  assert.equal(s.closed[0].reason,'Trailing stop');
});
test('session loss cap latches, liquidates available quotes and prevents new entries', () => {
  const s=started({maxLossPct:1,stopPct:30});
  openPosition(s,quote(),T);
  processTick(s,[quote({priceUsd:0.8,observedAt:T+15000})],T+15000);
  assert.equal(s.riskHalted,true); assert.equal(s.running,false); assert.equal(s.positions.length,0);
  s.running=true; assert.equal(openPosition(s,quote({tokenAddress:'two'}),T),false);
});
test('halted session waits for missing position quote before liquidating it', () => {
  const s=started({maxLossPct:1,stopPct:30});
  openPosition(s,quote(),T); openPosition(s,quote({key:'pool-two',tokenAddress:'token-two'}),T);
  processTick(s,[quote({priceUsd:0.8,observedAt:T+15000})],T+15000);
  assert.equal(s.riskHalted,true); assert.equal(s.positions.length,1);
  processTick(s,[quote({key:'pool-two',tokenAddress:'token-two',observedAt:T+30000})],T+30000);
  assert.equal(s.positions.length,0); assert.equal(s.closed[1].reason,'Batas rugi sesi');
});
test('pause blocks new entries but still processes exits using fresh data', () => {
  const s=started(); openPosition(s,quote(),T); s.running=false;
  processTick(s,[quote({priceUsd:0.9,observedAt:T+15000}),quote({key:'two',tokenAddress:'two',observedAt:T+15000})],T+15000);
  assert.equal(s.closed.length,1); assert.equal(s.positions.length,0);
});
test('stale data changes neither quantity nor marks and is surfaced as stale', () => {
  const s=started(); openPosition(s,quote(),T);
  processTick(s,[quote({priceUsd:0.01})],T+STALE_MS+1);
  assert.equal(s.positions.length,1); assert.equal(s.positions[0].markUsd,1);
  assert.equal(portfolio(s,T+STALE_MS+1).stalePositions,1);
});
test('position limit holds even when every candidate qualifies', () => {
  const s=started(); processTick(s,Array.from({length:10},(_,i)=>quote({key:`pool${i}`,tokenAddress:`token${i}`})),T);
  assert.equal(s.positions.length,3); assert.ok(s.cash>=0); assert.equal(s.counters.entries,3);
});
test('deposits and withdrawals do not create fake gains', () => {
  const s=started(); moveVirtualCash(s,200_000,T); assert.equal(portfolio(s,T).pnl,0);
  moveVirtualCash(s,-100_000,T); assert.equal(portfolio(s,T).pnl,0);
  assert.throws(()=>moveVirtualCash(s,-2_000_000,T));
  openPosition(s,quote(),T); assert.throws(()=>moveVirtualCash(s,10_000,T));
});
test('saved session restores paused and rejects corrupt or mixed-mode ledgers', () => {
  const s=started(); openPosition(s,quote(),T); closePosition(s,'pool-one',quote(),'Manual',T);
  const raw=JSON.parse(JSON.stringify(s));
  assert.equal(restoreSession(raw,'demo').running,false);
  assert.throws(()=>restoreSession(raw,'live'));
  assert.throws(()=>restoreSession({...raw,cash:raw.cash+10_000},'demo'));
  assert.throws(()=>restoreSession({...raw,counters:{scans:-1}},'demo'));
  const broken=structuredClone(raw); delete broken.closed[0].pnlPct;
  assert.throws(()=>restoreSession(broken,'demo'));
});
test('mode separation and actual counters are maintained', () => {
  const s=started(); processTick(s,[quote(),quote({key:'other',tokenAddress:'other',source:'live'})],T);
  assert.equal(s.counters.scans,1); assert.equal(s.counters.examined,1);
  assert.equal(s.counters.entries,1); assert.equal(s.lastReport.scanned,1);
  assert.equal(newSession(DEFAULT_SETTINGS,'live',T).cash,1_000_000);
});
test('CSV exports complete closed ledger and neutralizes spreadsheet formulas', () => {
  const s=started(); openPosition(s,quote({symbol:'=HYPERLINK("bad")'}),T);
  closePosition(s,'pool-one',quote(),'Manual',T);
  const csv=csvForTrades(s); assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('pnl_idr')); assert.equal(csv.split('\r\n').length,2);
  assert.ok(!csv.includes("'-")); // negative numeric P&L remains a numeric CSV field
});

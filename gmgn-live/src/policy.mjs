export const SOL = 'So11111111111111111111111111111111111111112';
export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function address(value) {
  if (typeof value !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  let n = 0n; for (const ch of value) n = n * 58n + BigInt(alphabet.indexOf(ch));
  let bytes = 0; while (n) { n >>= 8n; bytes++; }
  return bytes + (value.match(/^1*/)?.[0].length || 0) === 32;
}
export function raw(value) {
  if (typeof value !== 'string' || !/^\d{1,32}$/.test(value)) throw Error('INVALID_RAW_AMOUNT');
  return BigInt(value);
}
export function lamports(value) {
  if (typeof value !== 'string' || !/^\d{1,8}(?:\.\d{1,9})?$/.test(value)) throw Error('INVALID_SOL_AMOUNT');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9,'0'));
}
export function sol(value) { const n=BigInt(value); return `${n<0n?'-':''}${(n<0n?-n:n)/1_000_000_000n}.${((n<0n?-n:n)%1_000_000_000n).toString().padStart(9,'0')}`; }
const number = value => value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
const yes = value => value === true || value === 1 || value === 'true' || value === '1';
export function validateConfig(input) {
  const c = structuredClone(input);
  for (const key of ['budgetSol','orderSol','maxLossSol','reserveSol','priorityFeeSol','tipFeeSol']) lamports(c[key]);
  if (c.wallet !== '' && !address(c.wallet)) throw Error('INVALID_WALLET');
  if (!Array.isArray(c.watchlist) || c.watchlist.length > 20 || c.watchlist.some(a=>!address(a)||a===SOL)) throw Error('INVALID_WATCHLIST');
  const bounds = {maxDailyOrders:[1,50],slippagePct:[1,10],maxRoundTripLossPct:[1,15],takeProfitPct:[3,100],stopLossPct:[1,30],minLiquidityUsd:[10000,1e10],minVolumeH1Usd:[1000,1e10],maxTop10Ratio:[0.01,0.3],maxRugRatio:[0.01,0.3],minAgeMinutes:[10,1440],pollSeconds:[20,3600]};
  for (const [key,[lo,hi]] of Object.entries(bounds)) if (!Number.isFinite(c[key])||c[key]<lo||c[key]>hi) throw Error(`INVALID_${key}`);
  if (!Number.isInteger(c.maxDailyOrders)||!Number.isInteger(c.slippagePct)) throw Error('INTEGER_CONFIG_REQUIRED');
  if (lamports(c.orderSol)>lamports(c.budgetSol)||lamports(c.maxLossSol)>lamports(c.budgetSol)) throw Error('LIMIT_EXCEEDS_BUDGET');
  return c;
}
export function activationProblems(c) {
  const problems=[];
  if(!address(c.wallet))problems.push('Alamat dompet GMGN belum diisi.');
  for(const [key,label] of [['budgetSol','batas pembelian sesi'],['orderSol','nominal beli'],['maxLossSol','batas rugi sesi']])if(lamports(c[key])<=0n)problems.push(`${label} harus ditentukan dalam SOL.`);
  if(lamports(c.reserveSol)<lamports('0.005'))problems.push('Cadangan biaya minimal 0,005 SOL.');
  if(lamports(c.priorityFeeSol)<=0n||lamports(c.tipFeeSol)<=0n)problems.push('Priority fee dan tip harus ditentukan.');
  return problems;
}
export function screenToken(info, security, config, now=Date.now()) {
  const reasons=[], p=info?.price||{}, pool=info?.pool||{};
  const price=number(p.price), old=number(p.price_5m), volume=number(p.volume_1h);
  const liquidity=number(pool.liquidity), buy=number(p.buy_volume_5m), sell=number(p.sell_volume_5m);
  const created=number(info?.creation_timestamp), top=number(security?.top_10_holder_rate), rug=number(security?.rug_ratio);
  if(!(price>0&&old>0))reasons.push('Harga/momentum tidak tersedia');
  const momentum=price>0&&old>0?(price/old-1)*100:null;
  if(momentum===null||momentum<0.5||momentum>20)reasons.push('Momentum di luar 0,5–20%');
  if(liquidity===null||liquidity<config.minLiquidityUsd)reasons.push('Likuiditas kurang/tidak tersedia');
  if(volume===null||volume<config.minVolumeH1Usd)reasons.push('Volume 1 jam kurang/tidak tersedia');
  if(!(buy>=0&&sell>0&&buy/(buy+sell)>=0.55))reasons.push('Arus beli/jual belum memenuhi syarat');
  if(!(created>0&&created*1000<=now&&now-created*1000>=config.minAgeMinutes*60000))reasons.push('Umur token kurang/tidak diketahui');
  if(!yes(security?.renounced_mint)||!yes(security?.renounced_freeze_account))reasons.push('Otoritas mint/freeze belum dinyatakan dicabut');
  if(top===null||top<0||top>config.maxTop10Ratio)reasons.push('Konsentrasi holder tinggi/tidak diketahui');
  if(rug===null||rug<0||rug>config.maxRugRatio)reasons.push('Indikator rug tinggi/tidak diketahui');
  if(security?.is_wash_trading!==false)reasons.push('Pemeriksaan wash trading tidak bersih/tidak tersedia');
  if(yes(security?.is_honeypot)||security?.is_honeypot==='yes'||security?.honeypot===1||yes(security?.can_not_sell))reasons.push('Indikasi hambatan menjual');
  return {passed:reasons.length===0,reasons,momentum,priceUsd:price,liquidityUsd:liquidity};
}
export function validateMint(account) {
  const value=account?.value, data=value?.data?.parsed;
  if(value?.owner!==TOKEN_PROGRAM||data?.type!=='mint'||data.info?.isInitialized!==true||
    data.info.mintAuthority!==null||data.info.freezeAuthority!==null||
    !Number.isInteger(data.info.decimals)||data.info.decimals<0||data.info.decimals>9) throw Error('MINT_NOT_ALLOWED');
  return data.info.decimals;
}
export function checkedQuote(q,input,output,amount,slippage) {
  if(q?.input_token!==input||q?.output_token!==output||raw(q?.input_amount)!==BigInt(amount)||
    raw(q?.output_amount)<=0n||raw(q?.min_output_amount)<=0n||raw(q.min_output_amount)>raw(q.output_amount)||
    typeof q.slippage!=='number'||q.slippage<0||q.slippage>slippage)throw Error('INVALID_QUOTE');
  return q;
}
export function receipt(result,intent) {
  const confirmation=result?.confirmation?.state;
  const confirmed=confirmation==='confirmed'||result?.status==='confirmed'||(result?.status==='successful'&&result?.state===30);
  const failed=['failed','expired'].includes(confirmation)||['failed','expired'].includes(result?.status);
  if(failed)return {state:'failed'};
  if(!confirmed)return {state:'pending'};
  const r=result.report||result;
  const input=r.input_token, output=r.output_token;
  const spent=r.input_amount??r.filled_input_amount, received=r.output_amount??r.filled_output_amount;
  if(input!==intent.input_token||output!==intent.output_token||raw(spent)<=0n||raw(spent)>raw(intent.input_amount)||raw(received)<raw(intent.min_output_amount||'1')||
    typeof result.hash!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(result.hash))throw Error('RECEIPT_MISMATCH');
  return {state:'confirmed',spent,received,hash:result.hash,strategyId:result.strategy_order_id||null};
}

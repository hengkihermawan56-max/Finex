import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {LiveEngine} from '../src/engine.mjs';
import {Store} from '../src/store.mjs';
import {SOL,TOKEN_PROGRAM,validateConfig} from '../src/policy.mjs';
const T='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',W='JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN';
const sample=JSON.parse(await readFile(new URL('../config.example.json',import.meta.url)));
const config=validateConfig({...sample,wallet:W,budgetSol:'0.2',orderSol:'0.01',maxLossSol:'0.02',watchlist:[T]});
const quote=(input,output,amount,out='10000000')=>({input_token:input,output_token:output,input_amount:String(amount),output_amount:out,min_output_amount:out,slippage:2});
async function fixture(){
 const dir=await mkdtemp(path.join(os.tmpdir(),'gmgn-test-')),store=new Store(path.join(dir,'state.json')),state=await store.load();
 const calls=[];const gmgn={apiKey:'synthetic',key:{},blockedUntil:0,
  holdings:async()=>({}),trending:async()=>({rank:[{address:T,chain:'sol'}]}),
  info:async()=>({price:{price:'1.05',price_5m:'1',volume_1h:'50000',buy_volume_5m:'20000',sell_volume_5m:'10000'},pool:{liquidity:'200000'},creation_timestamp:1700000000}),
  security:async()=>({renounced_mint:true,renounced_freeze_account:true,top_10_holder_rate:0.1,rug_ratio:0.1,is_wash_trading:false}),
  quote:async(w,input,output,amount)=>quote(input,output,amount),
  swap:async body=>{calls.push(structuredClone(body));return {order_id:'o-1',status:'pending'};},
  order:async()=>({order_id:'o-1',status:'pending'}),cancelStrategy:async()=>({ok:true})};
 const rpc={balance:async()=>1000000000n,tokenBalance:async()=>0n,mint:async()=>({value:{owner:TOKEN_PROGRAM,data:{parsed:{type:'mint',info:{isInitialized:true,mintAuthority:null,freezeAuthority:null,decimals:6}}}}})};
 const engine=new LiveEngine({config,state,store,gmgn,rpc,executionAllowed:true});
 return {engine,gmgn,rpc,calls,state,store,cleanup:()=>rm(dir,{recursive:true,force:true})};
}
const filled=(input=SOL,output=T)=>({order_id:'o-1',status:'confirmed',hash:'1'.repeat(88),input_token:input,output_token:output,filled_input_amount:'10000000',filled_output_amount:'10000000',strategy_order_id:'strategy-1'});
test('new server starts paused; start requires explicit confirmation and matching limits digest',async()=>{
 const f=await fixture();try{assert.equal(f.engine.running,false);await assert.rejects(f.engine.arm('yes',f.engine.digest));await assert.rejects(f.engine.arm('START_REAL_TRADING','old-config'));await f.engine.arm('START_REAL_TRADING',f.engine.digest);assert.equal(f.engine.running,true);assert.equal(f.calls.length,0);}finally{await f.cleanup();}
});
test('deployment execution switch cannot be bypassed by the dashboard',async()=>{
 const f=await fixture();try{f.engine.executionAllowed=false;await assert.rejects(f.engine.arm('START_REAL_TRADING',f.engine.digest),/SETUP/);await f.engine.tick();assert.equal(f.calls.length,0);}finally{await f.cleanup();}
});
test('complete scan commits durable intent before exactly one swap',async()=>{
 const f=await fixture();try{await f.engine.arm('START_REAL_TRADING',f.engine.digest);const original=f.gmgn.swap;f.gmgn.swap=async body=>{const disk=await f.store.load();assert.equal(disk.pending.request.input_amount,'10000000');return original(body);};await f.engine.tick();assert.equal(f.calls.length,1);assert.equal(f.state.pending.orderId,'o-1');assert.equal(f.state.spent,'10000000');assert.equal(f.calls[0].auto_slippage,false);assert.equal(f.calls[0].condition_orders.length,2);}finally{await f.cleanup();}
});
test('unknown submission stays pending and is never automatically retried, including restart',async()=>{
 const f=await fixture();try{await f.engine.arm('START_REAL_TRADING',f.engine.digest);f.gmgn.swap=async body=>{f.calls.push(body);throw Error('timeout');};await f.engine.tick();await f.engine.tick();assert.equal(f.calls.length,1);assert.ok(f.state.pending);const state=await f.store.load();const restart=new LiveEngine({config,state,store:f.store,gmgn:f.gmgn,rpc:f.rpc,executionAllowed:true});await restart.tick();assert.equal(restart.running,false);assert.equal(f.calls.length,1);await assert.rejects(restart.arm('START_REAL_TRADING',restart.digest));}finally{await f.cleanup();}
});
test('disk write failure prevents the swap from being sent',async()=>{
 const f=await fixture();try{await f.engine.arm('START_REAL_TRADING',f.engine.digest);f.store.save=async()=>{throw Error('disk full');};await assert.rejects(f.engine.tick(),/PERSISTENCE/);assert.equal(f.calls.length,0);}finally{await f.cleanup();}
});
test('held tokens and unknown mint authority cannot be purchased',async()=>{
 const f=await fixture();try{await f.engine.arm('START_REAL_TRADING',f.engine.digest);f.rpc.tokenBalance=async()=>1n;await f.engine.tick();assert.equal(f.calls.length,0);f.rpc.tokenBalance=async()=>0n;f.rpc.mint=async()=>({value:null});await f.engine.tick();assert.equal(f.calls.length,0);assert.equal(f.engine.running,false);}finally{await f.cleanup();}
});
test('session purchase cap and daily order count remain hard limits',async()=>{
 const f=await fixture();try{f.state.spent='200000000';await assert.rejects(f.engine.arm('START_REAL_TRADING',f.engine.digest),/CAP/);f.state.spent='0';await f.engine.arm('START_REAL_TRADING',f.engine.digest);f.state.day=new Date().toISOString().slice(0,10);f.state.dailyOrders=5;await f.engine.tick();assert.equal(f.calls.length,0);assert.equal(f.engine.running,false);}finally{await f.cleanup();}
});
test('pause during scanning prevents a subsequent entry',async()=>{
 const f=await fixture();try{await f.engine.arm('START_REAL_TRADING',f.engine.digest);const original=f.gmgn.security;f.gmgn.security=async()=>{await f.engine.pause();return original();};await f.engine.tick();assert.equal(f.calls.length,0);}finally{await f.cleanup();}
});
test('confirmed buy without native TP/SL pauses entries and flags exit handling',async()=>{
 const f=await fixture();try{await f.engine.arm('START_REAL_TRADING',f.engine.digest);f.gmgn.swap=async()=>({...filled(),strategy_order_id:undefined});await f.engine.tick();assert.equal(f.state.position.forceExit,true);assert.equal(f.engine.running,false);assert.equal(f.state.haltReason,'NATIVE_PROTECTION_MISSING');}finally{await f.cleanup();}
});
test('stop loss sells only the amount bought by the bot',async()=>{
 const f=await fixture();try{await f.engine.arm('START_REAL_TRADING',f.engine.digest);f.gmgn.swap=async body=>{f.calls.push(body);return f.calls.length===1?filled():{order_id:'sell-1',status:'pending'};};await f.engine.tick();f.rpc.tokenBalance=async()=>20000000n;f.gmgn.quote=async(w,input,output,amount)=>quote(input,output,amount,'8000000');await f.engine.pause();await f.engine.tick();assert.equal(f.calls.length,2);assert.equal(f.calls[1].input_amount,'10000000');assert.equal(f.calls[1].input_token,T);assert.equal(f.calls[1].output_token,SOL);}finally{await f.cleanup();}
});
test('API market failure does not create synthetic fills or positions',async()=>{
 const f=await fixture();try{await f.engine.arm('START_REAL_TRADING',f.engine.digest);f.gmgn.info=async()=>{throw Error('GMGN_HTTP_503');};await f.engine.tick();assert.equal(f.calls.length,0);assert.equal(f.state.position,null);assert.equal(f.engine.running,false);}finally{await f.cleanup();}
});
test('corrupt state is rejected instead of silently starting a new trading session',async()=>{
 const f=await fixture();try{const {writeFile}=await import('node:fs/promises');await writeFile(f.store.filename,'{"schema":9}');await assert.rejects(f.store.load(),/RECONCILIATION/);}finally{await f.cleanup();}
});
test('global execution switch also blocks cancellation of GMGN native strategies',async()=>{
 const f=await fixture();try{let cancellations=0;f.gmgn.cancelStrategy=async()=>{cancellations++;};f.engine.executionAllowed=false;await f.engine.retireStrategy('old-strategy');assert.equal(cancellations,0);assert.equal(f.state.haltReason,'CHECK_REMAINING_GMGN_STRATEGY');}finally{await f.cleanup();}
});
test('known pending order is reconciled after restart without a second swap',async()=>{
 const f=await fixture();try{await f.engine.arm('START_REAL_TRADING',f.engine.digest);await f.engine.tick();assert.equal(f.calls.length,1);f.gmgn.order=async()=>filled();const state=await f.store.load();const restart=new LiveEngine({config,state,store:f.store,gmgn:f.gmgn,rpc:f.rpc,executionAllowed:true});await restart.tick();assert.equal(f.calls.length,1);assert.ok(state.position);assert.equal(state.pending,null);assert.equal(restart.running,false);}finally{await f.cleanup();}
});

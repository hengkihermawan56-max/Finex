import { createHash,randomUUID } from 'node:crypto';
import { SOL,address,raw,lamports,sol,activationProblems,screenToken,validateMint,checkedQuote,receipt } from './policy.mjs';

export class LiveEngine {
  constructor({config,state,store,gmgn,rpc,executionAllowed=false,now=Date.now}) {
    this.config=config;this.state=state;this.store=store;this.gmgn=gmgn;this.rpc=rpc;
    this.executionAllowed=executionAllowed;this.now=now;this.running=false;this.busy=false;
    this.lastRead=0;this.balance=null;this.valuation=null;this.radar=[];this.lastError=null;
    this.digest=createHash('sha256').update(JSON.stringify(config)).digest('hex');
  }
  event(type,message){this.state.events.unshift({t:this.now(),type,message});this.state.events=this.state.events.slice(0,500);}
  async save(){try{await this.store.save(this.state);}catch{this.running=false;this.lastError='PERSISTENCE_FAILURE';throw Error('PERSISTENCE_FAILURE');}}
  problems(){return [...activationProblems(this.config),...(!this.executionAllowed?['Server belum diizinkan mengirim transaksi nyata.']:[]),...(!this.gmgn.apiKey?['API key GMGN belum dikonfigurasi.']:[]),...(!this.gmgn.key?['Kunci penandatangan GMGN belum dikonfigurasi.']:[])];}
  status(){return {version:'1.1.0',mode:'REAL_GMGN',running:this.running,busy:this.busy,problems:this.problems(),config:this.config,configDigest:this.digest,
    lastRead:this.lastRead,balanceSol:this.balance===null?null:sol(this.balance),estimatedPositionSol:this.valuation===null?null:sol(this.valuation),
    spentSol:sol(this.state.spent),pending:this.state.pending?{id:this.state.pending.id,orderId:this.state.pending.orderId,side:this.state.pending.side,token:this.state.pending.token}:null,
    position:this.state.position,haltReason:this.state.haltReason,lastError:this.lastError,radar:this.radar,events:this.state.events.slice(0,40),
    orders:this.state.orders.slice(-30).reverse(),blockedUntil:this.gmgn.blockedUntil||0};}
  async arm(confirm,digest){
    if(confirm!=='START_REAL_TRADING'||digest!==this.digest)throw Error('CONFIRM_CURRENT_LIMITS_REQUIRED');
    if(this.busy)throw Error('ENGINE_BUSY');
    if(this.problems().length)throw Error('SETUP_INCOMPLETE');
    if(this.state.haltReason||this.state.pending)throw Error('RECONCILIATION_REQUIRED');
    if(this.state.wallet&&this.state.wallet!==this.config.wallet)throw Error('WALLET_CHANGED');
    this.busy=true;
    try{
      await this.gmgn.holdings(this.config.wallet); // signed read validates credentials, never submits an order
      this.balance=await this.rpc.balance(this.config.wallet);
      if(this.balance<lamports(this.config.orderSol)+lamports(this.config.reserveSol))throw Error('INSUFFICIENT_SOL_RESERVE');
      if(raw(this.state.spent)+lamports(this.config.orderSol)>lamports(this.config.budgetSol))throw Error('SESSION_PURCHASE_CAP_REACHED');
      this.state.wallet=this.config.wallet;
      if(this.state.baseline===null)this.state.baseline=this.balance.toString();
      this.running=true;this.lastError=null;this.event('start','Beli otomatis nyata diaktifkan sesuai batas sesi.');await this.save();
    }finally{this.busy=false;}
  }
  async pause(){this.running=false;this.event('pause','Beli baru dijeda. Pengawasan posisi yang sudah dibuka tetap berjalan.');await this.save();}
  async halt(reason){this.running=false;this.state.haltReason=reason;this.lastError=reason;this.event('halt',reason);await this.save();}
  async acknowledge(confirm){if(confirm!=='REVIEWED_GMGN'||this.busy||this.state.pending||this.state.position)throw Error('RECONCILIATION_REQUIRED');this.state.haltReason=null;this.lastError=null;this.event('review','Operator meninjau status GMGN. Batas sesi tidak diatur ulang.');await this.save();}
  async attachOrder(orderId){
    if(this.busy||!this.state.pending||this.state.pending.orderId)throw Error('NO_UNKNOWN_ORDER');
    if(typeof orderId!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(orderId))throw Error('INVALID_ORDER_ID');
    this.busy=true;
    try{const result=await this.gmgn.order(orderId);receipt(result,this.state.pending.request);this.state.pending.orderId=orderId;await this.save();await this.accept(result);}
    finally{this.busy=false;}
  }
  async retireStrategy(id){
    if(!this.executionAllowed){await this.halt('CHECK_REMAINING_GMGN_STRATEGY');return;}
    try{await this.gmgn.cancelStrategy(this.config.wallet,id);}catch{await this.halt('CHECK_REMAINING_GMGN_STRATEGY');}
  }
  async accept(result){
    const pending=this.state.pending;if(!pending)return;
    if(result?.order_id&&typeof result.order_id==='string'&&result.order_id.length<=200){pending.orderId=result.order_id;await this.save();}
    const settled=receipt(result,pending.request);
    if(settled.state==='pending'){
      if(!pending.orderId)await this.halt('SUBMISSION_OUTCOME_UNKNOWN');
      return;
    }
    if(settled.state==='failed'){
      this.state.orders.push({id:pending.id,t:this.now(),side:pending.side,token:pending.token,status:'failed',orderId:pending.orderId});
      this.state.pending=null;await this.halt('ORDER_FAILED_REVIEW_REQUIRED');return;
    }
    const record={id:pending.id,t:this.now(),side:pending.side,token:pending.token,status:'confirmed',orderId:pending.orderId,...settled};
    this.state.orders.push(record);this.state.pending=null;
    if(pending.side==='buy'){
      this.state.position={token:pending.token,amount:settled.received,entryLamports:settled.spent,openedAt:this.now(),strategyId:settled.strategyId,forceExit:!settled.strategyId};
      this.event('buy','Pembelian dikonfirmasi di blockchain.');
      if(!settled.strategyId){this.running=false;this.state.haltReason='NATIVE_PROTECTION_MISSING';this.event('halt','GMGN tidak mengembalikan ID TP/SL. Beli dijeda; server berupaya menutup posisi dengan quote segar.');}
    }else{
      const strategy=this.state.position?.strategyId;
      this.state.cooldowns[pending.token]=this.now()+3600000;
      this.state.position=null;this.valuation=null;this.event('sell','Penjualan dikonfirmasi di blockchain.');
      await this.save();
      if(strategy)await this.retireStrategy(strategy);
    }
    await this.save();
  }
  async submit(side,token,amount,quote){
    if(!this.executionAllowed||this.problems().length)throw Error('REAL_EXECUTION_DISABLED');
    if(this.state.pending)throw Error('ORDER_PENDING');
    if(side==='buy'&&(!this.running||this.state.haltReason||this.state.position))return;
    const c=this.config, input=side==='buy'?SOL:token,output=side==='buy'?token:SOL;
    checkedQuote(quote,input,output,amount,c.slippagePct);
    const request={chain:'sol',from_address:c.wallet,input_token:input,output_token:output,input_amount:String(amount),swap_mode:'ExactIn',
      slippage:c.slippagePct,auto_slippage:false,min_output_amount:quote.min_output_amount,is_anti_mev:true,priority_fee:c.priorityFeeSol,tip_fee:c.tipFeeSol};
    if(side==='buy'){
      if(raw(this.state.spent)+BigInt(amount)>lamports(c.budgetSol))throw Error('SESSION_PURCHASE_CAP_REACHED');
      const day=new Date(this.now()).toISOString().slice(0,10);
      if(this.state.day!==day){this.state.day=day;this.state.dailyOrders=0;}
      if(this.state.dailyOrders>=c.maxDailyOrders)throw Error('DAILY_ORDER_CAP_REACHED');
      request.condition_orders=[{order_type:'profit_stop',side:'sell',price_scale:String(c.takeProfitPct),sell_ratio:'100'},
        {order_type:'loss_stop',side:'sell',price_scale:String(c.stopLossPct),sell_ratio:'100'}];
      request.sell_ratio_type='buy_amount';
      this.state.spent=(raw(this.state.spent)+BigInt(amount)).toString();this.state.dailyOrders++;
    }
    this.state.pending={id:randomUUID(),createdAt:this.now(),side,token,orderId:null,request};
    this.event('intent',`${side==='buy'?'Beli':'Jual'} dicatat sebelum pengiriman. Tidak ada kirim ulang otomatis.`);
    await this.save(); // durable write BEFORE the irreversible API request
    try{await this.accept(await this.gmgn.swap(request));}
    catch(error){await this.halt(error.message==='PERSISTENCE_FAILURE'?'PERSISTENCE_FAILURE':'SUBMISSION_OUTCOME_UNKNOWN');}
  }
  async managePosition(){
    const p=this.state.position;if(!p)return;
    const actual=await this.rpc.tokenBalance(this.config.wallet,p.token);
    const owned=raw(p.amount);
    if(actual<owned){
      this.running=false;
      if(actual===0n){
        this.state.orders.push({id:randomUUID(),t:this.now(),side:'external-exit',token:p.token,status:'needs-reconciliation',strategyId:p.strategyId});
        this.state.position=null;this.valuation=null;
        this.state.cooldowns[p.token]=this.now()+3600000;await this.save();
        if(p.strategyId)await this.retireStrategy(p.strategyId);
      }
      await this.halt('TOKEN_BALANCE_CHANGED_REVIEW_GMGN');return;
    }
    const q=checkedQuote(await this.gmgn.quote(this.config.wallet,p.token,SOL,owned,this.config.slippagePct),p.token,SOL,owned,this.config.slippagePct);
    this.valuation=raw(q.min_output_amount);this.lastRead=this.now();
    const cost=raw(p.entryLamports),gainBps=(this.valuation-cost)*10000n/cost;
    const loss=this.state.baseline===null?0n:raw(this.state.baseline)-(this.balance+this.valuation);
    if(loss>=lamports(this.config.maxLossSol)){p.forceExit=true;await this.halt('SESSION_LOSS_LIMIT');}
    if(!this.executionAllowed)return;
    if(p.forceExit||gainBps<=-BigInt(Math.round(this.config.stopLossPct*100))||gainBps>=BigInt(Math.round(this.config.takeProfitPct*100)))
      await this.submit('sell',p.token,owned,q);
  }
  async scan(){
    const c=this.config;
    const data=c.watchlist.length?{rank:c.watchlist.map(a=>({address:a,chain:'sol'}))}:await this.gmgn.trending();
    if(!Array.isArray(data?.rank))throw Error('INVALID_TRENDING_SCHEMA');
    const candidates=[...new Set(data.rank.filter(x=>x.chain==='sol'&&address(x.address)&&x.address!==SOL).map(x=>x.address))].slice(0,5);
    this.radar=[];
    for(const token of candidates){
      if(!this.running||this.state.pending||this.state.position)return;
      if((this.state.cooldowns[token]||0)>this.now())continue;
      const info=await this.gmgn.info(token),security=await this.gmgn.security(token);
      const screen=screenToken(info,security,c,this.now());this.radar.push({token,...screen});
      if(!screen.passed)continue;
      validateMint(await this.rpc.mint(token));
      // Never acquire a token the wallet already held before this bot's buy.
      if(await this.rpc.tokenBalance(c.wallet,token)!==0n)continue;
      const amount=lamports(c.orderSol);
      const buy=checkedQuote(await this.gmgn.quote(c.wallet,SOL,token,amount,c.slippagePct),SOL,token,amount,c.slippagePct);
      const back=checkedQuote(await this.gmgn.quote(c.wallet,token,SOL,raw(buy.min_output_amount),c.slippagePct),token,SOL,raw(buy.min_output_amount),c.slippagePct);
      if((amount-raw(back.min_output_amount))*10000n>amount*BigInt(Math.round(c.maxRoundTripLossPct*100)))continue;
      if(!this.running)return;
      this.balance=await this.rpc.balance(c.wallet);
      const feeBuffer=2n*(lamports(c.priorityFeeSol)+lamports(c.tipFeeSol))+lamports('0.003');
      if(this.balance<amount+lamports(c.reserveSol)+feeBuffer)throw Error('INSUFFICIENT_SOL_RESERVE');
      // Re-quote immediately before committing the intent. No old market price can submit a buy.
      const finalQuote=checkedQuote(await this.gmgn.quote(c.wallet,SOL,token,amount,c.slippagePct),SOL,token,amount,c.slippagePct);
      if(raw(finalQuote.min_output_amount)<raw(buy.min_output_amount))continue;
      if(!this.running)return;
      await this.submit('buy',token,amount,finalQuote);return;
    }
  }
  async tick(){
    if(this.busy||!address(this.config.wallet)||!this.gmgn.apiKey||!this.gmgn.key)return;
    this.busy=true;
    try{
      if(this.state.wallet&&this.state.wallet!==this.config.wallet)throw Error('WALLET_CHANGED');
      if(this.state.pending){if(this.state.pending.orderId)await this.accept(await this.gmgn.order(this.state.pending.orderId));else await this.halt('SUBMISSION_OUTCOME_UNKNOWN');return;}
      this.balance=await this.rpc.balance(this.config.wallet);this.lastRead=this.now();
      if(this.state.position){await this.managePosition();return;}
      if(this.state.baseline!==null&&raw(this.state.baseline)-this.balance>=lamports(this.config.maxLossSol)&&lamports(this.config.maxLossSol)>0n){await this.halt('SESSION_LOSS_LIMIT');return;}
      if(this.running){if(this.problems().length)throw Error('SETUP_INCOMPLETE');await this.scan();}
    }catch(error){this.lastError=/^[A-Z0-9_]{1,100}$/.test(error.message)?error.message:'ENGINE_READ_ERROR';this.running=false;this.event('error',this.lastError);await this.save();}
    finally{this.busy=false;}
  }
}

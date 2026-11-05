import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SOL,TOKEN_PROGRAM,address,lamports,sol,raw,validateConfig,activationProblems,screenToken,validateMint,checkedQuote,receipt} from '../src/policy.mjs';
const config=JSON.parse(await readFile(new URL('../config.example.json',import.meta.url)));
const TOKEN='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
test('SOL conversion is exact and rejects floating/exponential/negative input',()=>{
 assert.equal(lamports('0.000000001'),1n);assert.equal(lamports('1.25'),1250000000n);assert.equal(sol(-1n),'-0.000000001');
 for(const v of [0.1,'1e-2','-1','0.0000000001',' 1','NaN'])assert.throws(()=>lamports(v));assert.throws(()=>raw('1.5'));
});
test('address validation checks decoded 32 bytes, not just a base58 regex',()=>{
 assert.equal(address(SOL),true);assert.equal(address(TOKEN),true);assert.equal(address('z'.repeat(32)),false);assert.equal(address('<script>'),false);
});
test('zero configuration remains unable to activate real transactions',()=>{
 const c=validateConfig(config);assert.ok(activationProblems(c).length>=4);
 assert.throws(()=>validateConfig({...config,orderSol:'0.1'}));assert.throws(()=>validateConfig({...config,slippagePct:30}));
});
const info={price:{price:'1.05',price_5m:'1',volume_1h:'100000',buy_volume_5m:'6000',sell_volume_5m:'3000'},pool:{liquidity:'200000'},creation_timestamp:1700000000};
const security={renounced_mint:true,renounced_freeze_account:true,top_10_holder_rate:0.1,rug_ratio:0.1,is_wash_trading:false};
test('token selection fails closed for missing security data and unknown age',()=>{
 assert.equal(screenToken(info,security,config).passed,true);
 for(const field of Object.keys(security)){const s={...security};delete s[field];assert.equal(screenToken(info,s,config).passed,false,field);}
 assert.equal(screenToken({...info,creation_timestamp:0},security,config).passed,false);
 assert.equal(screenToken(info,{...security,is_honeypot:'yes'},config).passed,false);
});
test('mint checks reject Token-2022 and active mint/freeze authorities',()=>{
 const a={value:{owner:TOKEN_PROGRAM,data:{parsed:{type:'mint',info:{isInitialized:true,mintAuthority:null,freezeAuthority:null,decimals:6}}}}};
 assert.equal(validateMint(a),6);assert.throws(()=>validateMint({...a,value:{...a.value,owner:'other'}}));
 a.value.data.parsed.info.freezeAuthority=SOL;assert.throws(()=>validateMint(a));
});
test('quote identity, exact input amount and slippage must match',()=>{
 const q={input_token:SOL,output_token:TOKEN,input_amount:'1000000',output_amount:'10000',min_output_amount:'9800',slippage:2};
 assert.equal(checkedQuote(q,SOL,TOKEN,1000000n,2),q);
 for(const patch of [{input_token:TOKEN},{input_amount:'1000001'},{min_output_amount:'0'},{min_output_amount:'11000'},{slippage:3}])assert.throws(()=>checkedQuote({...q,...patch},SOL,TOKEN,1000000n,2));
});
test('receipt never labels pending as filled; validates finalized amounts and hash',()=>{
 const intent={input_token:SOL,output_token:TOKEN,input_amount:'1000'};
 assert.equal(receipt({status:'pending'},intent).state,'pending');assert.equal(receipt({status:'failed'},intent).state,'failed');
 const result={status:'confirmed',hash:'1'.repeat(88),filled_input_amount:'1000',filled_output_amount:'900',input_token:SOL,output_token:TOKEN};
 assert.equal(receipt(result,intent).state,'confirmed');assert.throws(()=>receipt({...result,filled_input_amount:'1001'},intent));
 assert.throws(()=>receipt({...result,input_token:TOKEN},intent));
  assert.throws(()=>receipt(result,{...intent,min_output_amount:'901'}));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePair, loadLiveQuotes, createDemoFeed } from '../web/market.js';
const A='So11111111111111111111111111111111111111112';
const P='JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN';
const P2='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const raw = (patch={}) => ({chainId:'solana',baseToken:{address:A,symbol:'SOL'},pairAddress:P,
  priceUsd:'150.2',liquidity:{usd:200_000},volume:{h1:50_000},txns:{m5:{buys:100,sells:60}},
  priceChange:{m5:3},fdv:1e8,pairCreatedAt:1_700_000_000_000,...patch});
const response = data => ({ok:true,status:200,json:async()=>data});
test('normalization preserves missing values; other chains or invalid addresses rejected',()=>{
  const q=normalizePair(raw({volume:undefined}),1234); assert.equal(q.volumeH1,null);
  assert.equal(q.observedAt,1234); assert.equal(q.source,'live'); assert.equal(q.priceUsd,150.2);
  assert.equal(normalizePair(raw({chainId:'ethereum'})),null);
  assert.equal(normalizePair(raw({priceUsd:'NaN'})),null);
  assert.equal(normalizePair(raw({pairAddress:'<script>'})),null);
});
test('live adapter picks liquid pool and also retains exact held pool',async()=>{
  const calls=[];
  const fetchFn=async url=>{ calls.push(url); return url.includes('profiles') ? response([{chainId:'solana',tokenAddress:A}])
    : response([raw(),raw({pairAddress:P2,liquidity:{usd:900_000}})]); };
  const result=await loadLiveQuotes([{key:P,tokenAddress:A}],[],fetchFn);
  assert.equal(calls.length,2); assert.equal(result.quotes.length,2);
  assert.equal(result.quotes[0].key,P2); assert.ok(result.quotes.some(q=>q.key===P));
});
test('API failure never silently becomes synthetic demo data',async()=>{
  await assert.rejects(loadLiveQuotes([],[],async()=>{throw new Error('offline');}));
  await assert.rejects(loadLiveQuotes([], [A], async url=>url.includes('profiles') ? response([]) : ({ok:false,status:429})),/429/);
});
test('watchlist allows held prices to update if discovery profiles fail',async()=>{
  const result=await loadLiveQuotes([],[A],async url=>{
    if(url.includes('profiles'))throw new Error('offline'); return response([raw()]);
  });
  assert.equal(result.quotes[0].source,'live'); assert.ok(result.warning);
});
test('demo randomness can rise or fall and is labeled fictitious',()=>{
  const f=createDemoFeed(7); const all=[...f.next(),...f.next()];
  assert.ok(all.some(q=>q.changeM5<0)); assert.ok(all.some(q=>q.changeM5>0));
  assert.ok(all.every(q=>q.source==='demo'&&q.symbol.endsWith('-D')));
});
test('restored demo price follows last marked price instead of initial seed price',()=>{
  const f=createDemoFeed(7);f.resume([{symbol:'KOMET-D',markUsd:1}]);
  assert.ok(f.next()[0].priceUsd>0.9);
});

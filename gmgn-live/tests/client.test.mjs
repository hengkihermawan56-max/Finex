import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {GmgnClient,signatureMessage,GMGN_HOST} from '../src/client.mjs';
test('signed calls use canonical query, Ed25519 and an immutable official host',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');let request;
 const c=new GmgnClient({apiKey:'synthetic-test-key',privateKeyPem:privateKey.export({type:'pkcs8',format:'pem'}),spacingMs:0,transport:async(url,options)=>{request={url,options};return {status:200,headers:{},json:{code:0,data:{ok:true}}};}});
 await c.order('test-order');const u=new URL(request.url);assert.equal(u.origin,GMGN_HOST);
 const params=Object.fromEntries(u.searchParams),sig=request.options.headers['X-Signature'];
 assert.ok(verify(null,Buffer.from(signatureMessage(u.pathname,params,'',Number(params.timestamp))),publicKey,Buffer.from(sig,'base64')));
 assert.equal(request.options.headers['X-APIKEY'],'synthetic-test-key');
});
test('a write timeout is marked unknown and is not retried',async()=>{
 const {privateKey}=generateKeyPairSync('ed25519');let calls=0;
 const c=new GmgnClient({apiKey:'test',privateKeyPem:privateKey.export({type:'pkcs8',format:'pem'}),spacingMs:0,transport:async()=>{calls++;throw Error('network failure');}});
 await assert.rejects(c.swap({}),e=>e.uncertain===true);assert.equal(calls,1);
});
test('429 blocks all subsequent requests until reset instead of extending a ban',async()=>{
 let calls=0;const now=1700000000000;
 const c=new GmgnClient({apiKey:'test',spacingMs:0,now:()=>now,transport:async()=>{calls++;return {status:429,headers:{'x-ratelimit-reset':'1700000300'},json:{code:429,error:'RATE_LIMIT_BANNED'}};}});
 await assert.rejects(c.info('x'));await assert.rejects(c.info('x'),/COOLDOWN/);assert.equal(calls,1);
});

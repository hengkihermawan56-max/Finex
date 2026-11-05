import { request } from 'node:https';
import { createPrivateKey, randomUUID, sign } from 'node:crypto';
export const GMGN_HOST='https://openapi.gmgn.ai';
export function signatureMessage(path,query,body,timestamp) {
  const sorted=Object.keys(query).sort().map(k=>`${encodeURIComponent(k)}=${encodeURIComponent(String(query[k]))}`).join('&');
  return `${path}:${sorted}:${body}:${timestamp}`;
}
export function httpsJson(url,{method='GET',headers={},body=null,timeout=15000}={}) {
  return new Promise((resolve,reject)=>{
    const parsed=new URL(url);
    if(parsed.protocol!=='https:'||parsed.username||parsed.password) return reject(Error('HTTPS_REQUIRED'));
    const req=request(parsed,{method,headers,family:4,timeout},res=>{
      let bytes=0,parts=[];
      res.on('data',chunk=>{bytes+=chunk.length;if(bytes>2_000_000){req.destroy(Error('RESPONSE_TOO_LARGE'));return;}parts.push(chunk);});
      res.on('end',()=>{try{resolve({status:res.statusCode,headers:res.headers,json:JSON.parse(Buffer.concat(parts).toString())});}catch{reject(Error('NON_JSON_RESPONSE'));}});
      res.on('error',()=>reject(Error('NETWORK_RESPONSE_ERROR')));
    });
    req.on('timeout',()=>req.destroy(Error('NETWORK_TIMEOUT')));
    req.on('error',()=>reject(Error('NETWORK_ERROR')));
    if(body!==null)req.write(body);req.end();
  });
}
export class GmgnClient {
  constructor({apiKey,privateKeyPem,transport=httpsJson,spacingMs=1100,now=Date.now}) {
    this.apiKey=apiKey;this.key=privateKeyPem?createPrivateKey(privateKeyPem):null;
    if(this.key&&this.key.asymmetricKeyType!=='ed25519')throw Error('ED25519_REQUIRED');
    this.transport=transport;this.spacingMs=spacingMs;this.now=now;this.next=0;this.blockedUntil=0;this.queue=Promise.resolve();
  }
  call(path,{method='GET',query={},body=null,signed=false}={}) {
    const job=()=>this.perform(path,{method,query,body,signed});
    const result=this.queue.then(job);this.queue=result.catch(()=>{});return result;
  }
  async perform(path,{method,query,body,signed}) {
    if(!this.apiKey)throw Error('GMGN_API_KEY_MISSING');
    if(this.now()<this.blockedUntil)throw Error('GMGN_RATE_LIMIT_COOLDOWN');
    if(this.next>this.now())await new Promise(r=>setTimeout(r,this.next-this.now()));
    const timestamp=Math.floor(this.now()/1000),params={...query,timestamp,client_id:randomUUID()};
    const text=body===null?'':JSON.stringify(body);
    const headers={'X-APIKEY':this.apiKey,'Content-Type':'application/json','User-Agent':'hengki-gmgn-desk/1.1.0'};
    if(signed){if(!this.key)throw Error('GMGN_SIGNING_KEY_MISSING');headers['X-Signature']=sign(null,Buffer.from(signatureMessage(path,params,text,timestamp)),this.key).toString('base64');}
    this.next=this.now()+this.spacingMs;
    let response;
    try{response=await this.transport(`${GMGN_HOST}${path}?${new URLSearchParams(params)}`,{method,headers,body:text||null});}
    catch{const error=Error(method==='POST'?'SUBMISSION_OUTCOME_UNKNOWN':'GMGN_NETWORK_ERROR');error.uncertain=method==='POST';throw error;}
    const j=response.json;
    if(response.status!==200||j?.code!==0){
      if(response.status===429){const reset=Number(response.headers['x-ratelimit-reset']||j?.reset_at);this.blockedUntil=Number.isFinite(reset)&&reset*1000>this.now()?reset*1000+1500:this.now()+300000;}
      const safe=typeof j?.error==='string'&&/^[A-Z0-9_]{1,80}$/.test(j.error)?j.error:`HTTP_${response.status}`;
      const error=Error(`GMGN_${safe}`);error.code=safe;error.resetAt=this.blockedUntil;
      // Any write failure is retained for reconciliation. We never blindly retry.
      error.uncertain=method==='POST';throw error;
    }
    return j.data;
  }
  info(address){return this.call('/v1/token/info',{query:{chain:'sol',address}});}
  security(address){return this.call('/v1/token/security',{query:{chain:'sol',address}});}
  trending(){return this.call('/v1/market/rank',{query:{chain:'sol',interval:'5m',limit:5}});}
  holdings(wallet){return this.call('/v1/user/wallet_holdings',{query:{chain:'sol',wallet_address:wallet,limit:1},signed:true});}
  quote(wallet,input,output,amount,slippage){return this.call('/v1/trade/quote',{query:{chain:'sol',from_address:wallet,input_token:input,output_token:output,input_amount:String(amount),slippage}});}
  swap(body){return this.call('/v1/trade/swap',{method:'POST',body,signed:true});}
  order(id){return this.call('/v1/trade/query_order',{query:{chain:'sol',order_id:id},signed:true});}
  cancelStrategy(wallet,id){return this.call('/v1/trade/strategy/cancel',{method:'POST',signed:true,body:{chain:'sol',from_address:wallet,order_id:id,order_type:'smart_trade'}});}
}
export class SolanaReader {
  constructor(url='https://api.mainnet-beta.solana.com',transport=httpsJson){this.url=url;this.transport=transport;}
  async rpc(method,params){const r=await this.transport(this.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:randomUUID(),method,params})});if(r.status!==200||r.json?.error||r.json?.result===undefined)throw Error('SOLANA_RPC_ERROR');return r.json.result;}
  async balance(wallet){const r=await this.rpc('getBalance',[wallet,{commitment:'confirmed'}]);if(!Number.isSafeInteger(r.value)||r.value<0)throw Error('INVALID_SOL_BALANCE');return BigInt(r.value);}
  mint(token){return this.rpc('getAccountInfo',[token,{encoding:'jsonParsed',commitment:'confirmed'}]);}
  async tokenBalance(wallet,token){const r=await this.rpc('getTokenAccountsByOwner',[wallet,{mint:token},{encoding:'jsonParsed',commitment:'confirmed'}]);if(!Array.isArray(r.value))throw Error('INVALID_TOKEN_BALANCE');let total=0n;for(const row of r.value){const i=row.account?.data?.parsed?.info;if(i?.mint!==token||i?.owner!==wallet||!/^\d+$/.test(i?.tokenAmount?.amount||''))throw Error('INVALID_TOKEN_ACCOUNT');total+=BigInt(i.tokenAmount.amount);}return total;}
}

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes,timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GmgnClient,SolanaReader } from './client.mjs';
import { validateConfig } from './policy.mjs';
import { Store } from './store.mjs';
import { LiveEngine } from './engine.mjs';

const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function makeServer({engine,adminSecret,origin,secure=true,now=Date.now}) {
  if(typeof adminSecret!=='string'||adminSecret.length<32)throw Error('ADMIN_SECRET_TOO_SHORT');
  const sessions=new Map(), attempts=new Map();
  const files={'/':'index.html','/dashboard.js':'dashboard.js','/style.css':'style.css'};
  const headers={'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store'};
  return createServer(async(req,res)=>{
    const send=(status,value,extra={})=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8',...extra});res.end(JSON.stringify(value));};
    try{
      const url=new URL(req.url,'http://internal');
      if(req.method==='GET'&&url.pathname==='/health'){send(200,{ok:true});return;}
      if(req.method==='GET'&&files[url.pathname]){
        const file=files[url.pathname],data=await readFile(new URL('../public/'+file,import.meta.url));
        res.writeHead(200,{...headers,'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});res.end(data);return;
      }
      let body={};
      if(req.method==='POST'){
        if(req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json')){send(403,{error:'ORIGIN_REJECTED'});return;}
        let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>4096){send(413,{error:'BODY_TOO_LARGE'});return;}}
        try{body=JSON.parse(text);}catch{send(400,{error:'INVALID_JSON'});return;}
      }
      if(req.method==='POST'&&url.pathname==='/api/login'){
        const ip=req.socket.remoteAddress||'unknown',record=attempts.get(ip)||{n:0,until:now()+600000};
        for(const [key,r] of attempts)if(r.until<now())attempts.delete(key);
        if(!attempts.has(ip)&&attempts.size>=1000){send(429,{error:'LOGIN_COOLDOWN'});return;}
        if(record.until<now()){record.n=0;record.until=now()+600000;}
        if(record.n>=5){send(429,{error:'LOGIN_COOLDOWN'});return;}
        record.n++;attempts.set(ip,record);
        if(!equal(body.secret,adminSecret)){send(401,{error:'LOGIN_REJECTED'});return;}
        const id=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
        for(const [key,s] of sessions)if(s.until<now())sessions.delete(key);
        if(sessions.size>=20)sessions.delete(sessions.keys().next().value);
        sessions.set(id,{csrf,until:now()+3600000});attempts.delete(ip);
        send(200,{csrf},{'Set-Cookie':`hsd_session=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600${secure?'; Secure':''}`});return;
      }
      const cookie=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('hsd_session='))?.slice(12);
      const session=sessions.get(cookie);
      if(!session||session.until<now()){send(401,{error:'LOGIN_REQUIRED'});return;}
      if(req.method==='GET'&&url.pathname==='/api/status'){send(200,{...engine.status(),csrf:session.csrf});return;}
      if(req.method!=='POST'||!equal(req.headers['x-csrf-token'],session.csrf)){send(403,{error:'CSRF_REJECTED'});return;}
      if(url.pathname==='/api/start')await engine.arm(body.confirm,body.configDigest);
      else if(url.pathname==='/api/pause')await engine.pause();
      else if(url.pathname==='/api/reconcile')await engine.attachOrder(body.orderId);
      else if(url.pathname==='/api/acknowledge')await engine.acknowledge(body.confirm);
      else if(url.pathname==='/api/logout'){sessions.delete(cookie);send(200,{ok:true},{'Set-Cookie':'hsd_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+(secure?'; Secure':'')});return;}
      else{send(404,{error:'NOT_FOUND'});return;}
      send(200,{ok:true,status:engine.status()});
    }catch(error){send(400,{error:/^[A-Z0-9_]{1,100}$/.test(error.message)?error.message:'REQUEST_FAILED'});}
  });
}
async function secret(name,required=false){const filename=process.env[name+'_FILE'];const value=filename?(await readFile(filename,'utf8')).trim():'';if(required&&!value)throw Error(`${name}_FILE_REQUIRED`);return value;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  try{
    const origin=process.env.APP_ORIGIN;
    if(!origin||new URL(origin).origin!==origin||!origin.startsWith('https://'))throw Error('PUBLIC_HTTPS_ORIGIN_REQUIRED');
    const config=validateConfig(JSON.parse(await readFile(process.env.CONFIG_PATH||'/config/config.json','utf8')));
    const store=new Store(process.env.STATE_PATH||'/data/state.json'),state=await store.load();
    const gmgn=new GmgnClient({apiKey:await secret('GMGN_API_KEY'),privateKeyPem:await secret('GMGN_PRIVATE_KEY')});
    const engine=new LiveEngine({config,state,store,gmgn,rpc:new SolanaReader(process.env.SOLANA_RPC_URL),executionAllowed:process.env.ALLOW_REAL_TRADING==='I_ACCEPT_REAL_TRADING'});
    const server=makeServer({engine,adminSecret:await secret('ADMIN_TOKEN',true),origin});
    const timer=setInterval(()=>engine.tick().catch(()=>{engine.running=false;}),config.pollSeconds*1000);
    server.listen(8787,'0.0.0.0',()=>console.log('HENGKI GMGN server ready. New entries remain paused until an operator starts them.'));
    const stop=()=>{clearInterval(timer);engine.running=false;server.close();};process.on('SIGTERM',stop);process.on('SIGINT',stop);
  }catch(error){console.error(/^[A-Z0-9_]{1,100}$/.test(error.message)?error.message:'SERVER_SETUP_FAILED');process.exitCode=1;}
}

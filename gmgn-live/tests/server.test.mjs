import test from 'node:test';
import assert from 'node:assert/strict';
import {makeServer} from '../src/server.mjs';
test('admin endpoints require login, exact Origin and CSRF; secrets never appear in status',async()=>{
 let starts=0;const secret='synthetic-admin-token-'.repeat(3),origin='https://bot.example.test';
 const engine={status:()=>({running:false,problems:[]}),arm:async()=>{starts++;},pause:async()=>{},attachOrder:async()=>{},acknowledge:async()=>{}};
 const server=makeServer({engine,adminSecret:secret,origin,secure:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(url+'/api/status')).status,401);
  assert.equal((await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://attacker.invalid'},body:JSON.stringify({secret})})).status,403);
  const login=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({secret})});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0],body=await login.json();
  const status=await fetch(url+'/api/status',{headers:{Cookie:cookie}});assert.equal(status.status,200);assert.ok(!(await status.text()).includes(secret));
  const options={method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:'{}'};
  assert.equal((await fetch(url+'/api/start',options)).status,403);assert.equal(starts,0);
  assert.equal((await fetch(url+'/api/start',{...options,headers:{...options.headers,'X-CSRF-Token':body.csrf}})).status,200);assert.equal(starts,1);
 }finally{await new Promise(r=>server.close(r));}
});

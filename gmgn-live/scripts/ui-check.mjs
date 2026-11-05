import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {makeServer} from '../src/server.mjs';
const secret='synthetic-test-admin-token-not-for-production';
let running=false;
const snapshot={version:'1.1.0',mode:'REAL_GMGN',busy:false,problems:[],configDigest:'fixture-config',
 config:{wallet:'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',budgetSol:'0.2',orderSol:'0.01',maxLossSol:'0.02',slippagePct:2,stopLossPct:6,takeProfitPct:12,maxDailyOrders:5,reserveSol:'0.03'},
 balanceSol:'0.125000000',estimatedPositionSol:null,spentSol:'0.000000000',pending:null,position:null,haltReason:null,lastError:null,radar:[],events:[],orders:[],lastRead:Date.now()};
const fake={status:()=>({...snapshot,running}),arm:async(confirm,digest)=>{if(confirm!=='START_REAL_TRADING'||digest!=='fixture-config')throw Error('CONFIRM_CURRENT_LIMITS_REQUIRED');running=true;},pause:async()=>{running=false;},acknowledge:async()=>{},attachOrder:async()=>{}};
const server=makeServer({engine:fake,adminSecret:secret,origin:'http://127.0.0.1:4191',secure:false});
await new Promise(r=>server.listen(4191,'127.0.0.1',r));
let browser;
try{
 await mkdir('test-results',{recursive:true});browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4191');await page.locator('#admin-secret').fill(secret);await page.locator('#login-form button').click();await page.locator('#desk').waitFor({state:'visible'});
 assert.match(await page.locator('#balance').textContent(),/0.125/);assert.equal(await page.locator('#admin-secret').inputValue(),'');
 await page.locator('#start').click();await page.locator('#confirmation').fill('wrong');await page.locator('#confirm-start').click();assert.equal(running,false);
 await page.locator('#confirmation').fill('START_REAL_TRADING');await page.locator('#confirm-start').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('aktif'));assert.equal(running,true);
 await page.locator('#pause').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('dijeda'));assert.equal(running,false);
 await page.screenshot({path:'test-results/gmgn-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});
 const width=await page.evaluate(()=>({a:document.documentElement.clientWidth,b:document.documentElement.scrollWidth}));assert.equal(width.a,width.b);await page.screenshot({path:'test-results/gmgn-mobile.png',fullPage:true});
 await page.locator('#logout').click();await page.locator('#login').waitFor({state:'visible'});assert.deepEqual(errors,[]);
 await writeFile('test-results/gmgn-ui-result.json',JSON.stringify({ok:true,scenarios:['login','no secret retained in form','explicit real-money confirmation','start with fixture backend','pause','mobile width','logout'],market:'fixture only',pageErrors:errors},null,2));
 console.log('7 server browser scenarios passed. No GMGN API or live wallet was accessed.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}

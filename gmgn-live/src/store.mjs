import { open,readFile,rename,mkdir } from 'node:fs/promises';
import path from 'node:path';
export class Store {
  constructor(filename){this.filename=filename;this.queue=Promise.resolve();}
  async load(){try{const state=JSON.parse(await readFile(this.filename,'utf8'));if(state.schema!==1||!Array.isArray(state.orders)||!Array.isArray(state.events)||!/^\d+$/.test(state.spent||''))throw Error('INVALID_STATE');return state;}catch(e){if(e.code!=='ENOENT')throw Error('STATE_REQUIRES_RECONCILIATION');return {schema:1,spent:'0',baseline:null,position:null,pending:null,orders:[],events:[],cooldowns:{},day:'',dailyOrders:0,haltReason:null};}}
  async save(state){const json=JSON.stringify(state);const job=async()=>{await mkdir(path.dirname(this.filename),{recursive:true,mode:0o700});const temp=this.filename+'.tmp';const file=await open(temp,'w',0o600);try{await file.writeFile(json);await file.sync();}finally{await file.close();}await rename(temp,this.filename);const dir=await open(path.dirname(this.filename),'r');try{await dir.sync();}finally{await dir.close();}};const p=this.queue.then(job);this.queue=p.catch(()=>{});return p;}
}

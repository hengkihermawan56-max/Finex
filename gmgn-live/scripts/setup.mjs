import { mkdir,writeFile,copyFile,access } from 'node:fs/promises';
import { generateKeyPairSync,randomBytes } from 'node:crypto';
import path from 'node:path';
const base=path.resolve(process.argv[2]||'.');
await mkdir(path.join(base,'secrets'),{recursive:true,mode:0o700});
await mkdir(path.join(base,'data'),{recursive:true,mode:0o700});
const pair=generateKeyPairSync('ed25519',{publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
// Exclusive writes: never replace an existing API signing key or admin token.
try{
  await writeFile(path.join(base,'secrets/gmgn-private.pem'),pair.privateKey,{mode:0o600,flag:'wx'});
  await writeFile(path.join(base,'secrets/gmgn-public.pem'),pair.publicKey,{mode:0o644,flag:'wx'});
  await writeFile(path.join(base,'secrets/admin-token.txt'),randomBytes(32).toString('hex')+'\n',{mode:0o600,flag:'wx'});
  await writeFile(path.join(base,'secrets/gmgn-api-key.txt'),'',{mode:0o600,flag:'wx'});
}catch(e){if(e.code==='EEXIST')throw Error('SETUP_ALREADY_EXISTS_DO_NOT_OVERWRITE');throw e;}
for(const [source,destination] of [['config.example.json','config.json'],['.env.example','.env']]){
  try{await access(path.join(base,destination));}catch{await copyFile(new URL('../'+source,import.meta.url),path.join(base,destination));}
}
console.log('Setup files created. Upload secrets/gmgn-public.pem to GMGN. Keep private PEM and admin token only on this server. No secret values were printed.');

import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for(const dir of ['src','scripts','public'])for(const name of await readdir(dir))if(/\.(mjs|js)$/.test(name)){
  const r=spawnSync(process.execPath,['--check',`${dir}/${name}`],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
}
console.log('GMGN server syntax checks passed.');

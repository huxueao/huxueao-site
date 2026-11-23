import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await walk(p));else if(/\.(mjs|js)$/.test(p))out.push(p);}return out;}
const files=(await Promise.all(['public','worker','dev','scripts','tests'].map(walk))).flat();
for(const file of files){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status){process.stderr.write(r.stderr);process.exit(r.status);}}
console.log(`Syntax checked ${files.length} JavaScript modules.`);

import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const files=['sw.js',...(await readdir('src')).filter(n=>n.endsWith('.js')).map(n=>'src/'+n),...(await readdir('scripts')).filter(n=>n.endsWith('.mjs')).map(n=>'scripts/'+n)];
let failed=false;
for(const file of files) { const run=spawnSync(process.execPath,['--check',file],{stdio:'inherit'}); if(run.status!==0) failed=true; }
if(failed) process.exit(1);
console.log(`Syntax checked ${files.length} JavaScript modules.`);

import { cp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const dist=join(root,'dist');
await rm(dist,{recursive:true,force:true}); await mkdir(dist,{recursive:true});
const paths=['index.html','manifest.webmanifest','sw.js','src','styles','public'];
for(const path of paths) await cp(join(root,path),join(dist,path),{recursive:true});
const hash=createHash('sha256');
async function walk(path) {
  const entries=(await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
  for(const entry of entries) {const file=join(path,entry.name); if(entry.isDirectory()) await walk(file); else {hash.update(file.slice(dist.length));hash.update(await readFile(file));}}
}
await walk(dist);
const buildId=hash.digest('hex').slice(0,16);
const sw=await readFile(join(dist,'sw.js'),'utf8');
await writeFile(join(dist,'sw.js'),sw.replace('__BUILD_ID__',buildId));
await writeFile(join(dist,'.nojekyll'),'');
console.log(`Built dist/ · cache version ${buildId}\nStatic files only. No environment variables, API keys, or dependencies.`);

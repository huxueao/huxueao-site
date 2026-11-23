import { cp,mkdir,writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
await build({entryPoints:['worker/index.js'],outfile:'dist/_worker.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
await writeFile('dist/_routes.json',JSON.stringify({version:1,include:['/*'],exclude:[]},null,2));
console.log('Cloudflare Pages output is ready in dist/. Configure the DB binding and Access variables before publishing.');

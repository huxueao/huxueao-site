import http from 'node:http';
import { readFile,stat,mkdir } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createHandler } from '../worker/index.js';
import { openDB } from './db.mjs';

const root=resolve('public'),port=Number(process.env.PORT||4321),origin=`http://127.0.0.1:${port}`;
await mkdir('.local',{recursive:true});
const DB=openDB(resolve('.local/oblique.sqlite'));
const sessions=new Set(),loginNonce=randomBytes(24).toString('hex');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.json':'application/json'};
const assets={async fetch(request){
  let pathname=decodeURIComponent(new URL(request.url).pathname);
  if(pathname==='/')pathname='/index.html';
  if(pathname==='/admin')pathname='/admin.html';
  const path=resolve(root,'.'+pathname);
  if(!path.startsWith(root+sep))return new Response('Not found',{status:404});
  try{if(!(await stat(path)).isFile())throw new Error();return new Response(request.method==='HEAD'?null:await readFile(path),{headers:{'Content-Type':mime[extname(path)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}
}};
const handler=createHandler({authenticate:async request=>{
  const cookie=request.headers.get('cookie')?.split('; ').find(v=>v.startsWith('oblique_dev='))?.slice(12);
  return cookie&&sessions.has(cookie)?{email:'local-owner@preview',id:'local-owner'}:{error:'This is the local preview. Visit /dev/login to enter the local writing workspace.',status:401};
}});
const server=http.createServer(async(req,res)=>{
  try{
    if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403);res.end('Use the loopback address printed in the terminal.');return;}
    const url=new URL(req.url,origin);
    if(url.pathname==='/dev/login'){
      if(req.method==='POST'){
        let body='';for await(const chunk of req){body+=chunk;if(body.length>2000)throw new Error('Request too large');}
        if(req.headers.origin!==origin||new URLSearchParams(body).get('nonce')!==loginNonce){res.writeHead(403);res.end('Invalid local login.');return;}
        const token=randomBytes(32).toString('hex');sessions.add(token);res.writeHead(303,{'Location':'/admin','Set-Cookie':`oblique_dev=${token}; HttpOnly; SameSite=Strict; Path=/`});res.end();return;
      }
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY'});
      res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Local workspace</title><link rel="stylesheet" href="/style.css"><main class="access-page"><span class="eyebrow">LOCAL PREVIEW ONLY</span><h1>The writing room.</h1><p>This workspace saves to a local database on this computer. Production uses your Cloudflare Access login.</p><form method="post"><input type="hidden" name="nonce" value="${loginNonce}"><button class="button primary">Enter local workspace</button></form><p><a href="/">Back to the publication</a></p></main></html>`);return;
    }
    if(url.pathname==='/cdn-cgi/access/logout'){sessions.clear();res.writeHead(303,{'Location':'/','Set-Cookie':'oblique_dev=; Max-Age=0; Path=/'});res.end();return;}
    const chunks=[];let size=0;
    for await(const c of req){size+=c.length;if(size>1_100_000){res.writeHead(413);res.end('Too large');return;}chunks.push(c);}
    const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
    const response=await handler.fetch(request,{DB,ASSETS:assets,SITE_URL:origin,SITE_NAME:'JANUS'});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error(error);res.writeHead(500);res.end('Local server error');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Janus preview: ${origin}\nLocal owner login: ${origin}/dev/login`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));

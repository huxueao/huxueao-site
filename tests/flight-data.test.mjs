import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {calendarDate,rollingWindow,parseYahoo,parseCoinbase,flightMarketResponse} from '../worker/flight-data.js';
const snapshot=JSON.parse(fs.readFileSync(new URL('../public/flight/market-data.json',import.meta.url),'utf8'));
test('rolling dates use Singapore today, including midnight and leap years',()=>{
  assert.deepEqual(rollingWindow(new Date('2026-11-24T16:01:00Z')),{windowStart:'2025-11-25',windowEnd:'2026-11-25'});assert.deepEqual(rollingWindow(new Date('2024-02-29T01:00:00Z')),{windowStart:'2023-02-28',windowEnd:'2024-02-29'});assert.equal(calendarDate(new Date('2026-11-24T15:59:00Z')),'2026-11-24');
});
function sampleRows(now){const {windowStart}=rollingWindow(now),start=Date.parse(windowStart)/1000,rows=[];for(let ts=start;ts<=now.getTime()/1000;ts+=86400)rows.push([ts,9,12,10,11,100]);return rows;}
test('Bitcoin parsing merges chunk boundaries and excludes the unfinished UTC day',()=>{
  const now=new Date('2026-11-24T16:00:00Z'),rows=sampleRows(now),candles=parseCoinbase([...rows,rows[10]],rollingWindow(now),now);assert.equal(candles.length,364);assert.equal(candles.at(-1).date,'2026-11-23');assert.equal(candles[0].date,'2025-11-25');
});
test('equity parsing excludes the open session and accepts the completed session',()=>{
  const now=new Date('2026-11-24T16:00:00Z'),rows=sampleRows(now),timestamp=rows.map(r=>r[0]+14.5*3600),quote={open:rows.map(()=>10),high:rows.map(()=>12),low:rows.map(()=>9),close:rows.map(()=>11),volume:rows.map(()=>100)};
  const body={chart:{result:[{meta:{symbol:'NVDA',currentTradingPeriod:{regular:{start:Date.parse('2026-11-24T14:30Z')/1000,end:Date.parse('2026-11-24T21:00Z')/1000}}},timestamp,indicators:{quote:[quote]}}]}};
  assert.equal(parseYahoo(body,'NVDA',rollingWindow(now),now).at(-1).date,'2026-11-23');const later=new Date('2026-11-24T21:05Z');assert.equal(parseYahoo(body,'NVDA',rollingWindow(later),later).at(-1).date,'2026-11-24');
  body.chart.result[0].meta.currentTradingPeriod.regular={start:Date.parse('2026-11-25T14:30Z')/1000,end:Date.parse('2026-11-25T21:00Z')/1000};assert.equal(parseYahoo(body,'NVDA',rollingWindow(later),later).at(-1).date,'2026-11-24');
});
test('market endpoint limits assets, labels fallback snapshots, and reuses the cache',async()=>{
  let fetches=0;const fetcher=async()=>{fetches++;throw Error('Unavailable');},store=new Map(),cache={match:async r=>store.get(r.url)?.clone(),put:async(r,s)=>store.set(r.url,s)},env={ASSETS:{fetch:async()=>Response.json(snapshot)}};
  const request=new Request('https://example.com/api/flight/market?symbol=NVDA'),options={now:new Date(snapshot.fetchedAt),fetcher,cache};
  const one=await flightMarketResponse(request,env,options),data=await one.json();assert.equal(one.status,200);assert.equal(data.isFallback,true);assert.equal(data.windowStart,snapshot.windowStart);assert.equal(data.asOf,snapshot.assets[0].candles.at(-1).date);await flightMarketResponse(request,env,options);assert.equal(fetches,1);
  const bad=await flightMarketResponse(new Request('https://example.com/api/flight/market?symbol=https://example.org'),env,options);assert.equal(bad.status,400);assert.equal(fetches,1);
  const post=await flightMarketResponse(new Request(request,{method:'POST'}),env,options);assert.equal(post.status,405);
});

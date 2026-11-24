import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {HEIGHT,makeCourse,createFlight,flap,step,nextGate,validateMarketData,saveFlight,restoreFlight} from '../public/flight/model.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/flight/market-data.json',import.meta.url),'utf8'));
const payload=asset=>{const {assets,...meta}=data;return {...meta,asset,asOf:asset.candles.at(-1).date,isFallback:false};};
function pilot(s,until=Infinity){let n=0;while(s.phase==='running'&&s.score<until&&n++<120*1500){if(s.bird.vy>-180&&s.bird.y>nextGate(s).center+18)flap(s);step(s,1/120);}return s;}
test('all four assets contain a full rolling year of chronological OHLC data',()=>{
  validateMarketData(data);assert.equal(data.assets.length,4);for(const a of data.assets){validateMarketData(payload(a));assert.ok(a.candles.length>=(a.symbol==='BTC'?300:180));assert.ok(a.candles[0].date>=data.windowStart);assert.ok(a.candles.at(-1).date<=data.windowEnd);}
  const bad=structuredClone(data);bad.assets[0].candles[0].high=0;assert.throws(()=>validateMarketData(bad));const truncated=structuredClone(data);truncated.assets[0].candles=truncated.assets[0].candles.slice(150);assert.throws(()=>validateMarketData(truncated));
});
test('annual body windows preserve all dates and prices, widen dojis, and fit the screen',()=>{
  for(const a of data.assets){const course=makeCourse(a);assert.equal(course.length,a.candles.length);course.forEach((g,i)=>{for(const f of ['date','open','high','low','close','volume'])assert.equal(g[f],a.candles[i][f]);assert.ok(g.top>=20&&g.bottom<=HEIGHT-20);assert.ok(g.gap>=142&&g.gap<=194);if(i)assert.ok(g.x>course[i-1].x);});}
  assert.equal(makeCourse({candles:[{date:'2026-01-01',open:10,close:10,low:9,high:11}]})[0].gap,142);
});
test('collision boundaries, points, pause and victory remain consistent',()=>{
  const course=[{index:0,x:150,top:180,bottom:360,center:270}];const hit=createFlight(course);hit.phase='running';hit.bird.x=140;hit.bird.y=170;step(hit,.01);assert.equal(hit.phase,'crashed');assert.equal(hit.score,0);
  const good=createFlight(course);good.phase='running';good.bird.y=270;good.distance=90;step(good,.01);assert.equal(good.phase,'cleared');assert.equal(good.score,1);step(good,.01);assert.equal(good.score,1);
  const paused=createFlight(course);paused.phase='paused';const before=structuredClone(paused);step(paused,1);flap(paused);assert.deepEqual(paused,before);const edge=createFlight(course);edge.phase='running';edge.bird.y=HEIGHT-10;step(edge,.01);assert.equal(edge.reason,'edge');
});
test('all four complete annual courses can be finished using only flap inputs',()=>{
  for(const a of data.assets){const s=createFlight(makeCourse(a));flap(s);pilot(s);assert.equal(s.phase,'cleared',`${a.symbol}: ${s.score}/${s.course.length}`);assert.equal(s.score,a.candles.length);}
});
test('saving and resuming freezes the course and continues to the same result',()=>{
  const p=payload(data.assets[0]),s=createFlight(makeCourse(p.asset));flap(s);pilot(s,40);assert.equal(s.score,40);const saved=JSON.parse(JSON.stringify(saveFlight(s,p))),restored=restoreFlight(saved);assert.ok(restored);assert.equal(restored.state.phase,'paused');assert.equal(restored.state.score,40);assert.deepEqual(restored.data,p);
  restored.state.phase='running';pilot(restored.state);pilot(s);assert.equal(restored.state.phase,'cleared');assert.deepEqual(restored.state,s);
  saved.state.bird.y=NaN;assert.equal(restoreFlight(saved),null);saved.state.bird.y=250;saved.state.score=999;assert.equal(restoreFlight(saved),null);
});

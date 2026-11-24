import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ASSETS,MONTHS,WIDTH,HEIGHT,RADIUS,GATE_WIDTH,makeCourse,createFlight,flap,step,nextGate,validateMarketData} from '../public/flight/model.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/flight/market-data.json',import.meta.url),'utf8'));
test('all four assets contain real dated OHLC snapshots and three complete courses',()=>{
  validateMarketData(data);assert.equal(data.assets.length,4);assert.equal(data.assets.find(a=>a.symbol==='NVDA').candles[0].date,'2024-01-02');assert.equal(data.assets.find(a=>a.symbol==='BTC').candles.length,91);
  const bad=structuredClone(data);bad.assets[0].candles[0].high=0;assert.throws(()=>validateMarketData(bad));
});
test('body windows preserve dates and prices, widen dojis, and fit playable bounds',()=>{
  for(const asset of data.assets)for(const month of MONTHS){const course=makeCourse(asset,month),raw=asset.candles.filter(c=>c.date.startsWith(month));assert.equal(course.length,raw.length);
    course.forEach((g,i)=>{for(const field of ['date','open','high','low','close','volume'])assert.equal(g[field],raw[i][field]);assert.ok(g.top>=20&&g.bottom<=HEIGHT-20);assert.ok(g.gap>=142&&g.gap<=194);if(i)assert.ok(g.x>course[i-1].x);});
  }
  const course=makeCourse({candles:[{date:'2024-01-01',open:10,close:10,low:9,high:11}]},'2024-01');assert.equal(course[0].gap,142);
});
test('walls, candle boundaries, points, pause and victory use one consistent collision model',()=>{
  const course=[{index:0,x:150,top:180,bottom:360,center:270}];
  const hit=createFlight(course);hit.phase='running';hit.bird.x=140;hit.bird.y=170;step(hit,.01);assert.equal(hit.phase,'crashed');assert.equal(hit.score,0);
  const good=createFlight(course);good.phase='running';good.bird.y=270;good.distance=90;step(good,.01);assert.equal(good.phase,'cleared');assert.equal(good.score,1);step(good,.01);assert.equal(good.score,1);
  const paused=createFlight(course);paused.phase='paused';const before=structuredClone(paused);step(paused,1);flap(paused);assert.deepEqual(paused,before);
  const edge=createFlight(course);edge.phase='running';edge.bird.y=HEIGHT-10;step(edge,.01);assert.equal(edge.reason,'edge');
});
test('a simple flap controller can finish all twelve historical courses',()=>{
  for(const asset of data.assets)for(const month of MONTHS){const s=createFlight(makeCourse(asset,month));flap(s);let n=0;
    while(s.phase==='running'&&n++<120*80){const gate=nextGate(s);
      const target=gate.center;
      if(s.bird.vy>-180&&s.bird.y>target+18)flap(s);
      step(s,1/120);
    }
    assert.equal(s.phase,'cleared',`${asset.symbol} ${month}: ${s.score}/${s.course.length}, y=${s.bird.y.toFixed(1)}`);
  }
});

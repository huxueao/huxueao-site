import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {HEIGHT,WIDTH,BIRD_X,GATE_WIDTH,RADIUS,PRICE_SCALE,EDGE_GRACE,CLIMB_SPEED,FALL_SPEED,makeCourse,createFlight,flap,step,validateMarketData,saveFlight,restoreFlight} from '../public/flight/model.js';
import {wantsFlap} from './flight-pilot.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../public/flight/market-data.json',import.meta.url),'utf8'));
const payload=asset=>{const {assets,...meta}=data;return {...meta,asset,asOf:asset.candles.at(-1).date,isFallback:false};};
function pilot(s,until=Infinity){let n=0;while(s.phase==='running'&&s.score<until&&n++<120*1800){if(wantsFlap(s))flap(s);step(s,1/120);}return s;}
test('all four assets contain a full rolling year of chronological OHLC data',()=>{
  validateMarketData(data);assert.equal(data.assets.length,4);for(const a of data.assets){validateMarketData(payload(a));assert.ok(a.candles.length>=(a.symbol==='BTC'?300:180));}
  const bad=structuredClone(data);bad.assets[0].candles[0].high=0;assert.throws(()=>validateMarketData(bad));const truncated=structuredClone(data);truncated.assets[0].candles=truncated.assets[0].candles.slice(150);assert.throws(()=>validateMarketData(truncated));
});
test('real bodies, wicks and jumps share one linear scale without fitting the annual range',()=>{
  for(const a of data.assets){const course=makeCourse(a),scale=PRICE_SCALE/a.candles[0].open;assert.equal(course.length,a.candles.length);course.forEach((g,i)=>{for(const f of ['date','open','high','low','close','volume'])assert.equal(g[f],a.candles[i][f]);assert.ok(Math.abs(g.gap-Math.abs(g.close-g.open)*scale)<1e-8);assert.ok(Math.abs(g.highY-g.lowY+(g.high-g.low)*scale)<1e-8);if(i)assert.ok(Math.abs(g.center-course[i-1].center-((course[i-1].open+course[i-1].close-g.open-g.close)/2)*scale)<1e-8);});}
  const candles=[{open:100,close:100,high:101,low:99},{open:190,close:200,high:210,low:180},{open:40,close:30,high:45,low:25}];const c=makeCourse({candles});assert.equal(c[0].gap,0);assert.ok(c[1].center< -HEIGHT);assert.ok(c[2].center>HEIGHT);assert.deepEqual(makeCourse({candles:[...candles,{open:10000,close:20000,high:21000,low:9000}]}).slice(0,3),c);assert.ok(c.filter(g=>g.x<WIDTH).length===3);assert.ok(GATE_WIDTH>=40);
});
test('small centre hitbox forgives grazing while still blocking outside the real body',()=>{
  const course=[{index:0,x:BIRD_X,top:0,bottom:2,center:1}];const graze=createFlight(course);graze.phase='running';graze.bird.y=-EDGE_GRACE+RADIUS+.1;step(graze,0);assert.equal(graze.phase,'running');
  const hit=createFlight(course);hit.phase='running';hit.bird.y=-EDGE_GRACE+RADIUS-.1;step(hit,0);assert.equal(hit.phase,'crashed');assert.equal(hit.score,0);
  const passed=createFlight(course);passed.phase='running';passed.distance=GATE_WIDTH+RADIUS+1;step(passed,0);assert.equal(passed.phase,'cleared');assert.equal(passed.score,1);step(passed,.01);assert.equal(passed.score,1);
});
test('camera follows world-space climbs and falls without invisible screen-edge deaths',()=>{
  for(const y of [-3000,3000]){const s=createFlight([{index:0,x:1e6,top:y-20,bottom:y+20,center:y}]);s.phase='running';s.bird.y=y;s.cameraY=-HEIGHT/2;for(let i=0;i<240;i++)step(s,1/120);assert.equal(s.phase,'running');assert.ok(s.bird.y-s.cameraY>30&&s.bird.y-s.cameraY<HEIGHT-30);assert.ok(Math.abs(s.cameraY)>1000);}
});
test('one tap is a bounded jump, repeated taps climb, and no input falls',()=>{
  const make=()=>{const s=createFlight([{index:0,x:1e6,top:-1e6,bottom:1e6,center:0}]);s.phase='running';return s;},tap=make(),repeat=make();
  flap(tap);flap(repeat);for(let i=0;i<12;i++){step(tap,1/120);step(repeat,1/120);}assert.ok(tap.bird.y<0&&tap.bird.y>-15);
  for(let i=0;i<108;i++){step(tap,1/120);if(i%12===0)flap(repeat);step(repeat,1/120);}assert.ok(tap.bird.y>0);assert.ok(repeat.bird.y< -200);assert.ok(tap.bird.vy<=FALL_SPEED&&repeat.bird.vy>=-CLIMB_SPEED);
  repeat.phase='paused';const before=structuredClone(repeat);step(repeat,1);flap(repeat);assert.deepEqual(repeat,before);
});
test('all four real annual courses can be finished using only separate tap inputs',()=>{
  for(const a of data.assets){const s=createFlight(makeCourse(a));flap(s);pilot(s);assert.equal(s.phase,'cleared',`${a.symbol}: ${s.score}/${s.course.length}`);assert.equal(s.score,a.candles.length);}
});
test('save and resume preserve the world position, camera, annual data and final result',()=>{
  const p=payload(data.assets[0]),s=createFlight(makeCourse(p.asset));flap(s);pilot(s,40);assert.equal(s.score,40);const saved=JSON.parse(JSON.stringify(saveFlight(s,p))),restored=restoreFlight(saved);assert.ok(restored);assert.equal(restored.state.phase,'paused');assert.equal(restored.state.score,40);assert.equal(restored.state.cameraY,s.cameraY);assert.equal(saved.version,4);assert.deepEqual(restored.data,p);
  restored.state.phase='running';pilot(restored.state);pilot(s);assert.deepEqual(restored.state,s);saved.state.cameraY=NaN;assert.equal(restoreFlight(saved),null);saved.state.cameraY=saved.state.bird.y-HEIGHT/2;saved.state.score=999;assert.equal(restoreFlight(saved),null);
});
test('old flight saves keep their last completed candle when upgrading the controls',()=>{
  const legacy={version:2,data:payload(data.assets[0]),state:{bird:{x:112,y:270,vy:10},distance:770,time:770/118,score:3,lastPassed:2}};const r=restoreFlight(legacy);assert.ok(r?.migrated);assert.equal(r.state.score,3);assert.equal(r.state.bird.x,BIRD_X);assert.ok(restoreFlight(saveFlight(r.state,r.data)));legacy.state.score=100;assert.equal(restoreFlight(legacy),null);
});

test('hold-control saves migrate without losing completed candles',()=>{
  const legacy={version:3,data:payload(data.assets[0]),state:{bird:{x:BIRD_X,y:0,vy:120},cameraY:-300,distance:460,time:460/58,score:3,lastPassed:2}};
  const r=restoreFlight(legacy);assert.ok(r?.migrated);assert.equal(r.state.score,3);assert.equal(r.state.bird.vy,0);assert.ok(restoreFlight(saveFlight(r.state,r.data)));
  legacy.state.score=100;assert.equal(restoreFlight(legacy),null);
});

import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_BASE||'http://127.0.0.1:4321';
const snapshot=JSON.parse(await fs.readFile('public/flight/market-data.json','utf8'));
const payload=s=>{const {assets,...meta}=snapshot,asset=assets.find(a=>a.symbol===s);return {...meta,asset,asOf:asset.candles.at(-1).date,isFallback:false};};
const RUN='janus-candle-flight-run-v4',BEST='janus-candle-flight-best-v4';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
await fs.mkdir('.local/screenshots',{recursive:true});
const errors=[],requests=[];let fallback=false;
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const mock=ctx=>ctx.route('**/api/flight/market?*',async route=>{const symbol=new URL(route.request().url()).searchParams.get('symbol');requests.push(symbol);await route.fulfill({json:{...payload(symbol),isFallback:fallback}});});
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
await mock(context);watch(page);
// Exercise DOM events and the real animation loop without adding game debug APIs.
function clock(){let time=0,id=0;const frames=new Map();window.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};window.cancelAnimationFrame=n=>frames.delete(n);window.__advanceFrame=()=>{time+=1000/120;const current=[...frames.values()];frames.clear();for(const cb of current)cb(time);};for(const method of ['fillRect','strokeRect','clearRect','fillText','drawImage','fill','stroke']){const fn=CanvasRenderingContext2D.prototype[method];CanvasRenderingContext2D.prototype[method]=function(...args){if(!window.__skipPaint)return fn.apply(this,args);};}}
await page.addInitScript(clock);
const overflow=async p=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
const frames=(p,n=1)=>p.evaluate(n=>{for(let i=0;i<n;i++)window.__advanceFrame();},n);
const saved=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),RUN);
async function wide(p){await overflow(p);const b=await p.locator('.flight-stage').boundingBox();const size=p.viewportSize();assert.ok(b.width>size.width*.92,`playfield too narrow: ${b.width}/${size.width}`);const w=Number(await p.locator('canvas').getAttribute('width'));assert.ok(Math.abs(w/600-b.width/b.height)<.01,'canvas is stretched');return b;}
async function drive(until=999,fromSave=false){return page.evaluate(async({until,fromSave,RUN})=>{
  const m=await import('/flight/model.js');let s;if(fromSave){s=m.restoreFlight(JSON.parse(localStorage.getItem(RUN))).state;s.phase='running';}else{const data=await(await fetch('/api/flight/market?symbol=NVDA')).json();s=m.createFlight(m.makeCourse(data.asset));m.flap(s);}const canvas=document.querySelector('canvas');window.__skipPaint=true;window.__advanceFrame();let n=0,cameraMin=s.cameraY,cameraMax=s.cameraY;
  while(s.phase==='running'&&s.score<until&&n++<120*1500){
    let index=Math.min(s.score,s.course.length-1);if(s.course[index].x-s.distance+m.COLLISION_WIDTH/2+m.RADIUS<s.bird.x)index=Math.min(index+1,s.course.length-1);
    const boost=Math.max(-m.CLIMB_SPEED,Math.min(s.bird.vy,0)-m.FLAP_SPEED);
    if(s.bird.y-boost*boost/(2*m.GRAVITY)>=s.course[index].center-5&&s.flapFlash<.05){canvas.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));canvas.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true}));m.flap(s);}
    m.step(s,1/120);window.__advanceFrame();cameraMin=Math.min(cameraMin,s.cameraY);cameraMax=Math.max(cameraMax,s.cameraY);
  }
  window.__skipPaint=false;window.__advanceFrame();return {phase:s.phase,score:s.score,cameraTravel:cameraMax-cameraMin,shown:Number(document.querySelector('.flight-score b').textContent)};
},{until,fromSave,RUN});}
try{
  await page.goto(base+'/play/candle-flight');await page.locator('[data-start-flight]').waitFor();await page.evaluate(()=>document.fonts.ready);await page.locator('.pilot-window img').first().evaluate(img=>img.decode());await frames(page);await wide(page);
  assert.equal(await page.locator('.pilot-card').count(),4);assert.ok((await page.locator('.flight-period').textContent()).includes(snapshot.windowStart));assert.ok((await page.locator('.flight-period').textContent()).includes(payload('NVDA').asOf));
  await page.screenshot({path:'.local/screenshots/flight-desktop.png',fullPage:true});
  await page.setViewportSize({width:1920,height:1080});await frames(page);await wide(page);await page.screenshot({path:'.local/screenshots/flight-wide.png',fullPage:true});await page.setViewportSize({width:1440,height:900});await frames(page);
  for(const symbol of ['TSLA','AAPL','BTC','NVDA']){await page.locator(`[data-asset-choice="${symbol}"]`).click();await page.locator(`.flight[data-asset="${symbol}"]`).waitFor();assert.equal(await page.locator('[data-hud] strong').textContent(),symbol);assert.ok((await page.locator('.flight-score').textContent()).includes(String(payload(symbol).asset.candles.length)));}
  await page.locator('[data-language]').click();assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');assert.ok((await page.locator('.flight-controls').textContent()).includes('点击'));await page.locator('[data-language]').click();
  // Starting with Space must trigger exactly one jump. Holding/repeated keydowns add none.
  await page.locator('canvas').focus();await page.keyboard.down('Space');await frames(page);
  await page.locator('canvas').dispatchEvent('keydown',{code:'Space',repeat:true});await frames(page,120);await page.keyboard.up('Space');await page.keyboard.press('KeyP');
  const held=await saved(page);const expected=await page.evaluate(async()=>{const m=await import('/flight/model.js'),d=await(await fetch('/api/flight/market?symbol=NVDA')).json(),s=m.createFlight(m.makeCourse(d.asset));m.flap(s);for(let i=0;i<120;i++)m.step(s,1/120);return s;});assert.equal(held.state.bird.vy,expected.bird.vy);assert.ok(Math.abs(held.state.bird.y-expected.bird.y)<.0001,'holding caused extra flaps');
  await page.locator('[data-hangar]').click();await page.locator('[data-start-flight]').click();
  // A real pointer down flaps once; its click event and holding must not add another.
  await frames(page);const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.3,box.y+box.height*.5);await page.mouse.down();await frames(page,60);await page.mouse.up();await page.locator('[data-pause]').click();
  const clicked=await saved(page),expClick=await page.evaluate(async()=>{const m=await import('/flight/model.js'),d=await(await fetch('/api/flight/market?symbol=NVDA')).json(),s=m.createFlight(m.makeCourse(d.asset));m.flap(s);m.flap(s);for(let i=0;i<60;i++)m.step(s,1/120);return s;});assert.ok(Math.abs(clicked.state.bird.y-expClick.bird.y)<.0001,'pointer tap was duplicated');assert.equal(clicked.state.bird.vy,expClick.bird.vy);
  await page.locator('[data-hangar]').click();await page.locator('[data-start-flight]').click();const played=await drive();assert.equal(played.phase,'cleared');assert.ok(played.cameraTravel>300);assert.equal(played.shown,payload('NVDA').asset.candles.length);await page.getByRole('heading',{name:'YEAR CLEARED!'}).waitFor();assert.equal(await saved(page),null);await page.screenshot({path:'.local/screenshots/flight-win.png',fullPage:true});
  assert.equal(await page.evaluate(({BEST,k})=>JSON.parse(localStorage.getItem(BEST))[k],{BEST,k:`NVDA:${snapshot.windowStart}:${snapshot.windowEnd}`}),played.shown);
  await page.locator('[data-retry-flight]').click();await frames(page,550);await page.getByRole('heading',{name:'FLIGHT OVER'}).waitFor();assert.equal(await saved(page),null);
  await page.locator('[data-retry-flight]').click();assert.equal((await drive(40)).shown,40);await wide(page);await page.screenshot({path:'.local/screenshots/flight-camera-play.png',fullPage:true});await page.keyboard.press('KeyP');await page.getByRole('heading',{name:'PAUSED'}).waitFor();
  const run=await saved(page);assert.equal(run.version,4);assert.equal(run.state.score,40);assert.ok(Number.isFinite(run.state.cameraY));assert.equal(run.data.windowEnd,snapshot.windowEnd);
  await page.reload();await page.locator('[data-continue-flight]').click();assert.equal(await page.locator('.flight-score b').textContent(),'40');
  await page.locator('[data-language]').click();assert.equal(await page.locator('.flight-score b').textContent(),'40');assert.equal(await page.locator('.flight-overlay').isVisible(),false);await page.locator('[data-language]').click();
  assert.equal((await drive(42,true)).shown,42);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.getByRole('heading',{name:'PAUSED'}).waitFor();
  await page.locator('[data-hangar]').click();await page.locator('[data-continue-flight]').waitFor();fallback=true;await page.locator('[data-asset-choice="BTC"]').click();await page.locator('.flight[data-asset="BTC"]').waitFor();assert.ok((await page.locator('.flight-data-notice').textContent()).includes(snapshot.fetchedAt.slice(0,10)));fallback=false;await page.locator('[data-refresh]').click();await page.locator('.flight[data-asset="BTC"]').waitFor();assert.equal(await page.locator('.flight-data-notice').count(),0);
  // Previous hold-control save upgrades at the same completed candle.
  const old={version:3,data:payload('NVDA'),state:{bird:{x:160,y:0,vy:120},cameraY:-300,distance:460,time:460/58,score:3,lastPassed:2}};
  await page.evaluate(({RUN,old})=>{localStorage.removeItem(RUN);localStorage.setItem('janus-candle-flight-run-v3',JSON.stringify(old));},{RUN,old});await page.reload();await page.locator('[data-continue-flight]').click();assert.equal(await page.locator('.flight-score b').textContent(),'3');assert.equal((await saved(page)).version,4);
  await page.locator('.site-nav a[href="/projects"]').click();assert.equal(await page.locator('.flight').count(),0);assert.ok(!(await page.locator('body').getAttribute('class')).includes('flight-page'));await page.locator('.project-copy .button[href="/play/strata"]').click();await page.locator('[data-deck]').first().waitFor();
  const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});await mock(mobile);await mobile.addInitScript(clock);const mp=await mobile.newPage();watch(mp);
  await mp.goto(base+'/play/candle-flight');await mp.getByRole('heading',{name:'Turn your phone sideways'}).waitFor();assert.ok(await mp.locator('.flight-layout').isHidden());await overflow(mp);await mp.screenshot({path:'.local/screenshots/flight-mobile-rotate.png',fullPage:true});
  await mp.locator('[data-language]').tap();await mp.getByRole('heading',{name:'请将手机横过来'}).waitFor();await mp.locator('[data-language]').tap();
  await mp.setViewportSize({width:844,height:390});await mp.locator('[data-start-flight]').tap();await frames(mp);await mp.locator('canvas').tap();await frames(mp,30);await wide(mp);assert.ok(await mp.locator('.flight-lobby').isHidden());await mp.screenshot({path:'.local/screenshots/flight-mobile-play.png',fullPage:true});
  // Rotation pauses immediately and does not silently resume on returning to landscape.
  await mp.setViewportSize({width:390,height:844});await mp.getByRole('heading',{name:'Turn your phone sideways'}).waitFor();const rotated=await saved(mp);await frames(mp,120);assert.deepEqual((await saved(mp)).state,rotated.state);
  await mp.setViewportSize({width:844,height:390});await mp.getByRole('heading',{name:'PAUSED'}).waitFor();await mp.locator('[data-resume]').tap();await frames(mp,2);await mp.locator('[data-pause]').tap();await mp.getByRole('heading',{name:'PAUSED'}).waitFor();await overflow(mp);
  await mp.locator('[data-hangar]').tap();await mp.locator('[data-continue-flight]').waitFor();await mp.locator('.site-nav a[href="/projects"]').tap();assert.equal(await mp.locator('.flight').count(),0);
  await mp.goto(base);await mp.locator('.brand-coin').evaluate(img=>img.decode());await mp.setViewportSize({width:390,height:844});await overflow(mp);await mp.screenshot({path:'.local/screenshots/flight-home-mobile.png',fullPage:true});await mobile.close();
  // Capture actual display frames as well as the deterministic simulation above.
  const touch=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,reducedMotion:'reduce'});await mock(touch);const tp=await touch.newPage();watch(tp);await tp.goto(base+'/play/candle-flight');await tp.locator('[data-start-flight]').tap();await tp.locator('canvas').tap();await tp.waitForTimeout(150);await wide(tp);
  const controls=await tp.locator('.flight-controls').boundingBox();assert.ok(controls.y+controls.height<=390,'landscape controls must fit on screen');await tp.screenshot({path:'.local/screenshots/flight-mobile-play.png'});await tp.locator('[data-pause]').tap();await tp.getByRole('heading',{name:'PAUSED'}).waitFor();await touch.close();
  assert.ok(['NVDA','TSLA','AAPL','BTC'].every(s=>requests.includes(s)));assert.deepEqual(errors,[]);console.log('Flight browser checks passed: full-width desktop, full year via separate Space presses, single pointer impulse, held-input suppression, camera/save/reload/migration, all assets, languages, delayed updates, portrait gate, landscape touch, rotation pause, and navigation.');
}finally{if(errors.length)console.error(errors);await browser.close();}

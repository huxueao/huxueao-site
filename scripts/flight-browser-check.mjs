import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_BASE||'http://127.0.0.1:4321';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
await fs.mkdir('.local/screenshots',{recursive:true});
const errors=[];
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
// Drive the real animation loop and real DOM inputs at fixed time steps, without
// adding debug state, cheats, or automatic play to the shipped game.
await page.addInitScript(()=>{let clock=0,id=0;const frames=new Map();window.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};window.cancelAnimationFrame=n=>frames.delete(n);window.__advanceFrame=()=>{clock+=1000/120;const current=[...frames.values()];frames.clear();for(const cb of current)cb(clock);};});
const overflow=async p=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
try{
  await page.goto(base+'/play/candle-flight');await page.getByRole('button',{name:'Fly',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.locator('.pilot-window img').first().evaluate(img=>img.decode());await page.evaluate(()=>window.__advanceFrame());await overflow(page);
  assert.equal(await page.locator('.pilot-card').count(),4);assert.equal(await page.locator('.flight-months button').count(),3);assert.equal(await page.locator('.pilot-card[aria-pressed=true]').getAttribute('data-asset-choice'),'NVDA');
  await page.screenshot({path:'.local/screenshots/flight-desktop.png',fullPage:true});
  for(const symbol of ['TSLA','AAPL','BTC','NVDA']){await page.locator(`[data-asset-choice="${symbol}"]`).click();assert.equal(await page.locator('.flight').getAttribute('data-asset'),symbol);assert.equal(await page.locator('[data-hud] strong').textContent(),symbol);}
  await page.locator('[data-month="2024-02"]').click();await page.getByRole('button',{name:'Switch to Chinese'}).click();assert.equal(await page.locator('.flight-months button[aria-pressed=true]').getAttribute('data-month'),'2024-02');await page.getByRole('button',{name:'起飞',exact:true}).waitFor();await page.getByRole('button',{name:'切换到英文'}).click();
  await page.locator('[data-month="2024-01"]').click();await page.getByRole('button',{name:'Fly',exact:true}).click();
  const played=await page.evaluate(async()=>{
    const {makeCourse,createFlight,flap,step,nextGate}=await import('/flight/model.js');const data=await(await fetch('/flight/market-data.json')).json();const s=createFlight(makeCourse(data.assets.find(a=>a.symbol==='NVDA'),'2024-01'));flap(s);const canvas=document.querySelector('canvas');window.__advanceFrame();let n=0,stages=[];
    while(s.phase==='running'&&n++<9600){const target=nextGate(s).center;if(s.bird.vy>-180&&s.bird.y>target+18){canvas.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));flap(s);}step(s,1/120);window.__advanceFrame();}
    for(let i=0;i<4;i++)window.__advanceFrame();
    return {phase:s.phase,score:s.score,shown:document.querySelector('[data-hud] .flight-score b').textContent,overlay:document.querySelector('.flight-overlay h2')?.textContent};
  });
  assert.equal(played.phase,'cleared');assert.equal(played.shown,'21');await page.getByRole('heading',{name:'MONTH CLEARED!'}).waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('janus-candle-flight-best-v1'))['NVDA:2024-01']),21);await page.screenshot({path:'.local/screenshots/flight-win.png',fullPage:true});
  await page.getByRole('button',{name:'Try again',exact:true}).click();await page.evaluate(()=>{for(let i=0;i<160;i++)window.__advanceFrame();});await page.getByRole('heading',{name:'FLIGHT OVER'}).waitFor();await page.getByRole('button',{name:'Choose pilot',exact:true}).click();await page.getByRole('button',{name:'Fly',exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Fly',exact:true}).waitFor();await page.evaluate(()=>window.__advanceFrame());assert.ok((await page.locator('[data-hud]').textContent()).includes('Best 21'));
  await page.getByRole('button',{name:'Fly',exact:true}).click();await page.keyboard.press('KeyP');await page.getByRole('heading',{name:'PAUSED'}).waitFor();await page.getByRole('button',{name:'Switch to Chinese'}).click();await page.getByRole('heading',{name:'已暂停'}).waitFor();await page.getByRole('button',{name:'继续',exact:true}).first().click();assert.equal(await page.locator('.flight-overlay').isVisible(),false);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.getByRole('heading',{name:'已暂停'}).waitFor();
  await page.getByRole('button',{name:'选择角色',exact:true}).click();await page.locator('[data-asset-choice="BTC"]').click();await page.setViewportSize({width:390,height:844});await overflow(page);await page.evaluate(()=>window.__advanceFrame());await page.screenshot({path:'.local/screenshots/flight-mobile-selection.png',fullPage:true});
  await page.getByRole('button',{name:'起飞',exact:true}).click();await page.locator('canvas').dispatchEvent('pointerdown',{button:0,isPrimary:true});await page.evaluate(()=>{for(let i=0;i<40;i++)window.__advanceFrame();});await overflow(page);assert.ok(await page.locator('.flight-lobby').isHidden());await page.screenshot({path:'.local/screenshots/flight-mobile-play.png',fullPage:true});
  await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('heading',{name:'已暂停'}).waitFor();
  await page.locator('.flight-top a').click();assert.equal(await page.locator('.flight').count(),0);assert.ok(!(await page.locator('body').getAttribute('class')).includes('flight-page'));await page.locator('.project-copy .button[href="/play/strata"]').click();await page.getByRole('heading',{name:'选择你的牌组'}).waitFor();
  await page.goto(base);await page.locator('.brand-coin').evaluate(img=>img.decode());await overflow(page);await page.screenshot({path:'.local/screenshots/flight-home-mobile.png',fullPage:true});
  // Separate touch context uses the normal browser frame clock.
  const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),mp=await mobile.newPage();await mp.goto(base+'/play/candle-flight');await mp.getByRole('button',{name:'Fly',exact:true}).tap();await mp.locator('canvas').tap();await mp.getByRole('button',{name:'Pause',exact:true}).tap();await mp.getByRole('heading',{name:'PAUSED'}).waitFor();await overflow(mp);await mobile.close();
  assert.deepEqual(errors,[]);console.log('Candle Flight browser checks passed: asset/month selection, full run and victory via actual keyboard input, crash/retry, records, bilingual pause/resume, mobile tap, layout, cleanup and Strata navigation.');
}finally{await browser.close();}

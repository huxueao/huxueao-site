import {t,getLanguage} from '../i18n.js';
import {ASSETS,MONTHS,WIDTH,HEIGHT,makeCourse,createFlight,flap,step,nextGate,validateMarketData} from './model.js';
import {makeRenderer} from './draw.js';
import {escapeHTML as esc} from '../format.js';

const KEY='janus-candle-flight-best-v1';
const monthName=m=>t(['January','February','March'][MONTHS.indexOf(m)],['1 月','2 月','3 月'][MONTHS.indexOf(m)]);
const portrait=s=>`<span class="pilot-window pilot-${s}" aria-hidden="true"><img src="/assets/flight-pilots.png" alt=""></span>`;
export function mountFlight(root){
  let data=null,selected='NVDA',month='2024-01',state=null,raf=0,previous=0,accumulator=0,closed=false,renderer=null,canvas=null,overlay=null,hud=null,readout=null,records={},lastScore=-1,lastPhase='',lastDate='',controller=new AbortController();
  try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))records=saved;}catch{}
  const best=()=>Math.max(0,Math.min(31,Number(records[selected+':'+month])||0));
  const asset=()=>data.assets.find(a=>a.symbol===selected);
  const name=()=>t(ASSETS[selected].name,ASSETS[selected].zh),pilot=()=>t(ASSETS[selected].pilot,ASSETS[selected].pilotZh);
  const active=()=>state&&['running','paused'].includes(state.phase);
  const record=()=>{const key=selected+':'+month;if(state.score>best()){records[key]=state.score;try{localStorage.setItem(KEY,JSON.stringify(records));}catch{}if(root.querySelector('[data-course-note]'))updateCourseNote();}};
  function frame(time){
    if(closed)return;const dt=previous?Math.min(.05,(time-previous)/1000):0;previous=time;
    if(state){
      if(state.phase==='running'){accumulator+=dt;while(accumulator>=1/120&&state.phase==='running'){step(state,1/120);accumulator-=1/120;}}
      else accumulator=0;
      if(state.score!==lastScore){if(state.score>lastScore&&lastScore>=0)renderer.burst(state.bird.x+10,state.bird.y,ASSETS[selected].color,14);record();lastScore=state.score;updateHUD();}
      if(state.phase!==lastPhase){if(state.phase==='crashed')renderer.burst(state.bird.x,state.bird.y,'#ff8795',26);lastPhase=state.phase;updateUI();}
      const g=nextGate(state);if(g?.date!==lastDate){lastDate=g?.date;updateReadout();}
      renderer.draw(state,selected,dt);
    }
    raf=requestAnimationFrame(frame);
  }
  function sourceText(){return `<p>${t('Daily historical candles from January–March 2024. One candle is one trading day (one calendar day for Bitcoin).','采用 2024 年 1—3 月的真实日 K 线。股票每根对应一个交易日，比特币每根对应一个自然日。')}</p><p>${t('The body is the passage: open to close. Prices are scaled to the screen; small bodies are widened so every gate is playable. Wicks are visual markers, not extra passages.','实体就是通道：从开盘价到收盘价。价格按屏幕缩放，小实体会放宽以保证可通过；影线只作标记，不是额外通道。')}</p><p>${t('Source','数据来源')}：<a href="${esc(asset().sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(asset().source)}</a> · ${t('USD · historical snapshot','美元 · 历史数据快照')}</p><p>${t('Original pixel caricatures. An independent fan-made game.','原创像素漫画形象，独立制作的小游戏。')}</p>`;}
  function shell(){
    root.innerHTML=`<section class="flight" data-asset="${selected}"><div class="flight-top"><a href="/projects" data-nav>${t('Projects','项目')}</a><span>${t('Real candles. One button.','真实 K 线，一键飞行。')}</span></div><div class="flight-layout"><div class="flight-lobby"><h1><span>CANDLE</span><span>FLIGHT</span></h1><p class="flight-lede">${t('Fly through the candle bodies.<br>How far can you go?','穿过 K 线实体。<br>你能飞过多少根？')}</p><span class="flight-label">${t('Choose your pilot','选择角色')}</span><div class="pilot-grid" role="group" aria-label="${t('Choose an asset','选择资产')}">${Object.entries(ASSETS).map(([s,a])=>`<button class="pilot-card" data-asset-choice="${s}" aria-pressed="${s===selected}">${portrait(s)}<span><strong>${s}</strong><small>${t(a.name,a.zh)}</small></span></button>`).join('')}</div><span class="flight-label">${t('Choose a month · 2024','选择月份 · 2024')}</span><div class="flight-months" role="group" aria-label="${t('Historical month','历史月份')}">${MONTHS.map(m=>`<button data-month="${m}" aria-pressed="${m===month}">${monthName(m)}</button>`).join('')}</div><p class="flight-note" data-course-note></p><details><summary>${t('How it works & data','玩法与数据')}</summary><div data-source>${sourceText()}</div></details></div><div><div class="flight-cabinet"><div class="flight-hud" data-hud></div><div class="flight-stage"><canvas tabindex="0" aria-label="${t('Candle Flight. Space or tap to flap. P to pause.','K 线飞行。空格或点击扑腾，P 键暂停。')}">${t('This game needs a browser with canvas support.','此游戏需要支持 Canvas 的浏览器。')}</canvas><div class="flight-overlay"></div></div><div class="flight-controls"><button class="flight-button" data-flap>${t('Flap','扑腾')}</button><button class="flight-button secondary" data-pause>${t('Pause','暂停')}</button></div><p class="flight-help">${t('Tap or Space: flap · P: pause','点击 / 空格：扑腾 · P：暂停')}</p></div><div class="flight-readout" data-readout></div><p class="sr-only" role="status" aria-live="polite" data-flight-status></p></div></div></section>`;
    canvas=root.querySelector('canvas');overlay=root.querySelector('.flight-overlay');hud=root.querySelector('[data-hud]');readout=root.querySelector('[data-readout]');renderer=makeRenderer(canvas);
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0||e.isPrimary===false)return;e.preventDefault();canvas.focus({preventScroll:true});doFlap();});
    updateUI();updateHUD();updateReadout();updateCourseNote();
  }
  function updateCourseNote(){root.querySelector('[data-course-note]').textContent=t(`${pilot()} · ${state.course.length} candles · Best ${best()}`,`${pilot()} · ${state.course.length} 根 K 线 · 最佳 ${best()}`);root.querySelector('[data-source]').innerHTML=sourceText();}
  function updateHUD(){if(!hud)return;hud.innerHTML=`<div><strong>${selected}</strong><span>${esc(pilot())} · ${monthName(month)} 2024</span></div><div class="flight-score"><b>${state.score}</b><small> / ${state.course.length}</small><span>${t('Best','最佳')} ${best()}</span></div>`;}
  function updateReadout(){if(!readout)return;const g=nextGate(state);if(!g)return;const price=n=>n.toLocaleString(getLanguage()==='zh'?'zh-CN':'en-US',{maximumFractionDigits:2,minimumFractionDigits:2});readout.innerHTML=`<strong>${g.date}</strong><span>${t('Open','开')} ${price(g.open)} · ${t('Close','收')} ${price(g.close)}</span>`;}
  function updateUI(){
    if(!overlay||!state)return;
    document.body.classList.toggle('flight-running',active()||state.phase==='crashed'||state.phase==='cleared');
    root.querySelector('[data-pause]').disabled=!active();root.querySelector('[data-pause]').textContent=state.phase==='paused'?t('Resume','继续'):t('Pause','暂停');
    root.querySelector('[data-flap]').disabled=['paused','crashed','cleared'].includes(state.phase);
    root.querySelectorAll('[data-asset-choice],[data-month]').forEach(b=>b.disabled=active());
    if(state.phase==='running'){overlay.hidden=true;return;}overlay.hidden=false;
    let title,body,actions;
    if(state.phase==='ready'){title=t('READY?','准备好了吗？');body=t(`Fly as ${pilot()}. Tap to rise, release to fall. Pass through the bright windows.`,`化身${pilot()}。点击上升，松手下落，穿过发亮的窗口。`);actions=`<button class="flight-button" data-start-flight>${t('Fly','起飞')}</button>`;}
    else if(state.phase==='paused'){title=t('PAUSED','已暂停');body=t('Your flight is waiting.','你的进度还在。');actions=`<button class="flight-button" data-resume>${t('Resume','继续')}</button><button class="flight-button secondary" data-hangar>${t('Choose pilot','选择角色')}</button>`;}
    else{const win=state.phase==='cleared';title=win?t('MONTH CLEARED!','飞完整个月！'):t('FLIGHT OVER','飞行结束');body=t(`${state.score} / ${state.course.length} candles. Best: ${best()}.`,`${state.score} / ${state.course.length} 根 K 线。最佳：${best()}。`);body+=`<br>${monthName(month)} 2024 · ${name()}`;actions=`<button class="flight-button" data-retry-flight>${t('Try again','再来一次')}</button><button class="flight-button secondary" data-hangar>${t('Choose pilot','选择角色')}</button>`;}
    overlay.innerHTML=`<div class="flight-overlay-box"><h2>${title}</h2><p>${body}</p><div class="flight-overlay-actions">${actions}</div></div>`;
    root.querySelector('[data-flight-status]').textContent=`${title}. ${state.score} / ${state.course.length}`;
    if(state.phase==='crashed'||state.phase==='cleared')overlay.querySelector('[data-retry-flight]')?.focus({preventScroll:true});
  }
  function reset(){state=createFlight(makeCourse(asset(),month));lastScore=-1;lastPhase='';lastDate='';accumulator=0;renderer?.clear();updateHUD();updateUI();updateReadout();updateCourseNote();}
  function start(){if(!state)return;if(state.phase!=='ready')reset();flap(state);updateUI();canvas.focus({preventScroll:true});if(innerWidth<681)root.querySelector('.flight-top').scrollIntoView({block:'start'});}
  function doFlap(){if(!state)return;if(state.phase==='ready'){start();return;}if(state.phase==='running'){flap(state);renderer.burst(state.bird.x-25,state.bird.y+10,ASSETS[selected].color,3);}}
  function pause(){if(state?.phase==='running'){state.phase='paused';updateUI();}else if(state?.phase==='paused'){state.phase='running';previous=0;updateUI();canvas.focus({preventScroll:true});}}
  function click(e){const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-retry-load')){load();return;}
    if(!state)return;
    if(b.dataset.assetChoice&&!active()){selected=b.dataset.assetChoice;reset();shell();return;}
    if(b.dataset.month&&!active()){month=b.dataset.month;reset();shell();return;}
    if(b.hasAttribute('data-start-flight')||b.hasAttribute('data-retry-flight')){start();return;}
    if(b.hasAttribute('data-flap')){doFlap();return;}
    if(b.hasAttribute('data-pause')||b.hasAttribute('data-resume')){pause();return;}
    if(b.hasAttribute('data-hangar')){reset();root.querySelector('[data-asset-choice]')?.focus({preventScroll:true});root.querySelector('.flight-lobby').scrollIntoView({block:'start'});}
  }
  function key(e){if(e.repeat||!state||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.target.closest('input,textarea,select,[contenteditable=true]'))return;
    if(e.code==='KeyP'||e.code==='Escape'){if(active()){e.preventDefault();pause();}return;}
    if(['Space','ArrowUp','KeyW'].includes(e.code)){
      if(e.target.closest('button,a,summary')&&!e.target.closest('[data-flap]'))return;
      e.preventDefault();doFlap();
    }
  }
  const hide=()=>{if(document.hidden&&state?.phase==='running'){state.phase='paused';updateUI();}};
  const blur=()=>{if(state?.phase==='running'){state.phase='paused';updateUI();}};
  const language=()=>{if(state){shell();previous=0;}};
  async function load(){
    root.innerHTML=`<p class="flight-load">${t('Loading the market…','正在载入行情……')}</p>`;
    try{const r=await fetch('/flight/market-data.json',{signal:controller.signal});if(!r.ok)throw Error('Could not load data');data=validateMarketData(await r.json());if(closed)return;state=createFlight(makeCourse(asset(),month));shell();previous=0;raf=requestAnimationFrame(frame);}
    catch(e){if(closed||e.name==='AbortError')return;root.innerHTML=`<div class="flight-load"><p>${t('Market data could not load.','暂时无法载入行情。')}</p><button class="flight-button" data-retry-load>${t('Try again','重试')}</button></div>`;}
  }
  root.addEventListener('click',click);document.addEventListener('keydown',key);document.addEventListener('visibilitychange',hide);window.addEventListener('blur',blur);window.addEventListener('janus:language',language);load();
  return()=>{closed=true;controller.abort();cancelAnimationFrame(raf);root.removeEventListener('click',click);document.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',hide);window.removeEventListener('blur',blur);window.removeEventListener('janus:language',language);document.body.classList.remove('flight-running');};
}

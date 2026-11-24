import {t,getLanguage} from '../i18n.js';
import {ASSETS,makeCourse,createFlight,flap,step,nextGate,validateMarketData,flightKey,saveFlight,restoreFlight} from './model.js';
import {makeRenderer} from './draw.js';
import {escapeHTML as esc} from '../format.js';
const BEST='janus-candle-flight-best-v4',RUN='janus-candle-flight-run-v4',LEGACY=['janus-candle-flight-run-v3','janus-candle-flight-run-v2'];
const portrait=s=>`<span class="pilot-window pilot-${s}" aria-hidden="true"><img src="/assets/flight-pilots.png" alt=""></span>`;
export function mountFlight(root){
  let data=null,selected='NVDA',state=null,raf=0,previous=0,accumulator=0,closed=false,renderer=null,canvas=null,overlay=null,hud=null,readout=null,records={},saved=null,saveError=false,lastScore=-1,lastPhase='',lastDate='',controller=null,loadId=0,pointer=null;
  const keys=new Set(),flightKeys=['Space','ArrowUp','KeyW'];
  const portraitPhone=matchMedia('(pointer:coarse) and (orientation:portrait) and (max-width:1024px)');
  try{const v=JSON.parse(localStorage.getItem(BEST)||'{}');if(v&&typeof v==='object'&&!Array.isArray(v))records=v;for(const key of [RUN,...LEGACY]){const s=JSON.parse(localStorage.getItem(key)||'null');if(restoreFlight(s)){saved=s;selected=s.data.asset.symbol;break;}}}catch{}
  const asset=()=>data.asset,pilot=()=>t(ASSETS[selected].pilot,ASSETS[selected].pilotZh);
  const best=()=>Math.max(0,Math.min(366,Number(records[flightKey(data)])||0));
  const active=()=>state&&['running','paused'].includes(state.phase);
  const hasSaved=()=>saved?.data?.asset?.symbol===selected&&!!restoreFlight(saved);
  function release(){keys.clear();pointer=null;}
  function saveRun(){if(!active())return;saved=saveFlight(state,data);try{localStorage.setItem(RUN,JSON.stringify(saved));for(const key of LEGACY)localStorage.removeItem(key);saveError=false;}catch{saveError=true;}updateSaveNote();}
  function clearRun(){saved=null;try{for(const key of [RUN,...LEGACY])localStorage.removeItem(key);}catch{}}
  function updateSaveNote(){const el=root.querySelector('[data-save-note]');if(el)el.textContent=saveError?t('Saving is unavailable. Keep this tab open.','无法保存，请保持这个页面打开。'):t('Progress saves in this browser.','进度保存在这个浏览器中。');}
  function record(){if(state.score>best()){records[flightKey(data)]=state.score;try{localStorage.setItem(BEST,JSON.stringify(records));}catch{}}if(active())saveRun();}
  function frame(time){
    if(closed)return;const dt=previous?Math.min(.05,(time-previous)/1000):0;previous=time;
    if(state){
      if(state.phase==='running'){accumulator+=dt;while(accumulator+1e-9>=1/120&&state.phase==='running'){step(state,1/120);accumulator-=1/120;}}else accumulator=0;
      if(state.score!==lastScore){if(state.score>lastScore&&lastScore>=0)renderer.burst(state.bird.x+5,state.bird.y,ASSETS[selected].color,10);record();lastScore=state.score;updateHUD();updateCourseNote();}
      if(state.phase!==lastPhase){if(state.phase==='crashed')renderer.burst(state.bird.x,state.bird.y,'#ff8795',20);if(['crashed','cleared'].includes(state.phase)){release();clearRun();}lastPhase=state.phase;updateUI();}
      const g=nextGate(state);if(g?.date!==lastDate){lastDate=g?.date;updateReadout();}renderer.draw(state,selected,dt);
    }
    raf=requestAnimationFrame(frame);
  }
  function sourceText(){return `<p>${t('Click the game, tap, or press Space to flap once. Press again to climb higher. Holding does not repeat. P pauses.','点击画面或按一下空格，向上跳一次。连续点击可以飞得更高，按住不会连跳。按 P 暂停。')}</p><p>${t('Pass through the coloured candle bodies, between open and close. Green is up; red is down. Wicks show the day’s high and low. The small white dot at your centre is your hitbox; the edges allow a little room.','从彩色的 K 线实体中穿过，即开盘价与收盘价之间。绿色表示上涨，红色表示下跌，影线标出当天最高与最低价。角色中心的小白点用于碰撞判定，边缘有少量容错。')}</p><p>${t('Prices keep one fixed scale. Real jumps stay visible as the camera moves up and down. Each course covers the past year ending today in Singapore time, using completed daily candles.','价格使用固定比例，镜头随高低移动，保留真实涨跌。每局包含按新加坡时间从今天往前推一年的已收盘日 K。')}</p><p>${t('Your course stays fixed after starting. Continue a saved flight to keep its original dates and data.','开局后数据保持不变。继续存档会沿用原来的日期和数据。')}</p><p>${t('Source','来源')}: <a href="${esc(asset().sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(asset().source)}</a> · USD<br>${t('Synced','同步于')} ${esc(data.fetchedAt.replace('T',' ').slice(0,16))} UTC</p>`;}
  function shell(){
    renderer?.destroy();
    root.innerHTML=`<section class="flight" data-asset="${selected}">
      <div class="flight-rotate" role="status"><span class="flight-rotate-icon" aria-hidden="true">↻</span><h1>${t('Turn your phone sideways','请将手机横过来')}</h1><p>${t('Candle Flight needs a wide screen. Rotate your phone to play.','Candle Flight 需要宽屏画面，请横屏游玩。')}</p><p class="flight-rotate-saved">${t('If you were flying, your game is paused.','如果正在飞行，游戏会暂停并保存进度。')}</p><a href="/projects" data-nav>${t('Back to projects','返回项目')}</a></div>
      <div class="flight-layout"><div class="flight-lobby"><div class="flight-intro"><h1>CANDLE FLIGHT</h1><p class="flight-lede">${t('One year of real prices. One flight.','飞过一年的真实行情。')}</p></div><div class="pilot-grid" role="group" aria-label="${t('Choose an asset','选择资产')}">${Object.entries(ASSETS).map(([s,a])=>`<button class="pilot-card" data-asset-choice="${s}" aria-pressed="${s===selected}" aria-label="${esc(t(a.name,a.zh))}">${portrait(s)}<span><strong>${s}</strong><small>${t(a.name,a.zh)}</small></span></button>`).join('')}</div></div>
      <div class="flight-play-area"><div class="flight-cabinet"><div class="flight-hud" data-hud></div><div class="flight-stage"><canvas tabindex="0" aria-label="${t('Candle Flight. Click or press Space to flap. P to pause.','K 线飞行。点击或按空格跳跃，按 P 暂停。')}"></canvas><div class="flight-overlay"></div></div><div class="flight-controls"><p>${t('Click or Space to flap','点击或空格跳跃')}<span>${t('P to pause','P 暂停')}</span></p><button class="flight-button" data-flap>${t('Flap','跳跃')}</button><button class="flight-button secondary" data-pause>${t('Pause','暂停')}</button></div></div><div class="flight-readout" data-readout></div><p class="sr-only" role="status" aria-live="polite" data-flight-status></p></div>
      <div class="flight-info"><div class="flight-period"><strong>${data.windowStart} — ${data.windowEnd}</strong><p>${t('Latest candle','最新 K 线')}: ${data.asOf}<span class="flight-note" data-course-note></span></p><p class="flight-save-note" data-save-note></p></div><details><summary>${t('How to play & data','玩法与数据')}</summary><div>${sourceText()}</div></details>${data.isFallback?`<p class="flight-data-notice" role="status">${t(`Updates are delayed. Last sync: ${data.fetchedAt.slice(0,10)}.`,`更新暂时延迟，上次同步：${data.fetchedAt.slice(0,10)}。`)} <button class="text-button" data-refresh>${t('Try update','重新获取')}</button></p>`:''}</div></div></section>`;
    canvas=root.querySelector('canvas');overlay=root.querySelector('.flight-overlay');hud=root.querySelector('[data-hud]');readout=root.querySelector('[data-readout]');renderer=makeRenderer(canvas);
    updateUI();updateHUD();updateReadout();updateCourseNote();updateSaveNote();orientation();
  }
  function updateCourseNote(){const el=root.querySelector('[data-course-note]');if(el&&state)el.textContent=t(` · ${state.course.length} daily candles`,` · ${state.course.length} 根日 K`);}
  function updateHUD(){if(hud)hud.innerHTML=`<div class="flight-hud-pilot"><strong>${selected}</strong><span>${esc(pilot())}</span></div><div class="flight-score"><b>${state.score}</b><small> / ${state.course.length}</small><span>${t('Best','最高')} ${best()}</span></div>`;}
  function updateReadout(){if(!readout)return;const g=nextGate(state);if(!g)return;const p=n=>n.toLocaleString(getLanguage()==='zh'?'zh-CN':'en-US',{maximumFractionDigits:2,minimumFractionDigits:2});readout.innerHTML=`<strong>${g.date}</strong><span>${t('Open','开')} ${p(g.open)} · ${t('Close','收')} ${p(g.close)} <small>USD</small></span>`;}
  function updateUI(){
    if(!overlay||!state)return;document.body.classList.toggle('flight-running',active()||['crashed','cleared'].includes(state.phase));
    root.querySelector('[data-pause]').disabled=!active();root.querySelector('[data-pause]').textContent=state.phase==='paused'?t('Resume','继续'):t('Pause','暂停');root.querySelector('[data-flap]').disabled=['paused','crashed','cleared'].includes(state.phase);root.querySelectorAll('[data-asset-choice],[data-refresh]').forEach(b=>b.disabled=active());
    if(state.phase==='running'){overlay.hidden=true;return;}overlay.hidden=false;let title,body,actions;
    if(state.phase==='ready'){
      title=t('READY?','准备好了吗？');body=t('Click or press Space to flap.<br>Fly through the coloured bodies.','点击或按空格跳跃。<br>从彩色 K 线实体中穿过。');
      const resume=hasSaved();actions=`${resume?`<button class="flight-button" data-continue-flight>${t('Continue flight','继续上次飞行')}</button>`:''}<button class="flight-button ${resume?'secondary':''}" data-start-flight>${data.isFallback?t('Play saved data','使用现有数据'):resume?t('New flight','新一局'):t('Fly','起飞')}</button>`;
      if(resume)body+=`<br><small>${t('Saved','已保存')}: ${saved.state.score} / ${saved.data.asset.candles.length} · ${saved.data.windowEnd}</small>`;
    }else if(state.phase==='paused'){title=t('PAUSED','已暂停');body=saveError?t('Keep this tab open; saving is unavailable.','暂时无法保存，请保持页面打开。'):t('Your flight is saved.','飞行进度已保存。');actions=`<button class="flight-button" data-resume>${t('Resume','继续')}</button><button class="flight-button secondary" data-hangar>${t('Choose pilot','选择角色')}</button>`;}
    else{title=state.phase==='cleared'?t('YEAR CLEARED!','全年通关！'):t('FLIGHT OVER','飞行结束');body=t(`${state.score} / ${state.course.length} candles. Best: ${best()}.`,`${state.score} / ${state.course.length} 根 K 线。最高：${best()}。`)+`<br>${data.windowStart} — ${data.windowEnd}`;actions=`<button class="flight-button" data-retry-flight>${t('Try again','再来一次')}</button><button class="flight-button secondary" data-hangar>${t('Choose pilot','选择角色')}</button>`;}
    overlay.innerHTML=`<div class="flight-overlay-box"><h2>${title}</h2><p>${body}</p><div class="flight-overlay-actions">${actions}</div></div>`;root.querySelector('[data-flight-status]').textContent=`${title}. ${state.score} / ${state.course.length}`;
    if(['crashed','cleared'].includes(state.phase))overlay.querySelector('[data-retry-flight]')?.focus({preventScroll:true});
  }
  function reset(){release();state=createFlight(makeCourse(asset()));lastScore=-1;lastPhase='';lastDate='';accumulator=0;renderer?.clear();updateHUD();updateUI();updateReadout();updateCourseNote();}
  function focusGame(){canvas.focus({preventScroll:true});if(matchMedia('(pointer:coarse) and (orientation:landscape)').matches)root.querySelector('.flight-cabinet').scrollIntoView({block:'start'});}
  function start(){if(!state||portraitPhone.matches)return;const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(!data.isFallback&&data.windowEnd!==today){load(selected,true);return;}if(state.phase!=='ready')reset();clearRun();flap(state);previous=0;saveRun();updateUI();focusGame();}
  function continueFlight(){if(portraitPhone.matches)return;const restored=restoreFlight(saved);if(!restored)return;release();cancelAnimationFrame(raf);data=restored.data;selected=data.asset.symbol;state=restored.state;lastScore=state.score;lastDate='';lastPhase='';previous=0;accumulator=0;shell();state.phase='running';saveRun();updateUI();focusGame();raf=requestAnimationFrame(frame);}
  function pause(){release();if(state?.phase==='running'){state.phase='paused';saveRun();updateUI();}else if(state?.phase==='paused'&&!portraitPhone.matches){state.phase='running';previous=0;updateUI();focusGame();}}
  function tap(){if(!state||portraitPhone.matches)return;if(state.phase==='ready')start();else if(state.phase==='running'){flap(state);focusGame();}}
  function click(e){const b=e.target.closest('button');if(!b||b.disabled)return;if(b.hasAttribute('data-retry-load')){load(selected);return;}if(b.hasAttribute('data-continue-flight')){continueFlight();return;}if(!state)return;
    if(b.dataset.assetChoice&&!active()){load(b.dataset.assetChoice);return;}if(b.hasAttribute('data-refresh')&&!active()){load(selected);return;}
    if(b.hasAttribute('data-start-flight')||b.hasAttribute('data-retry-flight')){start();return;}
    if(b.hasAttribute('data-flap')){if(e.detail===0)tap();return;}
    if(b.hasAttribute('data-pause')||b.hasAttribute('data-resume')){pause();return;}if(b.hasAttribute('data-hangar')){release();saveRun();load(selected);}
  }
  function pointerDown(e){if(e.button!==0||e.isPrimary===false||pointer!==null||!e.target.closest('canvas,[data-flap]')||!state||portraitPhone.matches)return;if(!['ready','running'].includes(state.phase))return;e.preventDefault();tap();if(state?.phase!=='running')return;pointer=e.pointerId??0;try{root.setPointerCapture(e.pointerId);}catch{}}
  function pointerUp(e){if(pointer!==null&&(e.pointerId===pointer||e.pointerId===undefined))pointer=null;}
  function key(e){if(!state||portraitPhone.matches||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable=true]'))return;if(e.code==='KeyP'||e.code==='Escape'){if(!e.repeat&&active()){e.preventDefault();pause();}return;}if(!flightKeys.includes(e.code)||e.target.closest('button,a,summary')&&!e.target.closest('[data-flap]'))return;e.preventDefault();if(e.repeat||keys.has(e.code))return;keys.add(e.code);tap();}
  function keyUp(e){if(keys.delete(e.code))e.preventDefault();}
  function suspend(){release();if(state?.phase==='running'){state.phase='paused';saveRun();updateUI();}}
  function orientation(){root.classList.toggle('flight-portrait',portraitPhone.matches);if(portraitPhone.matches)suspend();}
  const hide=()=>{if(document.hidden)suspend();},pagehide=()=>{release();saveRun();},language=()=>{release();if(state){shell();previous=0;}},contextMenu=e=>{if(e.target.closest('canvas,[data-flap]'))e.preventDefault();};
  async function load(symbol,autoStart=false){
    release();renderer?.destroy();const id=++loadId;controller?.abort();controller=new AbortController();cancelAnimationFrame(raf);state=null;selected=symbol;overlay=hud=readout=null;document.body.classList.remove('flight-running');root.innerHTML=`<div class="flight-load"><p>${t(`Loading the latest year for ${symbol}.`,`正在载入 ${symbol} 最近一年的行情。`)}</p><a href="/projects" data-nav>${t('Projects','项目')}</a></div>`;
    try{const r=await fetch('/api/flight/market?symbol='+encodeURIComponent(symbol),{signal:controller.signal,cache:'no-cache'});if(!r.ok)throw Error('Market data unavailable');const result=validateMarketData(await r.json());if(result.asset.symbol!==symbol)throw Error('Wrong asset');if(closed||id!==loadId)return;data=result;state=createFlight(makeCourse(asset()));lastScore=-1;lastPhase='';lastDate='';previous=0;accumulator=0;shell();raf=requestAnimationFrame(frame);if(autoStart)start();}
    catch(e){if(closed||e.name==='AbortError'||id!==loadId)return;root.innerHTML=`<div class="flight-load"><p>${t('The latest market data could not load.','暂时无法载入最新行情。')}</p><button class="flight-button" data-retry-load>${t('Try again','重试')}</button>${hasSaved()?`<button class="flight-button secondary" data-continue-flight>${t('Continue saved flight','继续已保存的飞行')}</button>`:''}</div>`;}
  }
  const listeners=[[root,'click',click],[root,'pointerdown',pointerDown],[root,'contextmenu',contextMenu],[root,'lostpointercapture',pointerUp],[window,'pointerup',pointerUp],[window,'pointercancel',pointerUp],[document,'keydown',key],[document,'keyup',keyUp],[document,'visibilitychange',hide],[window,'blur',suspend],[window,'pagehide',pagehide],[window,'janus:language',language],[portraitPhone,'change',orientation]];
  for(const [target,event,fn] of listeners)target.addEventListener(event,fn);load(selected);
  return()=>{release();saveRun();closed=true;controller?.abort();cancelAnimationFrame(raf);renderer?.destroy();for(const [target,event,fn] of listeners)target.removeEventListener(event,fn);root.classList.remove('flight-portrait');document.body.classList.remove('flight-running');};
}

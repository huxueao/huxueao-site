import { FACTIONS, CARDS, MINERALS, MINE_RECIPES, strategyDeck } from './cards.js';
import { createGame, mulligan, legalActions, act, score, observation, VERSION } from './engine.js';
import { chooseAction } from './ai.js';
import { escapeHTML as esc } from '../format.js';
import { t } from '../i18n.js';
import { card, mineral, faction as factionInfo, category, categoryName, kindName, logText } from './catalog.js';
import { icon } from './icons.js';
import { rules } from './rules.js';
import { createTutorialState } from './tutorial.js';
import { createEffects } from './effects.js';

const SAVE='janus-strata-v1', LEGACY_SAVE='oblique-strata-v1';
function loadSave() {
  try {
    const s=JSON.parse(localStorage.getItem(SAVE)||localStorage.getItem(LEGACY_SAVE)||'null');
    if(!s||s.version!==VERSION||!['playing','mulligan','over'].includes(s.stage)||s.players?.length!==2||!Array.isArray(s.log)||s.log.some(x=>typeof x!=='string')||!Number.isInteger(s.seed))return null;
    for(const p of s.players){
      if(!FACTIONS[p.faction]||!Number.isFinite(p.hp)||!Number.isFinite(p.energy)||p.units.length>4||p.hand.length>100)return null;
      for(const c of [...p.hand,...p.deck,...p.units,...p.discard])if(!CARDS[c.card])return null;
      for(const c of p.cargo)if(!MINERALS[c.card])return null;
    }
    if(s.mine.length>30||s.field.length>3)return null;
    for(const c of [...s.mine,...s.field])if(!MINERALS[c.card])return null;
    return s;
  }catch{return null;}
}
const playerName=i=>i===0?t('You','你'):t('AI','电脑');
function actionLabel(a,s) {
  const p=s.players[s.active],other=s.players[1-s.active],find=s.field.find(c=>c.id===a.target)||p.cargo.find(c=>c.id===a.target),unit=other.units.find(u=>u.id===a.target);
  const name=find?mineral(find.card).name:unit?card(unit.card).name:t('AI camp','电脑营地');
  if(a.type==='play'){const d=card(p.hand.find(c=>c.id===a.card).card);return t(`Play ${d.name}${a.target?' on '+name:''} · ${d.cost} energy`,`打出${d.name}${a.target?'：'+name:''} · ${d.cost} 能量`);}
  if(a.type==='pick')return t(`Pickaxe · free`,`使用镐 · 免费`);
  if(a.type==='dig')return t(`Dig ${name} · 1 energy`,`挖掘${name} · 1 能量`);
  if(a.type==='assist')return t(`Help dig ${name}`,`协助挖掘${name}`);
  if(a.type==='attack')return t(`Attack ${name}`,`攻击${name}`);
  if(a.type==='sell'){const n=MINERALS[find.card].sell+(p.faction==='gold'?1:0);return t(`Sell ${name} · +${n} energy`,`出售${name} · +${n} 能量`);}
  return a.type;
}

export function mountGame(root) {
  let state=loadSave(),screen=state?'game':'setup',faction='gold',opponent='fossil',selected=null,replacements=new Set(),timer=null,closed=false,actions=[],saveError=false,flash='',dialogMode=null;
  let tutorial=false,step=0,resumeState=null;
  const effects=createEffects(),dialog=document.createElement('dialog');dialog.className='game-dialog';document.body.append(dialog);
  function save(){if(tutorial)return;try{localStorage.setItem(SAVE,JSON.stringify(state));localStorage.removeItem(LEGACY_SAVE);saveError=false;}catch{saveError=true;}}
  function clearSave(){try{localStorage.removeItem(SAVE);localStorage.removeItem(LEGACY_SAVE);}catch{}}
  function button(a,label,className=''){const index=actions.push(a)-1;return `<button type="button" class="button small ${className}" data-action="${index}" data-action-type="${a.type}">${esc(label||actionLabel(a,state))}</button>`;}
  const header=()=>`<header class="game-heading"><a href="/projects" data-nav>${t('Projects','项目')}</a><div><button class="text-button" data-tutorial>${t('Tutorial','新手教程')}</button><button class="text-button" data-rules>${t('Rules','规则')}</button>${state&&!tutorial?`<button class="text-button" data-new>${t('New game','新对局')}</button>`:''}</div></header>`;
  function setup(){return `${header()}<section class="game-intro"><div><span class="eyebrow">${t('A digging card game','挖掘卡牌游戏')}</span><h1>Strata</h1><p>${t('One mine. Two players.<br>Dig, collect, and fight.','一个矿堆，两支队伍。<br>挖掘、收集，也可以战斗。')}</p><button class="button tutorial-start" data-tutorial>${t('Learn to play','跟着教程试玩')}</button></div><div class="strata-art" aria-hidden="true"><span class="ore">${icon('ore')}</span><span class="gem">${icon('gem')}</span><span class="fossil">${icon('fossil')}</span></div></section><section class="expedition-setup"><div class="setup-title"><h2>${t('Choose your deck','选择你的牌组')}</h2><p>${t('Defeat the AI camp, or finish with more points.','击败电脑的营地，或在矿堆挖完时取得更高分。')}</p></div><div class="faction-grid">${Object.keys(FACTIONS).map(id=>{const f=factionInfo(id);return `<button class="faction-card ${id} ${id===faction?'chosen':''}" data-faction="${id}" aria-pressed="${id===faction}">${icon(id)}<h3>${f.name}</h3><p>${f.description}</p><span class="faction-passive">${f.passive}</span><span class="faction-select">${id===faction?t('Selected','已选择'):t('Choose this deck','选择此牌组')}</span></button>`;}).join('')}</div><div class="setup-actions"><label for="opponent">${t('AI deck','电脑牌组')}<select id="opponent">${Object.keys(FACTIONS).map(id=>`<option value="${id}" ${id===opponent?'selected':''}>${factionInfo(id).name}</option>`).join('')}</select></label><button class="button" data-deck>${t('View cards','查看卡牌')}</button><button class="button primary" data-start>${t('Start game','开始对局')}</button></div><p class="setup-footnote">${t('No account needed. Your game saves in this browser.','无需登录，对局会自动保存在当前浏览器中。')}</p></section>`;}
  function handCard(c,i,mulliganMode=false){
    const d=card(c.card),cat=category(c.card),can=state.active===0&&!state.pending&&state.phase==='action'&&legalActions(state,0).some(a=>a.type==='play'&&a.card===c.id),chosen=mulliganMode?replacements.has(i):selected?.kind==='hand'&&selected.id===c.id;
    return `<button class="hand-card cat-${cat} ${chosen?'selected':''} ${!can&&!mulliganMode?'unavailable':''}" data-${mulliganMode?'replace':'hand'}="${mulliganMode?i:c.id}" data-card-id="${c.card}" aria-pressed="${chosen}"><div class="hand-card-top"><span class="card-cost" aria-label="${t('Energy cost','能量费用')} ${d.cost}">${d.cost}</span><span class="category-label">${categoryName(cat)}</span>${d.type==='crew'?`<span class="card-stats" aria-label="${t('Attack / health','攻击 / 生命')}">${d.attack}/${d.health}</span>`:''}</div><div class="card-art">${icon(cat==='crew'?'crew':cat==='dig'?'pick':cat==='attack'?'spark':cat==='support'?'heart':c.card==='revive'?'skull':'gem')}</div><h3>${esc(d.name)}</h3><p>${esc(d.text)}</p>${mulliganMode?`<span class="card-bottom">${chosen?t('Replace','替换'):t('Keep','保留')}</span>`:''}</button>`;
  }
  function mulliganScreen(){return `${header()}<section class="opening-hand"><span class="eyebrow">${factionInfo(state.players[0].faction).name}</span><h1>${t('Your starting hand','起始手牌')}</h1><p>${t('Choose any cards to replace. You can do this once.','点击想替换的卡牌，每局可以换牌一次。')}</p><div class="hand mulligan-hand">${state.players[0].hand.map((c,i)=>handCard(c,i,true)).join('')}</div><div class="setup-actions"><p>${replacements.size?t(`${replacements.size} cards selected.`,`已选择 ${replacements.size} 张。`):t('Keep all 5 cards.','保留全部 5 张手牌。')}</p><button class="button primary" data-keep>${replacements.size?t('Replace and start','换牌并开始'):t('Keep and start','保留并开始')}</button></div></section>`;}
  function playerBar(index){const p=state.players[index];return `<div class="player-bar ${index===0?'your-bar':'opponent-bar'}" data-player="${index}"><div class="player-identity">${icon(p.faction)}<div><h2>${playerName(index)}</h2><span>${factionInfo(p.faction).name}</span></div></div><dl class="player-stats"><div><dt>${t('Health','生命')}</dt><dd class="${p.hp<=6?'low-health':''}">${Math.max(0,p.hp)}<small>/20</small></dd></div><div><dt>${t('Points','分数')}</dt><dd>${score(p)}</dd></div><div><dt>${index===0?t('Energy','能量'):t('Hand','手牌')}</dt><dd>${index===0?p.energy:p.hand.length}</dd></div></dl></div>`;}
  function crew(index){const p=state.players[index],blocking=state.pending?.type==='block'&&state.active===1;return `<div class="crew-line"><span class="zone-label">${index===0?t('Your crew','你的队员'):t('AI crew','电脑队员')} <small>${p.units.length}/4</small></span><div class="crew-slots">${p.units.map(u=>{const d=card(u.card);return `<button class="crew-card ${u.exhausted?'exhausted':''} ${selected?.id===u.id?'selected':''}" data-unit="${u.id}" data-owner="${index}"><span><strong>${esc(d.name)}</strong><small>${u.exhausted?t('Used','已行动'):u.sick?t('Ready next turn','下回合可行动'):t('Ready','可行动')}</small></span><b aria-label="${t('Attack / health','攻击 / 生命')}">${d.attack}/${u.hp}</b>${blocking&&index===0&&!u.exhausted?`<span class="block-badge">${t('Can block','可格挡')}</span>`:''}</button>`;}).join('')}${Array.from({length:4-p.units.length},()=>'<div class="empty-crew" aria-hidden="true">+</div>').join('')}</div></div>`;}
  function field(){const event=state.lastReveal&&mineral(state.lastReveal.card);return `<section class="mine-zone" aria-labelledby="mine-title"><div class="seam-title"><h2 id="mine-title">${t('Shared mine','公共矿堆')}</h2><span>${t(`${state.mine.length} cards left`, `剩余 ${state.mine.length} 张`)}</span></div>${event?.kind==='event'?`<div class="mine-event" role="status"><b>${event.name}</b><span>${event.text}</span></div>`:''}<div class="deposits">${state.field.map(c=>{const d=mineral(c.card);return `<button class="deposit ${d.kind} ${selected?.id===c.id?'selected':''}" data-field="${c.id}"><span class="deposit-top"><span>${kindName(d.kind)}</span><b>${d.value} ${t('pts','分')}</b></span>${icon(c.card==='skull'?'skull':d.kind)}<h3>${d.name}</h3><div class="progress-pips" aria-label="${t('Dig progress','挖掘进度')} ${c.progress}/${d.hardness}">${Array.from({length:d.hardness},(_,i)=>`<span class="${i<c.progress?'filled':''}"></span>`).join('')}</div><span class="deposit-bottom">${t(`${d.hardness-c.progress} more to collect`,`还需 ${d.hardness-c.progress} 点进度`)}</span></button>`;}).join('')}${Array.from({length:3-state.field.length},()=>`<div class="empty-deposit"><span>+</span><small>${t('Empty space','空位')}</small></div>`).join('')}</div><p class="mine-note">${t('The player who finishes digging takes the deposit.','谁完成最后一次挖掘，矿藏就归谁。')}</p></section>`;}
  function cargo(index){const p=state.players[index];return `<details class="cargo-panel" ${index===0?'open':''}><summary>${index===0?t('Your collection','你的收藏'):t('AI collection','电脑收藏')} <span>${t(`${p.cargo.length} finds · ${p.exhibits} exhibits`,`${p.cargo.length} 件矿藏 · ${p.exhibits} 件展品`)}</span></summary><div class="cargo-items">${p.cargo.map(c=>`<button class="cargo-item ${MINERALS[c.card].kind} ${selected?.id===c.id?'selected':''}" data-cargo="${c.id}" data-owner="${index}">${mineral(c.card).name}<b>${MINERALS[c.card].value+(c.bonus||0)} ${t('pts','分')}</b></button>`).join('')}${p.exhibits?`<span class="exhibit-item">${t(`${p.exhibits} skeletons · ${p.exhibits*12} pts`,`${p.exhibits} 具骨架 · ${p.exhibits*12} 分`)}</span>`:''}${!p.cargo.length&&!p.exhibits?`<span class="cargo-empty">${t('No finds yet.','还没有收藏。')}</span>`:''}</div></details>`;}
  function controls(){
    const human=state.active===0&&!state.pending,legal=legalActions(state,0),p=state.players[0];let prompt='',choices='';
    if(state.pending?.type==='block'&&state.active===1){const u=state.players[1].units.find(u=>u.id===state.pending.attacker),d=card(u.card);prompt=t(`${d.name} attacks your camp for ${d.attack}. Block or take the hit.`,`${d.name}攻击你的营地，造成 ${d.attack} 点伤害。选择格挡或承受伤害。`);choices=legal.map(a=>button(a,a.unit?t(`Block with ${card(p.units.find(u=>u.id===a.unit).card).name}`,`用${card(p.units.find(u=>u.id===a.unit).card).name}格挡`):t('Take the hit','承受伤害'))).join('');}
    else if(state.pending?.type==='survey'&&state.active===0){prompt=t('Choose the next mine card. Only you can see these cards.','选择下一张矿牌，只有你能看到这些牌。');choices=legal.map(a=>button(a,mineral(state.mine.find(c=>c.id===a.target).card).name)).join('');}
    else if(state.pending?.type==='discard'&&state.active===0){prompt=t(`Discard ${p.hand.length-8} cards to end your turn.`,`弃掉 ${p.hand.length-8} 张牌后结束回合。`);choices=legal.map(a=>button(a,t(`Discard ${card(p.hand.find(c=>c.id===a.card).card).name}`,`弃掉${card(p.hand.find(c=>c.id===a.card).card).name}`))).join('');}
    else if(!human)prompt=t('The AI is taking its turn…','电脑正在行动…');
    else if(selected){let available=[];
      if(selected.kind==='hand'){const c=p.hand.find(c=>c.id===selected.id);if(c){const d=card(c.card);prompt=`${d.name} — ${d.text}`;available=legal.filter(a=>a.type==='play'&&a.card===c.id);if(!available.length)prompt+=' '+(state.phase==='combat'?t('You cannot play cards during combat.','战斗阶段无法出牌。'):p.energy<d.cost?t('Not enough energy.','能量不足。'):t('No valid target or required materials.','没有可用目标或缺少所需材料。'));}}
      if(selected.kind==='field'){const c=state.field.find(c=>c.id===selected.id);if(c){prompt=t(`${mineral(c.card).name}: ${MINERALS[c.card].hardness-c.progress} more progress to collect.`,`${mineral(c.card).name}：再挖 ${MINERALS[c.card].hardness-c.progress} 点进度即可收集。`);available=legal.filter(a=>['pick','dig'].includes(a.type)&&a.target===c.id);}}
      if(selected.kind==='unit'){const u=p.units.find(u=>u.id===selected.id);if(u){prompt=card(u.card).name+' — '+(u.exhausted?t('Already used this turn.','本回合已行动。'):u.sick?t('Can block now; can act next turn.','现在可以格挡，下回合可以行动。'):state.phase==='action'?t('Help dig, or start combat to attack.','可以协助挖掘，或进入战斗后攻击。'):t('Choose an attack target.','选择攻击目标。'));available=legal.filter(a=>a.unit===u.id);}}
      if(selected.kind==='cargo'){const c=p.cargo.find(c=>c.id===selected.id);if(c){prompt=t(`${mineral(c.card).name}: ${MINERALS[c.card].value+(c.bonus||0)} points. Selling gives up these points.`,`${mineral(c.card).name}价值 ${MINERALS[c.card].value+(c.bonus||0)} 分，出售后失去这些分数。`);available=legal.filter(a=>a.type==='sell'&&a.target===c.id);}}
      choices=available.map(a=>button(a)).join('');
    }else prompt=state.phase==='combat'?t('Choose a ready crew member to attack, or end your turn.','选择一名可行动的队员攻击，或结束回合。'):t('Choose a deposit to dig, a card to play, or a crew member to help.','选择矿藏进行挖掘，或选择手牌、队员行动。');
    const toolbar=human?legal.filter(a=>['upgrade','explore','supply','combat','end'].includes(a.type)).map(a=>button(a,a.type==='upgrade'?t(`Upgrade pick to ${p.pick+1} · 3 energy`,`升级镐至 ${p.pick+1} 级 · 3 能量`):a.type==='explore'?t('Reveal another · 2 energy','再翻一张 · 2 能量'):a.type==='supply'?t('Use supply · +1 energy','使用补给 · +1 能量'):a.type==='combat'?t('Start combat','进入战斗'):t('End turn','结束回合'),a.type==='end'?'primary end-turn':'')).join(''):'';
    return `<div class="turn-status ${human?'human-turn':''}"><strong>${state.pending?.type==='block'&&state.active===1?t('Defend your camp','保卫营地'):human?t('Your turn','你的回合'):t('AI turn','电脑回合')}</strong><span>${state.finalRound!==null?t('Final round','最后一轮'):t(`Round ${state.round}`,`第 ${state.round} 轮`)} · ${state.phase==='combat'?t('Combat','战斗'):t('Dig and play','挖掘与出牌')}</span></div><section class="control-panel" aria-label="${t('Available actions','可用行动')}"><p id="action-prompt" role="status">${esc(prompt)}</p>${choices?`<div class="action-choices">${choices}</div>`:''}<div class="turn-tools">${toolbar}</div><div class="turn-info">${t(`Pickaxe level ${p.pick} · ${p.pickUsed?'used':'ready'} · ${p.deck.length} cards in deck`,`镐等级 ${p.pick} · ${p.pickUsed?'本回合已使用':'可使用'} · 牌库剩余 ${p.deck.length} 张`)}</div></section>`;
  }
  function result(){const won=state.winner===0;return `<section class="game-result"><h1>${state.winner==='draw'?t('Draw','平局'):won?t('You win!','你赢了！'):t('AI wins','电脑获胜')}</h1><p>${state.reason==='mine'?t('The mine is empty. Higher points win; health breaks a tie.','矿堆已空，分数更高者获胜；同分则比较生命。'):t('A camp reached zero health.','一方营地的生命降到了零。')}</p><div class="result-scores">${state.players.map((p,i)=>`<div><span>${playerName(i)}</span><strong>${score(p)}</strong><small>${t(`points · ${Math.max(0,p.hp)} health`,`分 · ${Math.max(0,p.hp)} 生命`)}</small></div>`).join('')}</div><button class="button primary" data-new>${t('Play again','再来一局')}</button></section>`;}
  function board(){return `${header()}${tutorial?tutorialPanel():''}${state.stage==='over'?result():''}${saveError?`<p class="notice">${t('Saving is unavailable. Keep this tab open to continue.','暂时无法保存，请保持此页面打开以继续对局。')}</p>`:''}${flash?`<p class="notice" role="alert">${esc(flash)}</p>`:''}<div class="board">${playerBar(1)}${crew(1)}${field()}${crew(0)}${playerBar(0)}${state.stage==='playing'?controls():''}<section class="hand-zone"><div class="hand-heading"><h2>${t('Your hand','你的手牌')} <span>${state.players[0].hand.length}</span></h2><button class="text-button" data-deck>${t('View deck','查看牌组')}</button></div><div class="card-legend">${['crew','dig','attack','support','special'].map(c=>`<span class="cat-${c}">${categoryName(c)}</span>`).join('')}</div><div class="hand">${state.players[0].hand.map((c,i)=>handCard(c,i)).join('')}${!state.players[0].hand.length?`<p class="empty-hand">${t('No cards. You can still use your pickaxe.','没有手牌了，你仍然可以使用镐。')}</p>`:''}</div></section><div class="collections">${cargo(0)}${cargo(1)}</div><details class="game-log"><summary>${t('Game log','对战记录')}</summary><ol>${state.log.slice(-25).reverse().map(x=>`<li>${esc(logText(x))}</li>`).join('')}</ol></details></div>`;}

  function tutorialPanel(){
    const steps=[
      [t('Two ways to win','两种获胜方式'),t('Reduce the other camp from 20 health to 0, or have more points when the 30-card mine runs out. This practice game will not change your saved match.','将对方营地从 20 点生命打到 0，或在 30 张矿牌翻完时取得更高分。这局练习不会改动你的正式存档。')],
      [t('Choose a deposit','选择矿藏'),t('Both players share this mine. Click Copper in the middle of the board.','双方共用这个矿堆，点击棋盘中央的铜矿。')],
      [t('Use your free pickaxe','使用免费镐'),t('Click Pickaxe. It adds 1 progress for free, once each turn. Copper needs only 1, so you will collect it and score 1 point.','点击“使用镐”。每回合可免费使用一次，初始增加 1 点进度。铜矿只需 1 点，你会收集它并得到 1 分。')],
      [t('Choose a crew card','选择队员牌'),t('Your find is now in your collection. Next, click Worker in your hand. The number at its top left is its energy cost.','矿藏已进入你的收藏。接着点击手牌中的矿工，左上角数字是出牌需要的能量。')],
      [t('Play the Worker','打出矿工'),t('Click Play Worker. It costs your 2 energy. Its 1/3 means 1 attack and 3 health. New crew can block, but must wait a turn to dig or attack.','点击“打出矿工”，消耗 2 点能量。1/3 代表 1 点攻击、3 点生命。新队员可以格挡，但要等下回合才能挖掘或攻击。')],
      [t('End your turn','结束回合'),t('Click End turn. Energy refills each turn: 2, then 3, 4, 5, and up to 6. A mine card is revealed automatically. The practice AI will pass.','点击“结束回合”。每回合能量重新补充：从 2 开始，逐回合增加到 6。回合开始时自动翻开一张矿牌，练习电脑将直接结束行动。')],
      [t('Start combat','进入战斗'),t('Your Worker is ready. Click Start combat. After entering combat, you cannot dig or play cards until your next turn.','你的矿工已经可以行动。点击“进入战斗”，进入后本回合就不能再挖掘或出牌。')],
      [t('Choose your attacker','选择攻击者'),t('Click Worker in your crew row. A ready crew member may help dig or attack once per turn.','点击你的队员栏中的矿工。可行动的队员每回合可以协助挖掘或攻击一次。')],
      [t('Attack the camp','攻击营地'),t('Click Attack AI camp. There is no defender, so the AI will lose 1 health. In a normal match, ready enemy crew may block a camp attack.','点击“攻击电脑营地”。对方没有守卫，会失去 1 点生命。正式对局中，敌方未行动的队员可以格挡营地攻击。')],
      [t('Ready to play','可以开始了'),t('You have collected a find, played a card, and attacked. Keep finds for points or sell one per turn for energy. The Rules button explains upgrades, fossils, and the final round.','你已经学会收集矿藏、出牌和攻击。保留矿藏可以得分，也可以每回合出售一件换取能量。“规则”中还有升级、化石和最终结算的说明。')]
    ];const [title,body]=steps[step];return `<aside class="tutorial-panel" aria-label="${t('Tutorial','新手教程')}"><div class="tutorial-top"><strong>${step===9?t('Practice complete','练习完成'):t(`Tutorial · ${step+1}/9`,`新手教程 · ${step+1}/9`)}</strong><button class="text-button" data-exit-tutorial>${t('Exit tutorial','退出教程')}</button></div><h2>${title}</h2><p>${body}</p>${step===0?`<button class="button primary" data-next-tutorial>${t('Start practice','开始练习')}</button>`:step===9?`<button class="button primary" data-exit-tutorial>${resumeState?t('Return to my game','返回原对局'):t('Choose a deck','选择牌组')}</button>`:''}</aside>`;
  }
  function highlightTutorial(){if(!tutorial)return;let target='';if(step===1)target='[data-field]';if(step===2)target='[data-action-type="pick"]';if(step===3)target='[data-card-id="worker"]';if(step===4)target='[data-action-type="play"]';if(step===5)target='[data-action-type="end"]';if(step===6)target='[data-action-type="combat"]';if(step===7)target='[data-unit][data-owner="0"]';if(step===8)target='[data-action-type="attack"]';if(target){const nodes=root.querySelectorAll(target);nodes.forEach(el=>el.classList.add('tutorial-focus'));if(nodes.length)requestAnimationFrame(()=>{if(!closed&&tutorial)nodes[0].scrollIntoView({block:'center',behavior:'instant'});});}}
  function startTutorial(){clearTimeout(timer);if(!tutorial)resumeState=state;state=createTutorialState();tutorial=true;step=0;screen='game';selected=null;flash='';if(dialog.open)dialog.close();render();}
  function endTutorial(){tutorial=false;state=resumeState;resumeState=null;screen=state?'game':'setup';selected=null;flash='';render();}
  function tutorialAllows(b){
    if(!tutorial)return true;
    if(b.hasAttribute('data-rules')||b.hasAttribute('data-deck')||b.hasAttribute('data-exit-tutorial')||b.hasAttribute('data-next-tutorial')||b.hasAttribute('data-tutorial'))return true;
    if(step===1&&b.dataset.field){step=2;return true;}
    if(step===3&&b.dataset.hand&&b.dataset.cardId==='worker'){step=4;return true;}
    if(step===7&&b.dataset.unit&&b.dataset.owner==='0'){step=8;return true;}
    const allowed={2:'pick',4:'play',5:'end',6:'combat',8:'attack'};
    return b.dataset.action!==undefined&&allowed[step]===actions[Number(b.dataset.action)]?.type;
  }
  function doAction(a,player){
    const before=state, target=a.target?root.querySelector(`[data-field="${a.target}"],[data-unit="${a.target}"],[data-cargo="${a.target}"]`):null;
    const rect=(target||root.querySelector(a.type==='play'?'.hand-zone':a.type==='attack'||a.type==='block'?`[data-player="${1-player}"]`:'.mine-zone'))?.getBoundingClientRect();
    state=act(state,a,player);selected=null;flash='';
    if(tutorial&&player===0&&[2,4,5,6,8].includes(step))step++;
    save();render();
    const collected=state.players[player].cargo.length>before.players[player].cargo.length;
    if(collected||['pick','dig','assist','play','attack','block'].includes(a.type))effects.burst(rect,collected?'collect':['attack','block'].includes(a.type)?'attack':a.type==='play'?'play':'dig');
    state.players.forEach((p,i)=>{if(p.hp<before.players[i].hp)effects.flash(root.querySelector(`[data-player="${i}"]`));});
    if(state.mine.length<before.mine.length)effects.flash(root.querySelector('.mine-zone'),'reveal');
  }
  function schedule(){clearTimeout(timer);if(!state||state.stage!=='playing'||closed)return;const player=state.pending?.type==='block'?1-state.active:state.active;if(player!==1)return;timer=setTimeout(()=>{if(closed)return;try{const a=tutorial?{type:'end'}:chooseAction(observation(state,1),legalActions(state,1),1);if(a)doAction(a,1);}catch(e){flash=t('The AI could not continue. You can start a new game.','电脑暂时无法继续，请尝试开始新对局。');render(false);console.error(e);}},650);}
  function render(runAI=true){actions=[];root.innerHTML=screen==='setup'?setup():state.stage==='mulligan'?mulliganScreen():board();highlightTutorial();if(runAI)schedule();}
  function deckContent(){const f=state?.players[0].faction||faction,counts=Object.entries(MINE_RECIPES[f].reduce((m,id)=>(m[id]=(m[id]||0)+1,m),{}));return `<h2>${factionInfo(f).name}</h2><p>${factionInfo(f).passive}</p><h3>${t('15 mine cards','15 张矿牌')}</h3><p>${t('Mixed with the AI’s 15 mine cards. Either player can collect any deposit.','与你的对手提供的 15 张矿牌混合。双方都可以收集任意矿藏。')}</p><div class="mine-inventory">${counts.map(([id,n])=>{const d=mineral(id);return `<div class="inventory-row ${d.kind}"><b>${n} × ${d.name}</b><p>${d.kind==='event'?d.text:t(`Needs ${d.hardness} progress · ${d.value} points · sells for ${d.sell} energy`,`需要 ${d.hardness} 点进度 · ${d.value} 分 · 出售得 ${d.sell} 能量`)}</p></div>`;}).join('')}</div><h3>${t('30 hand cards','30 张策略牌')}</h3><div class="deck-inventory">${[...new Set(strategyDeck(f))].map(id=>{const d=card(id);return `<div class="inventory-row cat-${category(id)}"><b>2 × ${d.name} <small>${d.cost} ${t('energy','能量')}</small></b><p>${d.text}${d.type==='crew'?` (${d.attack}/${d.health})`:''}</p></div>`;}).join('')}</div>`;}
  function showDialog(mode){dialogMode=mode;dialog.innerHTML=`<div class="dialog-top"><span class="eyebrow">Strata</span><button class="icon-button" data-dialog-close aria-label="${t('Close','关闭')}">×</button></div>`+(mode==='rules'?rules():mode==='deck'?deckContent():`<h2>${t('Start a new game?','开始新对局？')}</h2><p>${t('This replaces your current saved match.','这将替换你当前保存的对局。')}</p><div class="setup-actions"><button class="button" data-dialog-close>${t('Keep playing','继续当前对局')}</button><button class="button primary" data-confirm-new>${t('Start new game','开始新对局')}</button></div>`);if(!dialog.open)dialog.showModal();}
  dialog.addEventListener('click',e=>{if(e.target.closest('[data-dialog-close]'))dialog.close();if(e.target.closest('[data-confirm-new]')){dialog.close();state=null;screen='setup';clearSave();render();}});
  function click(e){const b=e.target.closest('button');if(!b||!tutorialAllows(b))return;
    if(b.hasAttribute('data-tutorial')){startTutorial();return;}
    if(b.hasAttribute('data-exit-tutorial')){endTutorial();return;}
    if(b.hasAttribute('data-next-tutorial')){step=1;render();return;}
    if(b.hasAttribute('data-rules')){showDialog('rules');return;}
    if(b.hasAttribute('data-deck')){showDialog('deck');return;}
    if(b.hasAttribute('data-new')){if(state?.stage==='over'){state=null;screen='setup';clearSave();render();}else showDialog('new');return;}
    if(b.dataset.faction){faction=b.dataset.faction;render();return;}
    if(b.hasAttribute('data-start')){state=createGame({faction,opponent});screen='game';selected=null;replacements.clear();save();render();return;}
    if(b.dataset.replace!==undefined){const i=Number(b.dataset.replace);if(replacements.has(i))replacements.delete(i);else replacements.add(i);render();return;}
    if(b.hasAttribute('data-keep')){state=mulligan(state,[...replacements]);save();render();return;}
    if(b.dataset.action!==undefined){try{doAction(actions[Number(b.dataset.action)],0);}catch(err){flash=t('This action is not available. Choose another move.','此行动暂时不可用，请选择其他行动。');render();}return;}
    if(!state||state.stage!=='playing')return;
    if(b.dataset.unit&&b.dataset.owner==='0'&&state.pending?.type==='block'&&state.active===1){const a=legalActions(state,0).find(a=>a.unit===b.dataset.unit);if(a)doAction(a,0);return;}
    if(state.active!==0||state.pending)return;
    if(b.dataset.hand)selected={kind:'hand',id:b.dataset.hand};if(b.dataset.field)selected={kind:'field',id:b.dataset.field};if(b.dataset.unit&&b.dataset.owner==='0')selected={kind:'unit',id:b.dataset.unit};if(b.dataset.cargo&&b.dataset.owner==='0')selected={kind:'cargo',id:b.dataset.cargo};render();
    root.querySelector('.control-panel')?.scrollIntoView({block:'nearest',behavior:'instant'});
  }
  const change=e=>{if(e.target.id==='opponent')opponent=e.target.value;};
  const language=()=>{render();if(dialog.open&&dialogMode)showDialog(dialogMode);};
  root.addEventListener('click',click);root.addEventListener('change',change);window.addEventListener('janus:language',language);render();
  return ()=>{closed=true;clearTimeout(timer);root.removeEventListener('click',click);root.removeEventListener('change',change);window.removeEventListener('janus:language',language);dialog.remove();effects.destroy();};
}

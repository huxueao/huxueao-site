import { CARDS, MINERALS, MINE_RECIPES, FACTIONS, strategyDeck } from './cards.js';
export const VERSION = 1;
const clone = value => structuredClone(value);
export function random(s) { s.seed = (Math.imul(s.seed,1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
function shuffle(s, array) { for (let i=array.length-1;i>0;i--) { const j=Math.floor(random(s)*(i+1)); [array[i],array[j]]=[array[j],array[i]]; } return array; }
function uid(s) { return String(++s.serial); }
function log(s, message) { s.log.push(message); if(s.log.length>100) s.log.shift(); }
const who = (s,p) => s.players[p].name;
export function score(p) { return p.cargo.reduce((n,c)=>n+MINERALS[c.card].value+(c.bonus||0),0)+p.exhibits*12+(p.faction==='gem'?new Set(p.cargo.filter(c=>MINERALS[c.card].kind==='gem').map(c=>c.card)).size:0); }
const hasSet = p => ['rib','limb','skull'].every(id=>p.cargo.some(c=>c.card===id));
const maxHealth = 20;
function checkHealth(s) {
  if(s.players.some(p=>p.hp<=0)) {
    s.winner=s.players[0].hp<=0?(s.players[1].hp<=0?'draw':1):0;
    s.stage='over';s.reason='camp';s.pending=null;log(s,s.winner==='draw'?'Both camps fell. A draw.':`${who(s,s.winner)} wins. The opposing camp has fallen.`);
  }
}
function draw(s, p, count=1) {
  const player=s.players[p];
  for(let i=0;i<count;i++) { if(player.deck.length) player.hand.push(player.deck.pop()); else { player.fatigue++; player.hp-=player.fatigue; log(s,`${player.name} takes ${player.fatigue} fatigue damage.`); } }
}
function finish(s) {
  const [a,b]=s.players,delta=score(a)-score(b)||a.hp-b.hp;
  s.winner=delta>0?0:delta<0?1:'draw';s.stage='over';s.reason='mine';s.pending=null;
  log(s,`The mine is exhausted. Final score: ${score(a)} to ${score(b)}. ${s.winner==='draw'?'A draw.':who(s,s.winner)+' wins.'}`);
}
function reveal(s) {
  if(!s.mine.length || s.reveals>=3 || s.stage==='over') return;
  const c=s.mine.pop(),d=MINERALS[c.card],p=s.players[s.active];s.reveals++;
  log(s,`${p.name} reveals ${d.name}.`);s.lastReveal={card:c.card,turn:s.turn};
  if(d.kind==='event') { s.waste.push(c); if(c.card==='spring')p.hp=Math.min(maxHealth,p.hp+2);if(c.card==='gas'){p.hp--;p.energy+=2;}if(c.card==='collapse')p.hp-=2; }
  else { if(s.field.length===3){const old=s.field.shift();s.waste.push(old);log(s,`${MINERALS[old.card].name} is buried as the seam shifts.`);} s.field.push({...c,progress:0}); }
  if(!s.mine.length && s.finalRound===null){s.finalRound=s.round;log(s,'The last layer is open. Finish this round, then compare collections.');}
  checkHealth(s);
}
function beginTurn(s) {
  s.turn++;s.active=s.order[(s.turn-1)%2];s.round=Math.ceil(s.turn/2);s.phase='action';s.reveals=0;s.pending=null;
  const p=s.players[s.active];p.turns++;p.energy=Math.min(6,p.turns+1);p.pickUsed=false;p.upgraded=false;p.sold=false;p.explored=false;p.fossilDrawn=false;
  for(const u of p.units){u.exhausted=false;u.sick=false;}
  log(s,`${p.name} begins turn ${p.turns} with ${p.energy} energy.`);
  if(s.turn>1)draw(s,s.active);
  checkHealth(s);if(s.stage==='over')return;
  reveal(s);
}
function endTurn(s) {
  if(s.turn%2===0 && s.finalRound!==null && s.round>=s.finalRound){finish(s);return;}
  beginTurn(s);
}
function dig(s,id,amount) {
  const c=s.field.find(c=>c.id===id);c.progress+=amount;
  if(c.progress>=MINERALS[c.card].hardness) {
    s.field=s.field.filter(x=>x.id!==id);const p=s.players[s.active];p.cargo.push({...c,progress:0});log(s,`${p.name} collects ${MINERALS[c.card].name}.`);
    if(p.faction==='fossil'&&MINERALS[c.card].kind==='fossil'&&!p.fossilDrawn){p.fossilDrawn=true;draw(s,s.active);}
  } else log(s,`${MINERALS[c.card].name}: ${c.progress}/${MINERALS[c.card].hardness} excavated.`);
}
function removeCargo(s,p,id) { const c=p.cargo.find(c=>c.id===id);p.cargo=p.cargo.filter(c=>c.id!==id);s.waste.push(c);return c; }
function consumeSet(s,p) { for(const id of ['rib','limb','skull'])removeCargo(s,p,p.cargo.find(c=>c.card===id).id); }
function summon(s,p,card){const d=CARDS[card];p.units.push({id:uid(s),card,hp:d.health,exhausted:false,sick:true});}
function cleanup(s) {for(const p of s.players){for(const u of p.units.filter(u=>u.hp<=0)){if(!CARDS[u.card].token)p.discard.push({id:u.id,card:u.card});log(s,`${CARDS[u.card].name} is lost.`);}p.units=p.units.filter(u=>u.hp>0);}}
function combat(s,attackerId,targetId,blockerId=null){
  const p=s.players[s.active],e=s.players[1-s.active],u=p.units.find(u=>u.id===attackerId);
  u.exhausted=true;
  const target=e.units.find(u=>u.id===(blockerId||targetId));
  if(target){if(blockerId)target.exhausted=true;target.hp-=CARDS[u.card].attack;u.hp-=CARDS[target.card].attack;log(s,`${CARDS[u.card].name} clashes with ${CARDS[target.card].name}.`);}
  else{e.hp-=CARDS[u.card].attack;log(s,`${CARDS[u.card].name} hits ${e.name}'s camp for ${CARDS[u.card].attack}.`);}
  s.pending=null;cleanup(s);checkHealth(s);
}

export function createGame({faction='gold',opponent='fossil',seed=Date.now()>>>0,first}={}) {
  if(!FACTIONS[faction]||!FACTIONS[opponent])throw new Error('Unknown expedition.');
  const s={version:VERSION,seed:seed>>>0,initialSeed:seed>>>0,serial:0,stage:'mulligan',phase:'action',players:[],mine:[],field:[],waste:[],log:[],turn:0,round:0,active:0,finalRound:null,pending:null,winner:null,reason:null};
  s.order=(first??Math.floor(random(s)*2))===0?[0,1]:[1,0];
  for(const [i,f] of [faction,opponent].entries()){
    const p={name:i===0?'You':'The Guide',faction:f,hp:20,energy:0,turns:0,pick:1,pickUsed:false,upgraded:false,sold:false,explored:false,fossilDrawn:false,supply:s.order[1]===i,exhibits:0,fatigue:0,cargo:[],units:[],discard:[],hand:[],deck:shuffle(s,strategyDeck(f).map(card=>({card,id:uid(s)})))};
    s.players.push(p);draw(s,i,5);
    s.mine.push(...MINE_RECIPES[f].map(card=>({card,id:uid(s)})));
  }
  shuffle(s,s.mine);return s;
}
export function mulligan(state,indices=[]){
  if(state.stage!=='mulligan')throw new Error('The expedition has already begun.');
  if(!Array.isArray(indices)||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>4))throw new Error('Invalid replacement.');
  const s=clone(state);
  for(let player=0;player<2;player++){
    const p=s.players[player],replace=player===0?indices:p.hand.flatMap((c,i)=>CARDS[c.card].cost>=4?[i]:[]),removed=p.hand.filter((c,i)=>replace.includes(i));
    p.hand=p.hand.filter((c,i)=>!replace.includes(i));draw(s,player,removed.length);p.deck.push(...removed);shuffle(s,p.deck);
  }
  s.stage='playing';log(s,`${who(s,s.order[0])} goes first. The second explorer has one supply token.`);beginTurn(s);return s;
}

function targets(s,d,p,e) {
  if(d.type==='crew')return p.units.length<4?[null]:[];
  if(d.target==='field')return s.field.map(c=>c.id);
  if(d.target==='nonfossil')return s.field.filter(c=>MINERALS[c.card].kind!=='fossil').map(c=>c.id);
  if(d.target==='fossilfield')return s.field.filter(c=>MINERALS[c.card].kind==='fossil').map(c=>c.id);
  if(d.target==='enemy')return e.units.map(u=>u.id);
  if(['ore','gem','fossil'].includes(d.target))return p.cargo.filter(c=>MINERALS[c.card].kind===d.target&&(d.effect!=='value'||!c.enhanced)).map(c=>c.id);
  if(['skeleton','revive'].includes(d.effect))return hasSet(p)&&(d.effect!=='revive'||p.units.length<4)?[null]:[];
  if(d.effect==='upgrade')return p.pick<3?[null]:[];
  if(d.effect==='survey')return s.mine.length?[null]:[];
  if(d.effect==='heal')return p.hp<20?[null]:[];
  return [null];
}
export function legalActions(s,player=s.active) {
  if(s.stage!=='playing')return [];
  if(s.pending?.type==='block'){
    if(player!==1-s.active)return [];
    return [{type:'block',unit:null},...s.players[player].units.filter(u=>!u.exhausted).map(u=>({type:'block',unit:u.id}))];
  }
  if(player!==s.active)return [];
  const p=s.players[player],e=s.players[1-player];
  if(s.pending?.type==='survey')return s.mine.slice(-3).map(c=>({type:'survey',target:c.id}));
  if(s.pending?.type==='discard')return p.hand.map(c=>({type:'discard',card:c.id}));
  const a=[{type:'end'}];
  if(s.phase==='combat'){
    for(const u of p.units.filter(u=>!u.sick&&!u.exhausted&&CARDS[u.card].attack>0))for(const t of [null,...e.units.map(u=>u.id)])a.push({type:'attack',unit:u.id,target:t});
    return a;
  }
  a.push({type:'combat'});
  if(p.supply)a.push({type:'supply'});
  if(!p.explored&&p.energy>=2&&s.mine.length&&s.reveals<3)a.push({type:'explore'});
  if(p.energy>=3&&p.pick<3&&!p.upgraded)a.push({type:'upgrade'});
  for(const c of s.field){
    if(!p.pickUsed)a.push({type:'pick',target:c.id});
    if(p.energy>=1)a.push({type:'dig',target:c.id});
    for(const u of p.units.filter(u=>!u.sick&&!u.exhausted))a.push({type:'assist',unit:u.id,target:c.id});
  }
  if(!p.sold)for(const c of p.cargo)a.push({type:'sell',target:c.id});
  for(const c of p.hand){const d=CARDS[c.card];if(p.energy>=d.cost)for(const target of targets(s,d,p,e))a.push({type:'play',card:c.id,target});}
  return a;
}
const sameAction=(a,b)=>Object.keys(a).every(k=>a[k]===b[k])&&Object.keys(b).every(k=>b[k]===a[k]);
export function act(state,action,player=state.pending?.type==='block'?1-state.active:state.active) {
  if(!legalActions(state,player).some(a=>sameAction(a,action)))throw new Error('That action is not available.');
  const s=clone(state),p=s.players[s.active],e=s.players[1-s.active];
  if(action.type==='block'){combat(s,s.pending.attacker,null,action.unit);return s;}
  if(action.type==='survey'){const i=s.mine.findIndex(c=>c.id===action.target);s.mine.push(...s.mine.splice(i,1));s.pending=null;log(s,`${p.name} rearranges the next layer.`);return s;}
  if(action.type==='discard'){const i=p.hand.findIndex(c=>c.id===action.card);p.discard.push(...p.hand.splice(i,1));if(p.hand.length<=8){s.pending=null;endTurn(s);}return s;}
  if(action.type==='end'){if(p.hand.length>8)s.pending={type:'discard'};else endTurn(s);return s;}
  if(action.type==='combat'){s.phase='combat';log(s,`${p.name} enters combat. Excavation is closed for this turn.`);return s;}
  if(action.type==='attack'){
    if(action.target===null&&e.units.some(u=>!u.exhausted)){s.pending={type:'block',attacker:action.unit};return s;}
    combat(s,action.unit,action.target);return s;
  }
  if(action.type==='supply'){p.energy++;p.supply=false;log(s,`${p.name} uses the supply token (+1 energy).`);}
  if(action.type==='upgrade'){p.energy-=3;p.pick++;p.upgraded=true;log(s,`${p.name} upgrades the pickaxe to level ${p.pick}.`);}
  if(action.type==='pick'){p.pickUsed=true;dig(s,action.target,p.pick);}
  if(action.type==='dig'){p.energy--;dig(s,action.target,1);}
  if(action.type==='assist'){const u=p.units.find(u=>u.id===action.unit),d=CARDS[u.card],c=s.field.find(c=>c.id===action.target);u.exhausted=true;dig(s,action.target,d.dig||(d.digKind===MINERALS[c.card].kind?2:1));}
  if(action.type==='explore'){p.energy-=2;p.explored=true;reveal(s);}
  if(action.type==='sell'){const c=removeCargo(s,p,action.target),n=MINERALS[c.card].sell+(p.faction==='gold'?1:0);p.sold=true;p.energy+=n;log(s,`${p.name} sells ${MINERALS[c.card].name} for ${n} energy.`);}
  if(action.type==='play'){
    const i=p.hand.findIndex(c=>c.id===action.card),c=p.hand.splice(i,1)[0],d=CARDS[c.card];p.energy-=d.cost;log(s,`${p.name} plays ${d.name}.`);
    if(d.type==='crew')summon(s,p,c.card);else{
      p.discard.push(c);
      if(d.effect==='dig'||d.effect==='brush')dig(s,action.target,d.amount);
      if(d.effect==='blast'){dig(s,action.target,d.amount);p.hp-=2;}
      if(d.effect==='heal')p.hp=Math.min(20,p.hp+d.amount);
      if(d.effect==='draw')draw(s,s.active,d.amount);
      if(d.effect==='damage'){e.units.find(u=>u.id===action.target).hp-=d.amount;if(c.card==='refraction')draw(s,s.active);}
      if(d.effect==='energy'){p.energy+=d.amount;p.hp--;}
      if(d.effect==='throw'){removeCargo(s,p,action.target);e.hp-=d.amount;}
      if(d.effect==='upgrade')p.pick++;
      if(d.effect==='value'){const target=p.cargo.find(c=>c.id===action.target);target.bonus=(target.bonus||0)+d.amount;target.enhanced=true;}
      if(d.effect==='survey')s.pending={type:'survey'};
      if(d.effect==='resonate')dig(s,action.target,MINERALS[s.field.find(c=>c.id===action.target).card].kind==='gem'?4:2);
      if(d.effect==='skeleton'){consumeSet(s,p);p.exhibits++;}
      if(d.effect==='revive'){consumeSet(s,p);summon(s,p,'ancient');}
    }
  }
  cleanup(s);checkHealth(s);return s;
}

// No opponent hand, deck order, or unrevealed mine order is passed to the AI.
export function observation(s,player) {
  const view=clone(s);delete view.seed;delete view.initialSeed;
  view.mineCount=s.mine.length;
  view.forecast=s.pending?.type==='survey'&&s.active===player?s.mine.slice(-3):[];
  view.mine=[];
  for(let i=0;i<2;i++){
    const p=view.players[i];p.deckCount=p.deck.length;p.deck=[];
    p.handCount=p.hand.length;if(i!==player)p.hand=[];
  }
  return view;
}

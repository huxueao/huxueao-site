import { CARDS, MINERALS } from './cards.js';
import { score } from './engine.js';

// Deterministic utility policy. Inputs are a redacted observation and legal moves.
// It has exactly the information a player has, including a forecast only after Survey.
export function chooseAction(v,actions,player) {
  if(!actions.length)return null;
  const p=v.players[player],e=v.players[1-player],late=v.mineCount<7;
  const needSet=p.faction==='fossil'&&p.hand.some(c=>['skeleton','revive'].includes(c.card));
  const value=c=>MINERALS[c.card].value+(c.bonus||0)+(p.faction==='gem'&&MINERALS[c.card].kind==='gem'&&!p.cargo.some(x=>x.card===c.card)?2:0)+(needSet&&MINERALS[c.card].kind==='fossil'&&!p.cargo.some(x=>x.card===c.card)?3:0);
  const excavation=(c,n,cost=0)=>{
    const remaining=MINERALS[c.card].hardness-c.progress;
    if(n>=remaining)return 4+value(c)*1.5-cost*.8;
    if(p.energy>=remaining-n+cost)return .8+value(c)*.4-cost*.4;
    return -2; // Do not hand an almost-finished deposit to the other explorer.
  };
  const rate=a=>{
    const c=v.field.find(c=>c.id===a.target),u=p.units.find(u=>u.id===a.unit),target=e.units.find(u=>u.id===a.target),cargo=p.cargo.find(c=>c.id===a.target);
    switch(a.type){
      case 'end':return 0;
      case 'combat':return p.units.some(u=>!u.exhausted&&!u.sick&&CARDS[u.card].attack>0)?1:-.5;
      case 'pick':return excavation(c,p.pick)+1;
      case 'dig':return excavation(c,1,1);
      case 'assist':return excavation(c,CARDS[u.card].dig||(CARDS[u.card].digKind===MINERALS[c.card].kind?2:1))-(CARDS[u.card].attack*.7)-(p.hp<8?1.5:0);
      case 'explore':return !v.field.length&&(!p.pickUsed||p.units.some(u=>!u.sick&&!u.exhausted))?4:(late&&score(p)>score(e)+3?1.2:-1);
      case 'upgrade':return v.mineCount>14?3.8:v.mineCount>8?1:-1;
      case 'supply':return p.hand.some(c=>CARDS[c.card].cost===p.energy+1)?3:-1;
      case 'sell':{
        const income=MINERALS[cargo.card].sell+(p.faction==='gold'?1:0);
        const useful=p.hand.some(c=>CARDS[c.card].cost>p.energy&&CARDS[c.card].cost<=p.energy+income);
        return useful&&!late?4-value(cargo)*.7:-2;
      }
      case 'discard':return -CARDS[p.hand.find(c=>c.id===a.card).card].cost+(p.hand.filter(c=>c.card===p.hand.find(x=>x.id===a.card).card).length>1?2:0);
      case 'survey':{const x=v.forecast.find(c=>c.id===a.target);return MINERALS[x.card].kind==='event'?(x.card==='collapse'?-5:1):value(x);}
      case 'block':{
        const attacker=e.units.find(u=>u.id===v.pending.attacker),d=CARDS[attacker.card];
        if(a.unit===null)return p.hp<=d.attack?-100:0;
        const b=p.units.find(u=>u.id===a.unit),bd=CARDS[b.card];
        return (p.hp<=d.attack?100:0)+d.attack*.7+(bd.attack>=attacker.hp?4:0)-(d.attack>=b.hp?bd.cost+1:0)-(p.hp>12?1:0);
      }
      case 'attack':{
        const d=CARDS[u.card];
        if(!target){const guards=e.units.filter(u=>!u.exhausted);return !guards.length?(e.hp<=d.attack?100:d.attack*(p.hp>8?1.1:.6)):d.attack*.35-guards.reduce((n,x)=>Math.max(n,CARDS[x.card].attack>=u.hp?2:0),0);}
        const td=CARDS[target.card],kill=d.attack>=target.hp,loss=td.attack>=u.hp;
        return (kill?td.cost+2:d.attack*.2)-(loss?d.cost+1:td.attack*.2)+(e.units.length>p.units.length?.5:0);
      }
      case 'play':{
        const card=p.hand.find(c=>c.id===a.card),d=CARDS[card.card];
        if(d.type==='crew')return (late?1:3)+d.attack*.7+d.health*.3-(p.units.length>=3?2:0);
        if(d.effect==='dig'||d.effect==='brush')return excavation(c,d.amount,d.cost);
        if(d.effect==='blast')return p.hp<=2?-100:excavation(c,4,2)-1.5;
        if(d.effect==='resonate')return excavation(c,MINERALS[c.card].kind==='gem'?4:2,2);
        if(d.effect==='heal')return p.hp<9?10:p.hp<15?3:-1;
        if(d.effect==='damage')return d.amount>=target.hp?CARDS[target.card].cost+3:1;
        if(d.effect==='energy')return p.hp>3&&p.hand.some(x=>CARDS[x.card].cost>p.energy&&CARDS[x.card].cost<=p.energy+2)?6:-1;
        if(d.effect==='draw')return p.deckCount&&p.hand.length<6?(p.hand.length<3?5:1):-2;
        if(d.effect==='throw')return e.hp<=3?100:e.hp<9?5-value(cargo)*.3:-1;
        if(d.effect==='upgrade')return v.mineCount>7?5:0;
        if(d.effect==='value')return late?5:1.3;
        if(d.effect==='skeleton')return 12;
        if(d.effect==='revive')return !late&&p.units.length<3?14:1;
        if(d.effect==='survey')return !p.explored&&p.energy>=3&&!v.field.length?1.8:-1;
        return -1;
      }
      default:return -1;
    }
  };
  return actions.reduce((best,a)=>rate(a)>rate(best)?a:best,actions[0]);
}

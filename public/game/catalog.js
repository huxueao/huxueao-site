import { CARDS, MINERALS, FACTIONS } from './cards.js';
import { t, getLanguage } from '../i18n.js';

const cardText = {
  worker:['Worker','矿工','Can dig, attack, or block.','可以协助挖掘、攻击或格挡。'],
  guard:['Guard','守卫','A sturdy crew member for combat and digging.','耐打的队员，可以战斗或协助挖掘。'],
  scout:['Scout','侦察兵','A low-cost crew member.','费用较低的队员。'],
  dig:['Dig','挖掘','Add 3 progress to a deposit.','为一处矿藏增加 3 点挖掘进度。'],
  blast:['Blast','爆破','Add 4 progress to ore or gems. Lose 2 health.','为矿石或宝石增加 4 点进度，自己失去 2 点生命。'],
  repair:['First aid','急救','Restore 4 health, up to 20.','恢复 4 点生命，上限为 20。'],
  bolt:['Stone shot','投石','Deal 4 damage to an enemy crew member.','对敌方一名队员造成 4 点伤害。'],
  research:['Research','研究','Draw 2 cards.','抽 2 张手牌。'],
  foreman:['Foreman','工头','A strong crew member for combat and digging.','强壮的队员，可以战斗或协助挖掘。'],
  mule:['Pack mule','驮骡','Adds 2 progress when helping dig. Cannot attack.','协助挖掘时增加 2 点进度，无法攻击。'],
  hire:['Mercenary','佣兵','High attack, at a higher cost.','费用较高，攻击力强。'],
  credit:['Extra shift','加班','Gain 2 energy this turn. Lose 1 health.','本回合获得 2 点能量，失去 1 点生命。'],
  smelt:['Hot ore','灼热矿石','Spend one ore in your collection to deal 3 damage to the enemy camp.','消耗收藏中的一块矿石，对敌方营地造成 3 点伤害。'],
  tools:['Better tools','改良工具','Upgrade your pickaxe by 1, up to 3. Does not refresh it.','镐等级提升 1，上限为 3。不会重置本回合使用次数。'],
  dividend:['Refine ore','精炼矿石','Add 2 points to one collected ore. Once per item.','一块已收藏的矿石增加 2 分，每块限一次。'],
  lens:['Gem miner','宝石矿工','Helps dig for 2 progress on gems, or 1 on other deposits.','协助挖宝石时增加 2 点进度，其他矿藏增加 1 点。'],
  warden:['Gem guard','宝石守卫','A tough defender with 6 health.','拥有 6 点生命的坚韧守卫。'],
  shard:['Gem fighter','宝石斗士','Strong attack, low health.','攻击力较高，生命较低。'],
  survey:['Survey','勘探','Look at the next 3 mine cards. Choose which comes next.','查看矿堆顶端 3 张牌，选择下一张翻开的牌。'],
  polish:['Polish','打磨','Add 2 points to one collected gem. Once per item.','一颗已收藏的宝石增加 2 分，每颗限一次。'],
  resonance:['Gem drill','宝石钻头','Add 4 progress to a gem, or 2 to another deposit.','为宝石增加 4 点进度，其他矿藏增加 2 点。'],
  refraction:['Shard shot','碎晶射击','Deal 3 damage to an enemy crew member. Draw 1 card.','对敌方一名队员造成 3 点伤害，然后抽 1 张牌。'],
  curator:['Bone digger','化石挖掘员','Helps dig for 2 progress on fossils, or 1 on other deposits.','协助挖化石时增加 2 点进度，其他矿藏增加 1 点。'],
  hound:['Search hound','搜寻犬','A balanced crew member for combat and digging.','攻防均衡，可以战斗或协助挖掘。'],
  archivist:['Keeper','保管员','A sturdy crew member with 5 health.','拥有 5 点生命的耐打队员。'],
  brush:['Brush','毛刷','Add 3 progress to a fossil.','为一处化石增加 3 点挖掘进度。'],
  skeleton:['Build skeleton','拼合骨架','Spend a rib, limb, and skull to make a 12-point exhibit.','消耗肋骨、肢骨和头骨各一个，组成价值 12 分的展品。'],
  revive:['Revive dinosaur','复活恐龙','Spend a rib, limb, and skull to summon a 6/8 dinosaur. It acts next turn.','消耗肋骨、肢骨和头骨各一个，召唤 6/8 的恐龙。下回合才能行动。'],
  preserve:['Preserve','保存化石','Add 2 points to one collected fossil. Once per item.','一件已收藏的化石增加 2 分，每件限一次。'],
  ancient:['Dinosaur','恐龙','A 6-attack, 8-health creature.','拥有 6 点攻击、8 点生命。']
};
const mineralNames = {copper:'铜',iron:'铁',silver:'银',gold:'金',quartz:'石英',ruby:'红宝石',sapphire:'蓝宝石',amber:'琥珀',rib:'肋骨',limb:'肢骨',skull:'头骨',spring:'地下泉',gas:'瓦斯',collapse:'塌方'};
const events = {spring:['Restore 2 health.','恢复 2 点生命。'],gas:['Lose 1 health. Gain 2 energy this turn.','失去 1 点生命，本回合获得 2 点能量。'],collapse:['Lose 2 health.','失去 2 点生命。']};
export function card(id) { const d=CARDS[id], c=cardText[id]; return {...d,name:t(c[0],c[1]),text:t(c[2],c[3])}; }
export function mineral(id) { const d=MINERALS[id]; return {...d,name:t(id==='spring'?'Spring':id==='gas'?'Gas pocket':id==='collapse'?'Cave-in':d.name,mineralNames[id]),text:events[id]?t(...events[id]):''}; }
export function faction(id) {
  const data={
    gold:{name:t('Gold crew','金矿队'),description:t('Sell ore for energy and build a stronger crew.','出售矿石获得能量，组建强大的队伍。'),passive:t('Your sale each turn earns 1 extra energy.','每回合出售藏品时，额外获得 1 点能量。')},
    gem:{name:t('Gem crew','宝石队'),description:t('Collect different gems and plan your next dig.','收集不同宝石，提前规划挖掘。'),passive:t('Each different gem in your collection adds 1 point.','结算时，每种不同的宝石额外加 1 分。')},
    fossil:{name:t('Fossil crew','化石队'),description:t('Build a skeleton for points or revive a dinosaur.','拼合骨架得分，或复活恐龙。'),passive:t('Your first fossil each turn lets you draw a card.','每回合收集到的第一块化石让你抽一张牌。')}
  };return {...FACTIONS[id],...data[id]};
}
export const kindName = kind => ({ore:t('Ore','矿石'),gem:t('Gem','宝石'),fossil:t('Fossil','化石'),event:t('Event','事件')})[kind];
export function category(id) { const d=CARDS[id];return d.type==='crew'?'crew':['dig','brush','blast','resonate'].includes(d.effect)?'dig':['damage','throw'].includes(d.effect)?'attack':['heal','draw','energy'].includes(d.effect)?'support':'special'; }
export const categoryName = id => ({crew:t('Crew','队员'),dig:t('Dig','挖掘'),attack:t('Attack','攻击'),support:t('Support','支援'),special:t('Special','特殊')})[id];

export function logText(message) {
  let s=message.replaceAll('The Guide','AI');
  for(const [id,d] of Object.entries(CARDS).sort((a,b)=>b[1].name.length-a[1].name.length)) s=s.split(d.name).join(card(id).name);
  for(const [id,d] of Object.entries(MINERALS).sort((a,b)=>b[1].name.length-a[1].name.length)) s=s.split(d.name).join(mineral(id).name);
  if(getLanguage()==='en') return s;
  const who=x=>x==='You'?'你':x==='AI'?'电脑':x;
  const patterns=[
    [/^(.+) begins turn (\d+) with (\d+) energy\.$/,(_,p,n,e)=>`${who(p)}的第 ${n} 回合，获得 ${e} 点能量。`],
    [/^(.+) reveals (.+)\.$/,(_,p,n)=>`${who(p)}翻开了${n}。`],
    [/^(.+) collects (.+)\.$/,(_,p,n)=>`${who(p)}收集了${n}。`],
    [/^(.+): (\d+)\/(\d+) excavated\.$/,(_,n,a,b)=>`${n}：已挖掘 ${a}/${b}。`],
    [/^(.+) plays (.+)\.$/,(_,p,n)=>`${who(p)}打出${n}。`],
    [/^(.+) is lost\.$/,(_,n)=>`${n}离场。`],
    [/^(.+) clashes with (.+)\.$/,(_,a,b)=>`${a}与${b}交战。`],
    [/^(.+) hits (.+)'s camp for (\d+)\.$/,(_,n,p,d)=>`${n}对${who(p)}的营地造成 ${d} 点伤害。`],
    [/^(.+) takes (\d+) fatigue damage\.$/,(_,p,n)=>`${who(p)}受到 ${n} 点疲劳伤害。`],
    [/^(.+) is buried as the seam shifts\.$/,(_,n)=>`${n}被新翻开的矿藏掩埋。`],
    [/^(.+) sells (.+) for (\d+) energy\.$/,(_,p,n,e)=>`${who(p)}出售${n}，获得 ${e} 点能量。`],
    [/^(.+) upgrades the pickaxe to level (\d+)\.$/,(_,p,n)=>`${who(p)}将镐升级到 ${n} 级。`],
    [/^(.+) uses the supply token \(\+1 energy\)\.$/,(_,p)=>`${who(p)}使用补给，获得 1 点能量。`],
    [/^(.+) rearranges the next layer\.$/,(_,p)=>`${who(p)}调整了下一张矿牌。`],
    [/^(.+) enters combat\. Excavation is closed for this turn\.$/,(_,p)=>`${who(p)}进入战斗，本回合不能再挖掘或出牌。`],
    [/^(.+) goes first\. The second explorer has one supply token\.$/,(_,p)=>`${who(p)}先手，后手获得一个补给。`],
    [/^(.+) wins\. The opposing camp has fallen\.$/,(_,p)=>`${who(p)}获胜，对方营地被击败。`],
    [/^The mine is exhausted\. Final score: (\d+) to (\d+)\. (.+)$/,(_,a,b,end)=>`矿堆已挖完，比分 ${a} : ${b}。${end==='A draw.'?'平局。':who(end.replace(' wins.',''))+'获胜。'}`]
  ];
  if(s==='The last layer is open. Finish this round, then compare collections.')return '最后一张矿牌已翻开。本轮双方行动结束后比较分数。';
  if(s==='Both camps fell. A draw.')return '双方营地同时被击败，平局。';
  for(const [re,fn] of patterns)if(re.test(s))return s.replace(re,fn);
  return s;
}

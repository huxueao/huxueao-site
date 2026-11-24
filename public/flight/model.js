export const WIDTH=480, HEIGHT=560, RADIUS=11, SPEED=118, SPACING=204, GATE_WIDTH=62;
export const ASSETS={
  NVDA:{name:'NVIDIA',zh:'英伟达',pilot:'Jensen Huang',pilotZh:'黄仁勋',color:'#b8f36b',sprite:0},
  TSLA:{name:'Tesla',zh:'特斯拉',pilot:'Elon Musk',pilotZh:'马斯克',color:'#ff7480',sprite:1},
  AAPL:{name:'Apple',zh:'苹果',pilot:'Tim Cook',pilotZh:'蒂姆·库克',color:'#a8ddff',sprite:2},
  BTC:{name:'Bitcoin',zh:'比特币',pilot:'Bitcoin cat',pilotZh:'比特猫',color:'#ffc16b',sprite:3},
};
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
export function validateMarketData(data){
  if(data?.version!==2||!datePattern.test(data.windowStart)||!datePattern.test(data.windowEnd)||!Number.isFinite(Date.parse(data.fetchedAt)))throw Error('Invalid market data');
  const days=(Date.parse(data.windowEnd)-Date.parse(data.windowStart))/86400000;
  if(days<365||days>366)throw Error('A full calendar year is required');
  const assets=data.asset?[data.asset]:data.assets;if(!Array.isArray(assets)||!assets.length)throw Error('Missing asset');
  for(const asset of assets){
    if(!ASSETS[asset.symbol]||asset.interval!=='1d'||!asset.sourceUrl?.startsWith('https://')||!Array.isArray(asset.candles)||asset.candles.length<(asset.symbol==='BTC'?300:180)||asset.candles.length>366)throw Error('Incomplete annual data');
    let last='';for(const c of asset.candles){
      if(!datePattern.test(c.date)||c.date<=last||c.date<data.windowStart||c.date>data.windowEnd||![c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite)||c.low<=0||c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close)||c.volume<0)throw Error('Invalid candle');last=c.date;
    }
    if(Date.parse(asset.candles[0].date)-Date.parse(data.windowStart)>864000000||Date.parse(data.windowEnd)-Date.parse(asset.candles.at(-1).date)>864000000)throw Error('Truncated annual history');
  }
  if(data.asset&&data.asOf!==data.asset.candles.at(-1).date)throw Error('Invalid as-of date');
  return data;
}
export function makeCourse(asset){
  const candles=asset.candles;if(!candles?.length)throw Error('No candles in course');
  const min=Math.min(...candles.map(c=>c.low)),max=Math.max(...candles.map(c=>c.high)),range=Math.max(max-min,max*.001),priceY=price=>HEIGHT*.78-(price-min)/range*(HEIGHT*.56);
  const bodies=candles.map(c=>Math.abs(c.close-c.open)),largest=Math.max(...bodies,range*.001);
  return candles.map((c,i)=>{
    const center=priceY((c.open+c.close)/2),gap=142+Math.sqrt(bodies[i]/largest)*52,top=center-gap/2,bottom=center+gap/2;
    const wickLength=amount=>amount>0?Math.max(12,Math.min(76,amount/range*HEIGHT*.8)):0;
    return {...c,index:i,center,gap,top,bottom,highY:top-wickLength(c.high-Math.max(c.open,c.close)),lowY:bottom+wickLength(Math.min(c.open,c.close)-c.low),rising:c.close>=c.open,x:WIDTH-54+i*SPACING};
  });
}
export function createFlight(course){return {phase:'ready',course,bird:{x:112,y:course[0]?.center??HEIGHT/2,vy:0},distance:0,time:0,score:0,reason:null,lastPassed:-1};}
export function flap(s){if(s.phase==='ready')s.phase='running';if(s.phase==='running')s.bird.vy=-292;return s;}
export function nextGate(s){return s.course[Math.min(s.score,s.course.length-1)];}
export function step(s,dt){
  if(s.phase!=='running')return s;dt=Math.min(.025,Math.max(0,dt));s.time+=dt;s.distance+=SPEED*dt;s.bird.vy=Math.min(440,s.bird.vy+850*dt);s.bird.y+=s.bird.vy*dt;
  if(s.bird.y-RADIUS<=20||s.bird.y+RADIUS>=HEIGHT-20){s.phase='crashed';s.reason='edge';return s;}
  for(const g of s.course.slice(s.score,s.score+3)){
    const x=g.x-s.distance,left=x-GATE_WIDTH/2,right=x+GATE_WIDTH/2;
    if(s.bird.x+RADIUS>left&&s.bird.x-RADIUS<right&&(s.bird.y-RADIUS<g.top||s.bird.y+RADIUS>g.bottom)){s.phase='crashed';s.reason='candle';return s;}
    if(g.index>s.lastPassed&&right<s.bird.x-RADIUS){s.lastPassed=g.index;s.score=g.index+1;}
  }
  if(s.score===s.course.length)s.phase='cleared';return s;
}
export const flightKey=data=>`${data.asset.symbol}:${data.windowStart}:${data.windowEnd}`;
export function saveFlight(state,data){
  return {version:2,data,state:{bird:{...state.bird},distance:state.distance,time:state.time,score:state.score,lastPassed:state.lastPassed},savedAt:new Date().toISOString()};
}
export function restoreFlight(saved){
  try{
    if(saved?.version!==2||!saved.data.asset)return null;const data=validateMarketData(saved.data),p=saved.state,state=createFlight(makeCourse(data.asset));
    if(!p||!p.bird||![p.bird.x,p.bird.y,p.bird.vy,p.distance,p.time].every(Number.isFinite)||p.bird.x!==112||p.bird.y<=20+RADIUS||p.bird.y>=HEIGHT-20-RADIUS||p.bird.vy< -292||p.bird.vy>440||p.time<0||p.time>2000||p.distance<0||Math.abs(p.distance-p.time*SPEED)>.1||!Number.isInteger(p.score)||p.score<0||p.score>=state.course.length||p.lastPassed!==p.score-1)return null;
    const passed=state.course.filter(g=>g.x-p.distance+GATE_WIDTH/2<p.bird.x-RADIUS).length;if(passed!==p.score)return null;
    Object.assign(state,p,{bird:{...p.bird},phase:'running'});step(state,0);if(state.phase!=='running')return null;state.phase='paused';return {state,data};
  }catch{return null;}
}

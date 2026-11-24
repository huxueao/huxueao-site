export const WIDTH=1120, HEIGHT=600, BIRD_X=160, RADIUS=2, SPEED=58, SPACING=112, GATE_WIDTH=14;
export const PRICE_SCALE=2000, EDGE_GRACE=7, CLIMB_SPEED=340, FALL_SPEED=260;
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
  // A fixed linear price axis anchored to the first open. Future highs/lows never
  // compress earlier candles. One percent of the initial price is 20 world units.
  const reference=candles[0].open,priceY=price=>(1-price/reference)*PRICE_SCALE;
  return candles.map((c,i)=>{
    const openY=priceY(c.open),closeY=priceY(c.close),top=Math.min(openY,closeY),bottom=Math.max(openY,closeY);
    return {...c,index:i,reference,openY,closeY,center:(top+bottom)/2,gap:bottom-top,top,bottom,highY:priceY(c.high),lowY:priceY(c.low),rising:c.close>=c.open,x:BIRD_X+210+i*SPACING};
  });
}
export function createFlight(course){const y=course[0]?.center??0;return {phase:'ready',course,bird:{x:BIRD_X,y,vy:0},cameraY:y-HEIGHT/2,lift:false,distance:0,time:0,score:0,reason:null,lastPassed:-1};}
export function flap(s){if(s.phase==='ready')s.phase='running';if(s.phase==='running')s.bird.vy=Math.min(s.bird.vy,-95);return s;}
export function setLift(s,pressed){s.lift=!!pressed&&s.phase==='running';return s;}
export function nextGate(s){return s.course[Math.min(s.score,s.course.length-1)];}
export function updateCamera(s,dt){
  const look=Math.max(-HEIGHT*.55,Math.min(HEIGHT*.55,(nextGate(s)?.center??s.bird.y)-s.bird.y))*.5;
  const target=s.bird.y+look-HEIGHT/2;s.cameraY+=(target-s.cameraY)*(1-Math.exp(-7*dt));
}
export function step(s,dt){
  if(s.phase!=='running')return s;dt=Math.min(.025,Math.max(0,dt));s.time+=dt;s.distance+=SPEED*dt;
  const target=s.lift?-CLIMB_SPEED:FALL_SPEED;s.bird.vy+=(target-s.bird.vy)*(1-Math.exp(-8*dt));s.bird.y+=s.bird.vy*dt;
  for(const g of s.course.slice(s.score,s.score+3)){
    const x=g.x-s.distance,left=x-GATE_WIDTH/2,right=x+GATE_WIDTH/2;
    if(s.bird.x+RADIUS>left+3&&s.bird.x-RADIUS<right-3&&(s.bird.y-RADIUS<g.top-EDGE_GRACE||s.bird.y+RADIUS>g.bottom+EDGE_GRACE)){s.phase='crashed';s.reason='candle';s.lift=false;break;}
    if(g.index>s.lastPassed&&right<s.bird.x-RADIUS){s.lastPassed=g.index;s.score=g.index+1;}
  }
  updateCamera(s,dt);if(s.score===s.course.length){s.phase='cleared';s.lift=false;}return s;
}
export const flightKey=data=>`${data.asset.symbol}:${data.windowStart}:${data.windowEnd}`;
export function saveFlight(state,data){
  return {version:3,data,state:{bird:{...state.bird},cameraY:state.cameraY,distance:state.distance,time:state.time,score:state.score,lastPassed:state.lastPassed},savedAt:new Date().toISOString()};
}
export function restoreFlight(saved){
  try{
    if(saved?.version===2&&saved.data?.asset){
      const data=validateMarketData(saved.data),p=saved.state,s=createFlight(makeCourse(data.asset));
      if(!p?.bird||![p.distance,p.time,p.bird.x,p.bird.y,p.bird.vy].every(Number.isFinite)||p.distance<0||p.time<0||p.time>2000||Math.abs(p.distance-p.time*118)>.1||p.bird.x!==112||p.bird.y<=31||p.bird.y>=529||p.bird.vy< -292||p.bird.vy>440||!Number.isInteger(p.score)||p.score<0||p.score>=s.course.length||p.lastPassed!==p.score-1)return null;
      if(s.course.filter((g,i)=>426+i*204-p.distance+31<101).length!==p.score)return null;
      s.score=p.score;s.lastPassed=p.lastPassed;s.distance=p.score?s.course[p.score-1].x-BIRD_X+GATE_WIDTH/2+RADIUS+8:0;s.time=s.distance/SPEED;s.bird.y=nextGate(s).center;s.cameraY=s.bird.y-HEIGHT/2;s.phase='paused';return {state:s,data,migrated:true};
    }
    if(saved?.version!==3||!saved.data.asset)return null;const data=validateMarketData(saved.data),p=saved.state,state=createFlight(makeCourse(data.asset));
    if(!p||!p.bird||![p.bird.x,p.bird.y,p.bird.vy,p.cameraY,p.distance,p.time].every(Number.isFinite)||p.bird.x!==BIRD_X||Math.abs(p.bird.y)>1000000||Math.abs(p.cameraY-p.bird.y)>HEIGHT*2||p.bird.vy< -CLIMB_SPEED||p.bird.vy>FALL_SPEED||p.time<0||p.time>2000||p.distance<0||Math.abs(p.distance-p.time*SPEED)>.1||!Number.isInteger(p.score)||p.score<0||p.score>=state.course.length||p.lastPassed!==p.score-1)return null;
    const passed=state.course.filter(g=>g.x-p.distance+GATE_WIDTH/2<p.bird.x-RADIUS).length;if(passed!==p.score)return null;
    Object.assign(state,p,{bird:{...p.bird},phase:'running'});step(state,0);if(state.phase!=='running')return null;state.phase='paused';return {state,data};
  }catch{return null;}
}

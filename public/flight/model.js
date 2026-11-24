export const WIDTH=480, HEIGHT=560, RADIUS=11, SPEED=118, SPACING=204, GATE_WIDTH=62;
export const ASSETS={
  NVDA:{name:'NVIDIA',zh:'英伟达',pilot:'Jensen Huang',pilotZh:'黄仁勋',color:'#b8f36b',sprite:0},
  TSLA:{name:'Tesla',zh:'特斯拉',pilot:'Elon Musk',pilotZh:'马斯克',color:'#ff7480',sprite:1},
  AAPL:{name:'Apple',zh:'苹果',pilot:'Tim Cook',pilotZh:'蒂姆·库克',color:'#a8ddff',sprite:2},
  BTC:{name:'Bitcoin',zh:'比特币',pilot:'Bitcoin cat',pilotZh:'比特猫',color:'#ffc16b',sprite:3},
};
export const MONTHS=['2024-01','2024-02','2024-03'];
export function validateMarketData(data){
  if(data?.version!==1||!Array.isArray(data.assets))throw Error('Invalid market data');
  for(const symbol of Object.keys(ASSETS)){
    const asset=data.assets.find(a=>a.symbol===symbol);
    if(!asset||asset.interval!=='1d'||!asset.sourceUrl?.startsWith('https://'))throw Error('Missing asset');
    let last='';for(const c of asset.candles){
      if(!/^2024-0[1-3]-\d{2}$/.test(c.date)||c.date<=last||![c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite)||Math.min(c.open,c.high,c.low,c.close)<=0||c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close)||c.volume<0)throw Error('Invalid candle');
      last=c.date;
    }
    for(const month of MONTHS)if(asset.candles.filter(c=>c.date.startsWith(month)).length<18)throw Error('Incomplete course');
  }
  return data;
}
export function makeCourse(asset,month){
  const candles=asset.candles.filter(c=>c.date.startsWith(month));
  if(!candles.length)throw Error('No candles in course');
  const min=Math.min(...candles.map(c=>c.low)),max=Math.max(...candles.map(c=>c.high)),range=Math.max(max-min,max*.001);
  const priceY=price=>HEIGHT*.78-(price-min)/range*(HEIGHT*.56);
  const bodies=candles.map(c=>Math.abs(c.close-c.open)),largest=Math.max(...bodies,range*.001);
  // Keep chronological OHLC values unchanged. Only the playable geometry is scaled.
  return candles.map((c,i)=>{
    const center=priceY((c.open+c.close)/2),gap=142+Math.sqrt(bodies[i]/largest)*52;
    const top=center-gap/2,bottom=center+gap/2;
    const wickLength=amount=>amount>0?Math.max(12,Math.min(76,amount/range*HEIGHT*.8)):0;
    return {...c,index:i,center,gap,top,bottom,highY:top-wickLength(c.high-Math.max(c.open,c.close)),lowY:bottom+wickLength(Math.min(c.open,c.close)-c.low),rising:c.close>=c.open,x:WIDTH-54+i*SPACING};
  });
}
export function createFlight(course){return {phase:'ready',course,bird:{x:112,y:course[0]?.center??HEIGHT/2,vy:0},distance:0,time:0,score:0,reason:null,lastPassed:-1};}
export function flap(s){if(s.phase==='ready')s.phase='running';if(s.phase==='running')s.bird.vy=-292;return s;}
export function nextGate(s){return s.course.find(g=>g.x-s.distance+GATE_WIDTH/2>=s.bird.x-RADIUS)||s.course.at(-1);}
export function step(s,dt){
  if(s.phase!=='running')return s;
  dt=Math.min(.025,Math.max(0,dt));s.time+=dt;s.distance+=SPEED*dt;s.bird.vy=Math.min(440,s.bird.vy+850*dt);s.bird.y+=s.bird.vy*dt;
  if(s.bird.y-RADIUS<=20||s.bird.y+RADIUS>=HEIGHT-20){s.phase='crashed';s.reason='edge';return s;}
  for(const g of s.course){
    const x=g.x-s.distance,left=x-GATE_WIDTH/2,right=x+GATE_WIDTH/2;
    if(s.bird.x+RADIUS>left&&s.bird.x-RADIUS<right&&(s.bird.y-RADIUS<g.top||s.bird.y+RADIUS>g.bottom)){s.phase='crashed';s.reason='candle';return s;}
    if(g.index>s.lastPassed&&right<s.bird.x-RADIUS){s.lastPassed=g.index;s.score=g.index+1;}
  }
  if(s.score===s.course.length)s.phase='cleared';return s;
}

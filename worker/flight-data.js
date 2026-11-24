const DAY=86400,SYMBOLS=['NVDA','TSLA','AAPL','BTC'];
export function calendarDate(now,timeZone='Asia/Singapore'){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=k=>parts.find(p=>p.type===k).value;return `${part('year')}-${part('month')}-${part('day')}`;
}
export function rollingWindow(now=new Date()){
  const end=calendarDate(now),[y,m,d]=end.split('-').map(Number),day=Math.min(d,new Date(Date.UTC(y-1,m,0)).getUTCDate());
  return {windowStart:`${y-1}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,windowEnd:end};
}
const iso=seconds=>new Date(seconds*1000).toISOString().slice(0,10);
const rounded=n=>Math.round(n*10000)/10000;
export function checkCandles(candles,window,symbol){
  const minimum=symbol==='BTC'?300:180;
  if(!Array.isArray(candles)||candles.length<minimum||candles.length>366)throw Error('Incomplete annual history');
  let previous='';for(const c of candles){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||c.date<=previous||c.date<window.windowStart||c.date>window.windowEnd||![c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite)||c.low<=0||c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close)||c.volume<0)throw Error('Invalid historical candle');previous=c.date;
  }
  if(Date.parse(candles[0].date)-Date.parse(window.windowStart)>10*DAY*1000||Date.parse(window.windowEnd)-Date.parse(candles.at(-1).date)>10*DAY*1000)throw Error('Historical range is stale or truncated');
  return candles;
}
export function parseYahoo(body,symbol,window,now){
  const d=body?.chart?.result?.[0],q=d?.indicators?.quote?.[0];if(!d||!q||d.meta?.symbol!==symbol)throw Error('Invalid equity response');
  const nyToday=calendarDate(now,'America/New_York'),regular=d.meta?.currentTradingPeriod?.regular,closeTime=regular?.end,nowSeconds=now.getTime()/1000;
  const nextSession=Number.isFinite(regular?.start)&&calendarDate(new Date(regular.start*1000),'America/New_York')>nyToday;
  const candles=(d.timestamp||[]).map((ts,i)=>({date:iso(ts),open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volume:q.volume?.[i]}))
    .filter(c=>c.date>=window.windowStart&&c.date<=window.windowEnd&&c.date<=nyToday&&(c.date<nyToday||nextSession||(Number.isFinite(closeTime)&&nowSeconds>=closeTime))&&[c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite))
    .map(c=>({...c,open:rounded(c.open),high:rounded(c.high),low:rounded(c.low),close:rounded(c.close)})).sort((a,b)=>a.date.localeCompare(b.date));
  return checkCandles(candles,window,symbol);
}
export function parseCoinbase(rows,window,now){
  if(!Array.isArray(rows))throw Error('Invalid Bitcoin response');const byDate=new Map();
  for(const row of rows){if(!Array.isArray(row)||row.length<6)continue;const [ts,low,high,open,close,volume]=row;if(!Number.isFinite(ts)||ts+DAY>now.getTime()/1000)continue;const date=iso(ts);if(date<window.windowStart||date>window.windowEnd)continue;byDate.set(date,{date,open,high,low,close,volume});}
  return checkCandles([...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)),window,'BTC');
}
export async function fetchFlightAsset(symbol,{now=new Date(),fetcher=fetch}={}){
  if(!SYMBOLS.includes(symbol))throw Error('Unknown asset');const window=rollingWindow(now),start=Date.parse(window.windowStart+'T00:00:00Z')/1000,end=Math.floor(now.getTime()/1000);
  async function get(url){const r=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Market source unavailable ('+r.status+')');return r.json();}
  let asset;
  if(symbol==='BTC'){
    const urls=[];for(let from=start;from<end;from+=280*DAY){const to=Math.min(end,from+280*DAY);urls.push(`https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=${new Date(from*1000).toISOString()}&end=${new Date(to*1000).toISOString()}`);}
    const chunks=await Promise.all(urls.map(get));asset={symbol,source:'Coinbase Exchange',sourceUrl:'https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles',requestUrls:urls,interval:'1d',candles:parseCoinbase(chunks.flat(),window,now)};
  }else{
    const url=`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${start}&period2=${end}&interval=1d`;
    const body=await get(url);asset={symbol,source:'Yahoo Finance',sourceUrl:`https://finance.yahoo.com/quote/${symbol}/history/?period1=${start}&period2=${end}`,requestUrls:[url],interval:'1d',candles:parseYahoo(body,symbol,window,now)};
  }
  return {version:2,...window,fetchedAt:now.toISOString(),asOf:asset.candles.at(-1).date,isFallback:false,asset};
}
export async function flightMarketResponse(request,env,{now=new Date(),fetcher=fetch,cache=globalThis.caches?.default}={}){
  if(request.method!=='GET')return Response.json({error:'Method not allowed'},{status:405,headers:{Allow:'GET'}});
  const url=new URL(request.url),symbol=url.searchParams.get('symbol')||'NVDA';
  if(!SYMBOLS.includes(symbol))return Response.json({error:'Unknown asset'},{status:400});
  const window=rollingWindow(now),keyURL=new URL('/api/flight/market',url);keyURL.searchParams.set('symbol',symbol);keyURL.searchParams.set('date',window.windowEnd);const key=new Request(keyURL);
  try{const hit=await cache?.match(key);if(hit)return hit;}catch{}
  let data;
  try{data=await fetchFlightAsset(symbol,{now,fetcher});}
  catch{
    try{
      const r=await env.ASSETS.fetch(new Request(new URL('/flight/market-data.json',url)));if(!r.ok)throw Error('Snapshot missing');const snapshot=await r.json(),asset=snapshot.assets.find(a=>a.symbol===symbol);
      if(snapshot.version!==2||!asset)throw Error('Snapshot missing');checkCandles(asset.candles,snapshot,symbol);
      data={version:2,windowStart:snapshot.windowStart,windowEnd:snapshot.windowEnd,fetchedAt:snapshot.fetchedAt,asOf:asset.candles.at(-1).date,isFallback:true,asset};
    }catch{return Response.json({error:'Latest market data is unavailable. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});}
  }
  const response=Response.json(data,{headers:{'Cache-Control':data.isFallback?'public, max-age=120':'public, max-age=900'}});
  try{await cache?.put(key,response.clone());}catch{}
  return response;
}

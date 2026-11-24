import fs from 'node:fs/promises';
import {fetchFlightAsset,rollingWindow} from '../worker/flight-data.js';
const now=new Date(),results=await Promise.all(['NVDA','TSLA','AAPL','BTC'].map(symbol=>fetchFlightAsset(symbol,{now})));
const snapshot={version:2,...rollingWindow(now),fetchedAt:now.toISOString(),assets:results.map(r=>r.asset)};
await fs.writeFile('public/flight/market-data.json',JSON.stringify(snapshot,null,2)+'\n');
for(const r of results)console.log(`${r.asset.symbol}: ${r.asset.candles.length} daily candles, ${r.asset.candles[0].date} to ${r.asOf}`);
console.log(`Rolling window: ${snapshot.windowStart} to ${snapshot.windowEnd}`);

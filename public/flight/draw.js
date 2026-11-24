import {WIDTH,HEIGHT,BIRD_X,GATE_WIDTH,SPACING,PRICE_SCALE,ASSETS} from './model.js';
import {t} from '../i18n.js';
export function makeRenderer(canvas){
  const ctx=canvas.getContext('2d',{alpha:false}),sheet=new Image();sheet.src='/assets/flight-pilots.png';let particles=[],viewWidth=WIDTH;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const targetWidth=()=>{const box=canvas.parentElement.getBoundingClientRect();return box.height?Math.max(640,Math.round(HEIGHT*box.width/box.height)):WIDTH;};
  function resize(){viewWidth=targetWidth();if(canvas.width!==viewWidth||canvas.height!==HEIGHT){canvas.width=viewWidth;canvas.height=HEIGHT;}ctx.imageSmoothingEnabled=false;}
  const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);resize();window.addEventListener('resize',resize);
  function burst(x,y,color,count=10){if(reduce.matches)return;for(let i=0;i<count;i++)particles.push({x,y,vx:-15+(Math.random()-.5)*85,vy:(Math.random()-.5)*80,life:.25+Math.random()*.25,color,size:2});}
  function pilot(symbol,x,y,angle){
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(angle);ctx.imageSmoothingEnabled=false;
    if(sheet.complete&&sheet.naturalWidth){const i=ASSETS[symbol].sprite,w=sheet.naturalWidth/2,h=sheet.naturalHeight/2;ctx.drawImage(sheet,(i%2)*w,Math.floor(i/2)*h,w,h,-19,-19,38,38);}
    else{ctx.fillStyle=ASSETS[symbol].color;ctx.fillRect(-10,-10,20,20);ctx.fillStyle='#111b25';ctx.fillRect(-5,-4,3,3);ctx.fillRect(3,-4,3,3);}
    ctx.restore();
  }
  const labelPrice=p=>p>=1000?'$'+(p/1000).toFixed(1)+'k':'$'+p.toFixed(p<20?1:0);
  function draw(state,symbol,dt=0){
    if(viewWidth!==targetWidth())resize();
    const accent=ASSETS[symbol].color,travel=state.distance,cam=state.cameraY,offset=viewWidth*.18-BIRD_X,px=state.bird.x+offset,mobile=canvas.clientHeight<400;
    const visible=state.course.slice(Math.max(0,state.score-2),state.score+Math.ceil(viewWidth/SPACING)+3).filter(g=>g.x-travel+offset>-90&&g.x-travel+offset<viewWidth+90),reference=state.course[0]?.reference||100,ticks=[];
    ctx.fillStyle='#0b1420';ctx.fillRect(0,0,viewWidth,HEIGHT);
    // The price grid scrolls with the same linear world axis as the candles.
    const raw=reference*.05,power=10**Math.floor(Math.log10(raw)),tick=[1,2,5,10].find(n=>n*power>=raw)*power;
    const lowPrice=reference*(1-(cam+HEIGHT)/PRICE_SCALE),highPrice=reference*(1-cam/PRICE_SCALE);
    ctx.lineWidth=1;ctx.font=`${mobile?21:14}px monospace`;ctx.textAlign='right';
    for(let price=Math.ceil(lowPrice/tick)*tick;price<=highPrice;price+=tick){
      const y=Math.round((1-price/reference)*PRICE_SCALE-cam);ctx.strokeStyle='#21313e';ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(viewWidth,y+.5);ctx.stroke();
      if(price>0)ticks.push({price,y});
    }
    ctx.strokeStyle='#172735';ctx.beginPath();for(let x=offset-(travel%112);x<viewWidth;x+=112){ctx.moveTo(Math.round(x)+.5,0);ctx.lineTo(Math.round(x)+.5,HEIGHT);}ctx.stroke();
    ctx.strokeStyle='#436558';ctx.lineWidth=1;ctx.setLineDash([3,7]);ctx.beginPath();visible.forEach((g,i)=>{const x=g.x-travel+offset,y=g.center-cam;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();ctx.setLineDash([]);
    for(const g of visible){
      const x=Math.round(g.x-travel+offset),left=x-GATE_WIDTH/2,top=g.top-cam,bottom=g.bottom-cam,color=g.rising?'#9ce7a2':'#ff8795',next=g.index===state.score;
      // Obstacle columns extend through world space, not to a fixed floor.
      ctx.fillStyle=g.rising?'#19362f':'#372533';ctx.fillRect(left,0,GATE_WIDTH,Math.max(0,Math.min(HEIGHT,top)));ctx.fillRect(left,Math.max(0,bottom),GATE_WIDTH,Math.max(0,HEIGHT-Math.max(0,bottom)));
      ctx.fillStyle=g.rising?'#2a4c40':'#513044';for(let y=-(Math.round(cam)%22);y<HEIGHT;y+=22){if(y+2<top||y>bottom)ctx.fillRect(left+3,y,GATE_WIDTH-6,2);}
      ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,Math.max(-2,g.highY-cam));ctx.lineTo(x,Math.min(HEIGHT+2,top));ctx.moveTo(x,Math.max(-2,bottom));ctx.lineTo(x,Math.min(HEIGHT+2,g.lowY-cam));ctx.stroke();
      if(bottom>=0&&top<=HEIGHT){
        const y=Math.max(-1,top),h=Math.max(1,Math.min(HEIGHT+1,bottom)-y);ctx.fillStyle=color;ctx.globalAlpha=next?.22:.09;ctx.fillRect(left,y,GATE_WIDTH,h);ctx.globalAlpha=1;
        ctx.strokeStyle=color;ctx.lineWidth=next?2:1;ctx.strokeRect(left-1,y,GATE_WIDTH+2,h);
        if(next){ctx.fillStyle=accent;ctx.fillRect(left-7,(top+bottom)/2-2,3,4);}
      }else{
        const up=bottom<0,y=up?17:HEIGHT-43;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y+(up?-7:7));ctx.lineTo(x-5,y+(up?2:-2));ctx.lineTo(x+5,y+(up?2:-2));ctx.fill();
      }
      if(!mobile||g.index%2===0||next){ctx.fillStyle=next?'#edf4e3':'#8da49c';ctx.font=`${mobile?19:13}px monospace`;ctx.textAlign='center';ctx.fillText(g.date.slice(5).replace('-','/'),x,HEIGHT-10);}
    }
    // A small pilot with generous collision forgiveness around its centre.
    const by=state.bird.y-cam+(state.phase==='ready'&&!reduce.matches?Math.sin(performance.now()/350)*2:0);
    if(state.phase==='running'&&state.flapFlash>0){ctx.fillStyle=accent;ctx.fillRect(px-4,by+13,3,reduce.matches?5:5+Math.floor(state.flapFlash*50));}
    pilot(symbol,px,by,Math.max(-.15,Math.min(.2,state.bird.vy/1600)));
    ctx.fillStyle='#ffffff';ctx.fillRect(Math.round(px)-1,Math.round(by)-1,2,2);
    particles=particles.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0)return false;ctx.globalAlpha=Math.min(1,p.life*4);ctx.fillStyle=p.color;ctx.fillRect(Math.round(p.x+offset),Math.round(p.y-cam),p.size,p.size);return true;});ctx.globalAlpha=1;
    ctx.fillStyle='#0000000a';for(let y=0;y<HEIGHT;y+=4)ctx.fillRect(0,y,viewWidth,1);
    ctx.fillStyle='#0b1420e8';ctx.fillRect(viewWidth-(mobile?88:64),0,mobile?88:64,HEIGHT);ctx.fillStyle='#aec2c5';ctx.font=`${mobile?21:14}px monospace`;ctx.textAlign='right';for(const {price,y} of ticks)ctx.fillText(labelPrice(price),viewWidth-10,y-7);
    if(state.phase==='ready'){ctx.font=`${mobile?21:14}px monospace`;ctx.textAlign='left';ctx.fillStyle='#90a7a3';ctx.fillText(t('CLICK OR SPACE TO FLAP','点击或空格跳跃'),18,27);}
  }
  return {draw,burst,clear:()=>{particles=[];},destroy:()=>{observer.disconnect();window.removeEventListener('resize',resize);}};
}

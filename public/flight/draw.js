import {WIDTH,HEIGHT,GATE_WIDTH,ASSETS} from './model.js';
import {t} from '../i18n.js';
export function makeRenderer(canvas){
  const ctx=canvas.getContext('2d',{alpha:false});canvas.width=WIDTH;canvas.height=HEIGHT;ctx.imageSmoothingEnabled=false;
  const sheet=new Image();sheet.src='/assets/flight-pilots.png';let particles=[];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  function burst(x,y,color,count=10){if(reduce.matches)return;for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*145,vy:(Math.random()-.5)*160,life:.35+Math.random()*.25,color,size:2+Math.floor(Math.random()*3)});}
  function pilot(symbol,x,y,size,angle=0){
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(angle);ctx.imageSmoothingEnabled=false;
    if(sheet.complete&&sheet.naturalWidth){const i=ASSETS[symbol].sprite,w=sheet.naturalWidth/2,h=sheet.naturalHeight/2;ctx.drawImage(sheet,(i%2)*w,Math.floor(i/2)*h,w,h,-size/2,-size/2,size,size);}
    else{ctx.fillStyle=ASSETS[symbol].color;ctx.fillRect(-18,-18,36,36);ctx.fillStyle='#111b25';ctx.fillRect(-9,-5,5,5);ctx.fillRect(6,-5,5,5);ctx.fillRect(-5,8,13,3);}
    ctx.restore();
  }
  function draw(state,symbol,dt=0){
    const accent=ASSETS[symbol].color,elapsed=state.time,travel=state.distance;
    ctx.fillStyle='#0c1420';ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.strokeStyle='#1c2b39';ctx.lineWidth=1;ctx.beginPath();for(let y=40;y<HEIGHT;y+=40){ctx.moveTo(0,y+.5);ctx.lineTo(WIDTH,y+.5);}for(let x=-(travel*.16%40);x<WIDTH;x+=40){ctx.moveTo(Math.round(x)+.5,0);ctx.lineTo(Math.round(x)+.5,HEIGHT);}ctx.stroke();
    // Fixed city skyline and a faint price trace: decoration never changes collisions.
    ctx.fillStyle='#132431';for(let i=0;i<16;i++){const x=i*38-(travel*.08%38),h=24+(i*53%90);ctx.fillRect(x,HEIGHT-20-h,26,h);ctx.fillStyle='#213d46';for(let y=HEIGHT-28;y>HEIGHT-h;y-=14)ctx.fillRect(x+7,y,4,4);ctx.fillStyle='#132431';}
    ctx.strokeStyle='#31504d';ctx.lineWidth=2;ctx.beginPath();state.course.forEach((g,i)=>{const x=g.x-travel;if(i===0)ctx.moveTo(x,g.center);else ctx.lineTo(x,g.center);});ctx.stroke();
    for(const g of state.course){
      const x=Math.round(g.x-travel),left=x-GATE_WIDTH/2;if(left>WIDTH+20||left+GATE_WIDTH<0)continue;
      const color=g.rising?'#9ce7a2':'#ff8795',dark=g.rising?'#173c37':'#482a3b',top=Math.round(g.top),bottom=Math.round(g.bottom);
      ctx.fillStyle=dark;ctx.fillRect(left,20,GATE_WIDTH,top-20);ctx.fillRect(left,bottom,GATE_WIDTH,HEIGHT-20-bottom);
      ctx.fillStyle=g.rising?'#28564b':'#64394c';for(let y=25;y<HEIGHT-20;y+=14){if(y+3<top||y>bottom)ctx.fillRect(left+3,y,GATE_WIDTH-6,3);}
      ctx.fillStyle=color;ctx.fillRect(x-2,Math.max(25,Math.round(g.highY)-12),4,Math.max(0,top-Math.max(25,Math.round(g.highY)-12)));ctx.fillRect(x-2,bottom,4,Math.max(0,Math.min(HEIGHT-25,g.lowY+12)-bottom));
      ctx.globalAlpha=.08;ctx.fillStyle=color;ctx.fillRect(left,top,GATE_WIDTH,bottom-top);ctx.globalAlpha=1;
      ctx.fillStyle=color;ctx.fillRect(left-4,top-4,GATE_WIDTH+8,4);ctx.fillRect(left-4,bottom,GATE_WIDTH+8,4);
      ctx.fillRect(left-4,top,4,9);ctx.fillRect(left+GATE_WIDTH,top,4,9);ctx.fillRect(left-4,bottom-9,4,9);ctx.fillRect(left+GATE_WIDTH,bottom-9,4,9);
      ctx.fillStyle='#e3eee7';ctx.font='12px monospace';ctx.textAlign='center';ctx.fillText(g.date.slice(5).replace('-','/'),x,HEIGHT-5);
      if(g.index===state.lastPassed+1){ctx.fillStyle=color;ctx.font='bold 15px monospace';ctx.fillText(g.rising?t('UP','涨'):t('DOWN','跌'),x,top-14);}
    }
    ctx.fillStyle='#253442';ctx.fillRect(0,0,WIDTH,20);ctx.fillRect(0,HEIGHT-20,WIDTH,20);ctx.fillStyle=accent;for(let x=0;x<WIDTH;x+=22){ctx.fillRect(x,16,10,4);ctx.fillRect(x,HEIGHT-20,10,4);}
    const by=state.bird.y+(state.phase==='ready'&&!reduce.matches?Math.sin(performance.now()/350)*5:0);
    const wing=state.phase==='running'&&Math.floor(elapsed*10)%2===0;
    ctx.fillStyle='#e8efcf';ctx.fillRect(state.bird.x-27,by+(wing?-3:8),12,5);ctx.fillRect(state.bird.x-32,by+(wing?-8:12),8,5);
    pilot(symbol,state.bird.x,by,82,Math.max(-.22,Math.min(.45,state.bird.vy/800)));
    if(state.phase==='running'&&!reduce.matches&&Math.floor(elapsed*40)%3===0)particles.push({x:state.bird.x-27,y:by+8,vx:-35,vy:8,life:.15,color:accent,size:3});
    particles=particles.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0)return false;ctx.globalAlpha=Math.min(1,p.life*4);ctx.fillStyle=p.color;ctx.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size);return true;});ctx.globalAlpha=1;
    // Quiet scanlines retain the handheld texture without a flashing overlay.
    ctx.fillStyle='#00000012';for(let y=21;y<HEIGHT-20;y+=4)ctx.fillRect(0,y,WIDTH,1);
  }
  return {draw,burst,clear:()=>{particles=[];}};
}

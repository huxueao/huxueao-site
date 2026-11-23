export function createEffects() {
  const layer=document.createElement('div');layer.className='pixel-effects';layer.setAttribute('aria-hidden','true');document.body.append(layer);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function burst(rect,kind='dig') {
    if(reduced.matches||!rect)return;
    const colors={dig:['#ba8941','#725d39','#ddd19b'],collect:['#b4d96b','#e8d582','#ffffff'],attack:['#d98171','#aa4c4d','#f4d597'],play:['#7eadd1','#d6e5ee','#faf8ed']};
    const palette=colors[kind]||colors.dig;
    for(let i=0;i<12;i++) {
      const bit=document.createElement('i');bit.className='pixel-particle';bit.style.background=palette[i%palette.length];bit.style.left=`${rect.left+rect.width/2}px`;bit.style.top=`${rect.top+rect.height/2}px`;layer.append(bit);
      const angle=(i/12)*Math.PI*2, reach=24+(i%4)*12;
      const animation=bit.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(${Math.round(Math.cos(angle)*reach)}px,${Math.round(Math.sin(angle)*reach-8)}px) scale(.5)`,opacity:0}],{duration:440+(i%3)*80,easing:'steps(8,end)'});
      animation.onfinish=()=>bit.remove();
    }
  }
  function flash(node,kind='hit') {if(reduced.matches||!node)return;node.classList.add('fx-'+kind);node.addEventListener('animationend',()=>node.classList.remove('fx-'+kind),{once:true});}
  return {burst,flash,destroy:()=>layer.remove()};
}

export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeLink(value){try{if(/^\/(?!\/)[a-zA-Z0-9_./#?-]+$/.test(value))return value;const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'#';}catch{return '#';}}
function inline(text){
  const parts=[];
  text=text.replace(/`([^`]+)`/g,(_,c)=>{parts.push(`<code>${escapeHTML(c)}</code>`);return `\u0000${parts.length-1}\u0000`;});
  text=escapeHTML(text).replace(/\[([^\]]+)\]\(([^\s)]+)\)/g,(_,label,url)=>`<a href="${escapeHTML(safeLink(url.replace(/&amp;/g,'&')))}" rel="noopener noreferrer">${label}</a>`).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
  return text.replace(/\u0000(\d+)\u0000/g,(_,i)=>parts[Number(i)]||'');
}
// Deliberately small Markdown subset; raw HTML is always escaped.
export function markdown(source=''){
  const lines=source.replace(/\r\n/g,'\n').split('\n');let out='',paragraph=[],list=null,code=null;
  const flush=()=>{if(paragraph.length){out+=`<p>${inline(paragraph.join(' '))}</p>`;paragraph=[];}if(list){out+=`</${list}>`;list=null;}};
  for(const line of lines){
    if(line.startsWith('```')){if(code!==null){out+=`<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`;code=null;}else{flush();code=[];}continue;}
    if(code!==null){code.push(line);continue;}
    if(!line.trim()){flush();continue;}
    const heading=line.match(/^(#{1,3})\s+(.+)/);if(heading){flush();out+=`<h${heading[1].length+1}>${inline(heading[2])}</h${heading[1].length+1}>`;continue;}
    if(line.startsWith('> ')){flush();out+=`<blockquote>${inline(line.slice(2))}</blockquote>`;continue;}
    const item=line.match(/^(?:([-*])|\d+\.)\s+(.+)/);if(item){const type=item[1]?'ul':'ol';if(list!==type){flush();list=type;out+=`<${type}>`;}out+=`<li>${inline(item[2])}</li>`;continue;}
    if(/^---+$/.test(line)){flush();out+='<hr>';continue;}
    if(list)flush();paragraph.push(line);
  }
  flush();if(code!==null)out+=`<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`;return out;
}
export const mascot=(className='')=>`<svg class="mascot ${className}" viewBox="0 0 140 80" aria-hidden="true"><path class="face-outline" d="M8 8 L45 7.4 L91 8 L132 7 L133 39 L132 71 L73 70.5 L7 72 L8 38 Z"/><g class="eyes-normal"><circle cx="49" cy="27" r="2.4"/><circle cx="100" cy="27" r="2.4"/></g><g class="eyes-hover"><path d="M40 28 L57 25 M91 25 L109 28"/><path class="brows" d="M39 19 L56 16 M92 16 L110 19"/></g><g class="eyes-drag"><path d="M40 24 L58 30 M40 30 L58 24 M91 24 L109 30 M91 30 L109 24"/><path class="brows" d="M39 17 L59 15 M91 15 L111 17"/></g><path d="M77 36 L58 53 L80 53"/></svg>`;
export const date=(value,locale='en')=>value?new Intl.DateTimeFormat(locale==='zh'?'zh-CN':'en',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value)):'';

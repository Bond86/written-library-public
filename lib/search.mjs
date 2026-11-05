import {escape,normalize} from './text.mjs';
const decode=value=>value.replace(/&(?:amp|lt|gt|quot|#39|#x[0-9a-f]+|#\d+);/giu,entity=>{
  const names={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"};
  if(names[entity])return names[entity];
  const hex=entity.startsWith('&#x');
  const n=parseInt(entity.slice(hex?3:2,-1),hex?16:10);
  return n<=0x10ffff?String.fromCodePoint(n):'';
});
export function presentResult(data){
  const original=data.meta.original||'';
  const marked=decode(data.excerpt);
  const plain=marked.replace(/<\/?mark>/gu,'');
  const start=normalize(original).indexOf(plain);
  if(start<0)return {title:data.meta.display_title||'',snippetHtml:escape(original.slice(0,180)),anchor:''};
  const marks=/[\u0610-\u061a\u0640\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7-\u06e8\u06ea-\u06ed\u08d3-\u08ff]/gu;
  const removed=original.matchAll(marks);
  let next=removed.next().value,shift=0;
  function offset(n){
    if(!n)return 0;
    while(next&&next.index<=n+shift){shift+=next[0].length;next=removed.next().value;}
    return n+shift;
  }
  const begin=offset(start);
  let position=start;
  let matchedAt=null;
  const snippet=marked.split(/(<\/?mark>)/gu).map(piece=>{
    if(piece==='<mark>'){matchedAt??=offset(position);return piece;}
    if(piece==='</mark>')return piece;
    const value=escape(original.slice(offset(position),offset(position+piece.length)));
    position+=piece.length;
    return value;
  }).join('');
  const anchors=JSON.parse(data.meta.anchors||'[]');
  const anchor=anchors.findLast(([index])=>index<=(matchedAt??begin))?.[1]||'';
  return {title:data.meta.display_title||'',snippetHtml:(start?'…':'')+snippet+(start+plain.length<normalize(original).length?'…':''),anchor};
}


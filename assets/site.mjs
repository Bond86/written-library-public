import {normalize} from '../lib/text.mjs';
import {presentResult} from '../lib/search.mjs';

const base=document.body.dataset.base;
const form=document.querySelector('#search-form');
if(form){
 const query=form.elements.q, type=form.elements.type;
 const status=document.querySelector('#search-status'),list=document.querySelector('#results'),more=document.querySelector('#more-results');
 const params=new URL(location.href).searchParams;
 query.value=params.get('q')||'';
 type.value=params.get('type')||'';
 let pagefindPromise,request=0,results=[],offset=0;
 const labels={article:'مقالات',lecture:'محاضرات',book:'كتب'};
 const engine=()=>pagefindPromise??=import(base+'pagefind/pagefind.js').then(async api=>{
  await api.options({baseUrl:base,excerptLength:24});
  return api;
 });
 async function render(){
  const thisRequest=request;
  const next=results.slice(offset,offset+8);
  const data=await Promise.all(next.map(result=>result.data()));
  if(thisRequest!==request)return;
  for(const item of data){
   const display=presentResult(item);
   const article=document.createElement('article');article.className='search-hit';
   const small=document.createElement('small');small.textContent=labels[item.meta.type]+' · '+item.meta.heading;
   const heading=document.createElement('h2'),link=document.createElement('a');
   const href=new URL(item.url,location.origin);
   if(href.origin!==location.origin||!href.pathname.startsWith(base))continue;
   href.searchParams.set('q',query.value);
   if(display.anchor)href.hash=display.anchor;
   link.href=href.href;link.textContent=display.title;heading.append(link);
   const snippet=document.createElement('p');snippet.innerHTML=display.snippetHtml;
   article.append(small,heading,snippet);list.append(article);
  }
  offset+=next.length;more.hidden=offset>=results.length;
 }
 async function search(){
  const current=++request;
  const text=query.value.trim().slice(0,140);
  list.replaceChildren();more.hidden=true;
  if(!text){status.textContent='اكتب كلمة أو عبارة للبحث.';return;}
  status.textContent='جارٍ البحث…';
  const url=new URL(location.href);url.search='';
  url.searchParams.set('q',text);if(type.value)url.searchParams.set('type',type.value);
  history.replaceState(null,'',url);
  try{
   const api=await engine();
   const options=type.value?{filters:{type:type.value}}:{};
   const response=await api.search(normalize(text),options);
   if(current!==request)return;
   results=response.results;offset=0;
   status.textContent=results.length?'عُثر على '+results.length+' قسمًا مطابقًا.':'لا توجد نتائج مطابقة.';
   await render();
  }catch{if(current===request)status.textContent='تعذر تحميل البحث. أعد المحاولة بعد اكتمال تحميل الموقع.';}
 }
 form.addEventListener('submit',event=>{event.preventDefault();search();});
 type.addEventListener('change',search);
 query.addEventListener('focus',()=>engine().catch(()=>{}),{once:true});
 more.addEventListener('click',()=>render());
 if(query.value)search();
}
const prose=document.querySelector('.prose');
if(prose){
 const classes=['reading-small','','reading-large','reading-largest'];
 let font=1;
 try{font=Math.max(0,Math.min(3,Number(localStorage.getItem('reading-size')??1)));}catch{}
 function apply(){
  document.body.classList.remove(...classes.filter(Boolean));
  if(classes[font])document.body.classList.add(classes[font]);
 }
 apply();
 for(const button of document.querySelectorAll('[data-font]'))button.addEventListener('click',()=>{
  font=Math.max(0,Math.min(3,font+Number(button.dataset.font)));
  apply();try{localStorage.setItem('reading-size',String(font));}catch{}
 });
 if(matchMedia('(max-width:640px)').matches){
  const toc=document.querySelector('.reader-toc details');
  if(toc)toc.open=false;
 }
 const q=new URL(location.href).searchParams.get('q');
 if(q){
  const terms=[...new Set((normalize(q).match(/[\p{L}\p{N}]+/gu)||[]).slice(0,10))].sort((a,b)=>b.length-a.length);
  const root=location.hash?document.getElementById(decodeURIComponent(location.hash.slice(1))):prose;
  if(root&&prose.contains(root)){
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
   let count=0;
   for(const node of nodes){
    if(count>1500)break;
    const original=node.data,clean=normalize(original);
    const positions=[];
    const offsets=[0];
    for(let at=0,index=0;at<original.length;){
     const char=String.fromCodePoint(original.codePointAt(at));at+=char.length;
     const n=normalize(char);
     if(n)for(let j=0;j<n.length;j++)offsets[++index]=at;
     else if(index)offsets[index]=at;
    }
    let at=0;
    while(at<clean.length){
     const term=terms.find(t=>clean.startsWith(t,at));
     if(term){positions.push([offsets[at],offsets[at+term.length]]);at+=term.length;}else at++;
    }
    if(!positions.length)continue;
    const replacement=document.createDocumentFragment();let end=0;
    for(const [a,b] of positions){
     replacement.append(original.slice(end,a));const mark=document.createElement('mark');mark.textContent=original.slice(a,b);replacement.append(mark);end=b;count++;
    }
    replacement.append(original.slice(end));node.replaceWith(replacement);
   }
  }
 }
}


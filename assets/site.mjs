import {normalize} from '../lib/text.mjs';
import {presentResult} from '../lib/search.mjs';
import './book-reader.mjs';
import {paginateResults} from '../lib/pagination.mjs';

const base=document.body.dataset.base;
const form=document.querySelector('#search-form');
if(form){
 const query=form.elements.q,type=form.elements.type;
 const status=document.querySelector('#search-status'),list=document.querySelector('#results'),navigation=document.querySelector('#search-pagination');
 let pagefindPromise,request=0,renderRequest=0,results=[],activeQuery='',activeType='',currentPage=1;
 const labels={article:'مقالات',lecture:'محاضرات',book:'كتب'};
 const number=value=>String(value).replace(/\d/gu,d=>'٠١٢٣٤٥٦٧٨٩'[Number(d)]);
 const engine=()=>pagefindPromise??=import(base+'pagefind/pagefind.js').then(async api=>{await api.options({baseUrl:base,excerptLength:24});return api;});
 function pageUrl(page){
  const url=new URL(location.href);url.search='';url.hash='';
  if(activeQuery)url.searchParams.set('q',activeQuery);
  if(activeType)url.searchParams.set('type',activeType);
  if(page>1)url.searchParams.set('page',page);
  return url;
 }
 function updateUrl(page,mode){
  const url=pageUrl(page);
  if(url.href!==location.href)history[mode==='push'?'pushState':'replaceState'](null,'',url);
 }
 function pagination(state){
  const fragment=document.createDocumentFragment();
  function item(page,label,aria){
   const node=document.createElement(page?'a':'span');node.textContent=label;
   if(page){node.href=pageUrl(page).href;node.dataset.searchPage=String(page);node.setAttribute('aria-label',aria);if(page===state.page)node.setAttribute('aria-current','page');}
   else node.setAttribute('aria-disabled','true');
   fragment.append(node);
  }
  item(state.page>1?state.page-1:null,'→ السابق','الصفحة السابقة');
  for(const page of state.items){
   if(page===null){const gap=document.createElement('span');gap.textContent='…';gap.className='pagination-gap';fragment.append(gap);}
   else item(page,number(page),'الصفحة '+number(page));
  }
  item(state.page<state.pages?state.page+1:null,'التالي ←','الصفحة التالية');
  navigation.replaceChildren(fragment);navigation.dataset.page=String(state.page);navigation.dataset.totalPages=String(state.pages);navigation.dataset.totalResults=String(results.length);navigation.hidden=state.pages<=1;
 }
 async function render(page,mode='replace',scroll=false){
  const searchId=request,renderId=++renderRequest,state=paginateResults(results.length,page);
  currentPage=state.page;updateUrl(state.page,mode);
  list.replaceChildren();list.setAttribute('aria-busy','true');navigation.hidden=true;status.textContent='جارٍ تحميل النتائج…';
  try{
   const data=await Promise.all(results.slice(state.start,state.end).map(result=>result.data()));
   if(searchId!==request||renderId!==renderRequest)return;
   const fragment=document.createDocumentFragment();
   for(const item of data){
    const display=presentResult(item),article=document.createElement('article');article.className='search-hit';
    const small=document.createElement('small');small.textContent=labels[item.meta.type]+' · '+(display.pageNumber?'صفحة '+number(display.pageNumber):item.meta.heading);
    const heading=document.createElement('h2'),link=document.createElement('a');
    const href=new URL(display.pageUrl||item.url,location.origin);
    if(href.origin!==location.origin||!href.pathname.startsWith(base))continue;
    href.searchParams.set('q',activeQuery);if(display.pageAnchor||display.anchor)href.hash=display.pageAnchor||display.anchor;
    link.href=href.href;link.textContent=display.title;heading.append(link);
    const snippet=document.createElement('p');snippet.innerHTML=display.snippetHtml;
    article.append(small,heading,snippet);fragment.append(article);
   }
   list.replaceChildren(fragment);pagination(state);
   status.textContent=results.length?'عرض '+number(state.start+1)+'–'+number(state.end)+' من '+number(results.length)+' نتيجة · صفحة '+number(state.page)+' من '+number(state.pages)+'.':'لا توجد نتائج مطابقة.';
   if(scroll){status.focus({preventScroll:true});status.scrollIntoView({block:'start'});}
  }catch{if(searchId===request&&renderId===renderRequest)status.textContent='تعذر تحميل النتائج. أعد المحاولة أو حدّث الصفحة.';}
  finally{if(searchId===request&&renderId===renderRequest)list.setAttribute('aria-busy','false');}
 }
 async function search(page=1,mode='push'){
  const current=++request;++renderRequest;results=[];
  activeQuery=query.value.trim().slice(0,140);query.value=activeQuery;activeType=type.value;
  const searchText=activeQuery,searchType=activeType;
  list.replaceChildren();list.setAttribute('aria-busy','false');navigation.hidden=true;
  if(!activeQuery){updateUrl(1,mode);status.textContent='اكتب كلمة أو عبارة للبحث.';return;}
  status.textContent='جارٍ البحث…';
  try{
   const api=await engine(),response=await api.search(normalize(searchText),searchType?{filters:{type:searchType}}:{});
   if(current!==request)return;
   results=response.results;await render(page,mode);
  }catch{if(current===request)status.textContent='تعذر تحميل البحث. أعد المحاولة بعد اكتمال تحميل الموقع.';}
 }
 function restore(){const params=new URL(location.href).searchParams;query.value=params.get('q')||'';type.value=params.get('type')||'';search(params.get('page')||1,'replace');}
 form.addEventListener('submit',event=>{event.preventDefault();search();});
 type.addEventListener('change',()=>search());
 query.addEventListener('focus',()=>engine().catch(()=>{}),{once:true});
 navigation.addEventListener('click',event=>{
  const link=event.target.closest('a[data-search-page]');if(!link||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();const page=Number(link.dataset.searchPage);if(page!==currentPage)render(page,'push',true);
 });
 window.addEventListener('popstate',restore);restore();
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


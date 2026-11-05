import {normalize} from '../lib/text.mjs';
const legacyReader=document.querySelector('[data-legacy-book-map]');
if(legacyReader){
 const map=JSON.parse(legacyReader.dataset.legacyBookMap);
 let anchor='';try{anchor=decodeURIComponent(location.hash.slice(1));}catch{}
 const target=map.anchors[anchor]||map.start,url=new URL(target.url,location.origin);
 if(url.origin===location.origin&&url.pathname.startsWith(document.body.dataset.base+'documents/')){
  const query=new URL(location.href).searchParams.get('q');if(query)url.searchParams.set('q',query);
  if(target.anchor)url.hash=target.anchor;location.replace(url.href);
 }
}
const term=value=>normalize(value).replace(/[٠-٩]/gu,digit=>String(digit.charCodeAt(0)-0x660)).trim();
for(const scope of document.querySelectorAll('[data-toc-scope]')){
 const input=scope.querySelector('[data-toc-filter]');
 if(!input)continue;
 const entries=[...scope.querySelectorAll('[data-toc-entry]')].map(node=>({node,text:term(node.textContent)}));
 input.addEventListener('input',()=>{
  const words=term(input.value).split(/\s+/u).filter(Boolean);
  let visible=0;
  for(const entry of entries){entry.node.hidden=!words.every(word=>entry.text.includes(word));if(!entry.node.hidden)visible++;}
  for(const group of scope.querySelectorAll('[data-toc-group]')){
   group.hidden=![...group.querySelectorAll('[data-toc-entry]')].some(node=>!node.hidden);
   if(group.hasAttribute('data-toc-reveal'))group.open=words.length>0&&!group.hidden;
  }
  const empty=scope.querySelector('[data-toc-empty]');if(empty)empty.hidden=visible>0;
 });
}
for(const select of document.querySelectorAll('[data-book-jump]'))select.addEventListener('change',()=>{
 if(!select.value)return;
 const root=select.closest('[data-book-root]')?.dataset.bookRoot;
 const target=new URL(select.value,location.origin);
 if(root&&target.origin===location.origin&&target.pathname.startsWith(root))location.assign(target.href);
});
for(const link of document.querySelectorAll('[data-open-book-toc]'))link.addEventListener('click',()=>{
 const details=document.querySelector('#book-navigation details');if(details)details.open=true;
});
for(const paragraph of document.querySelectorAll('.book-reader .prose p[id]')){
 const marker=/^صفحة\s+PDF\s+(\d+)\s*$/u.exec(paragraph.textContent.trim());
 if(marker){
  paragraph.classList.add('source-page-label');
  if(paragraph.closest('[data-paged-reader]')){
   const folio=paragraph.nextElementSibling;
   if(folio?.tagName==='P'&&folio.textContent.trim()===marker[1])folio.classList.add('source-page-number');
  }
 }
}
const currentPage=document.querySelector('[data-paged-reader] .book-page');
if(currentPage&&![...currentPage.childNodes].some(node=>node.nodeType===3?node.textContent.trim():node.nodeType===1&&!node.matches('.source-page-label,.source-page-number')&&node.textContent.trim())){
 const notice=document.createElement('p');notice.className='page-empty-state';notice.textContent='لا يتوفر نص إضافي لهذه الصفحة في النسخة النصية.';currentPage.append(notice);
}
for(const form of document.querySelectorAll('[data-page-jump]'))form.addEventListener('submit',event=>{
 event.preventDefault();
 const input=form.querySelector('input'),value=term(input.value),maximum=Number(form.dataset.pageCount);
 const error=form.parentElement.parentElement.querySelector('[data-page-error]');
 if(!/^\d+$/u.test(value)||Number(value)<1||Number(value)>maximum){error.textContent='اختر رقم صفحة من ١ إلى '+String(maximum).replace(/\d/gu,d=>'٠١٢٣٤٥٦٧٨٩'[Number(d)]);error.hidden=false;input.setAttribute('aria-invalid','true');input.focus();return;}
 const destination=new URL(form.dataset.pageRoot+'p'+Number(value)+'/',location.origin);
 if(destination.origin===location.origin&&destination.pathname.startsWith(document.body.dataset.base+'documents/'))location.assign(destination.href);
});
if(document.querySelector('[data-paged-reader]'))document.addEventListener('keydown',event=>{
 if(document.querySelector('#site-content')?.hidden||event.defaultPrevented||event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey)return;
 if(event.target.closest('input,select,textarea,[contenteditable="true"]')||!getSelection()?.isCollapsed)return;
 const direction=event.key==='ArrowLeft'?'next':event.key==='ArrowRight'?'prev':null;
 const link=direction&&document.querySelector('.page-turner [rel='+direction+']');
 if(link){event.preventDefault();location.assign(link.href);}
});
const pagedReader=document.querySelector('[data-paged-reader]');
if(pagedReader)pagedReader.dataset.readerReady='true';
const sidebar=document.querySelector('.book-sidebar');
if(sidebar){
 const details=sidebar.querySelector('details'),current=sidebar.querySelector('[aria-current=page]');
 function revealCurrent(){
  if(!details?.open||!current)return;
  const bounds=sidebar.getBoundingClientRect(),active=current.getBoundingClientRect();
  if(active.top<bounds.top+45||active.bottom>bounds.bottom-12)sidebar.scrollTop+=active.top-bounds.top-60;
 }
 requestAnimationFrame(revealCurrent);
 details?.addEventListener('toggle',revealCurrent);
}

import {normalize} from '../lib/text.mjs';
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
 if(/^صفحة\s+PDF\s+\d+\s*$/u.test(paragraph.textContent.trim()))paragraph.classList.add('source-page-label');
}
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

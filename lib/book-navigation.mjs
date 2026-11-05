import {parseDocument} from 'htmlparser2';
import {escape} from './text.mjs';

export const number=value=>String(value).replace(/\d/gu,d=>'٠١٢٣٤٥٦٧٨٩'[Number(d)]);
export function cleanHeading(value){
 return String(value||'').replace(/\s*[.\u2026·]{3,}\s*[\d٠-٩]*\s*$/u,'').replace(/\s+/gu,' ').trim();
}
const text=node=>node.data??(node.children||[]).map(text).join('');
export function bookNavigation(doc){
 const sections=doc.sections.map((section,index)=>{
  const pages=[],headings=[];
  function walk(node){
   const id=node.attribs?.id;
   if(id){
    const value=text(node).trim();
    const page=/^صفحة\s+PDF\s+(\d+)\s*$/u.exec(value);
    if(page)pages.push({number:Number(page[1]),anchor:id,sectionId:section.id});
    if(/^h[1-4]$/u.test(node.name||''))headings.push({title:cleanHeading(value),anchor:id});
   }
   for(const child of node.children||[])walk(child);
  }
  walk(parseDocument(section.html));
  const sourceLabel=cleanHeading(section.heading);
  const generic=/^(?:النص|متابعة النص\s+\d+)$/u.test(sourceLabel);
  const label=generic?(section.chapter?cleanHeading(section.chapter)+' · متابعة '+number(index+1):'الجزء '+number(index+1)):sourceLabel;
  const range=pages.length?'الصفحات '+number(pages[0].number)+(pages.length>1?'–'+number(pages.at(-1).number):''):'';
  return {...section,label,range,pages,headings,index};
 });
 return {sections,pages:sections.flatMap(section=>section.pages)};
}
const sectionUrl=(doc,section,url)=>url(`documents/d${doc.id}/s${section.id}/`);
const pageUrl=(doc,page,url)=>url(`documents/d${doc.id}/s${page.sectionId}/#${page.anchor}`);
function entries(doc,model,url,current){
 return '<ol class="toc book-toc">'+model.sections.map(section=>'<li data-toc-entry><a href="'+sectionUrl(doc,section,url)+'"'+(current===section.id?' aria-current="page"':'')+'><span class="toc-number">'+number(section.index+1).padStart(2,'٠')+'</span><span><strong>'+escape(section.label)+'</strong><small>'+escape(section.range||'جزء من نص الكتاب')+'</small></span>'+(current===section.id?'<span class="toc-current">تقرأ الآن</span>':'')+'</a></li>').join('')+'</ol>';
}
const filter=()=>'<label class="toc-filter">ابحث في الفهرس<input type="search" data-toc-filter placeholder="عنوان أو رقم صفحة…" autocomplete="off"></label>';
export function bookOverview(doc,model,url){
 const first=model.sections[0];
 return '<section class="book-overview"><div class="book-intro"><div class="book-cover" aria-hidden="true"><span>من مكتبة الأنبا مكسيموس</span><strong>'+escape(doc.title)+'</strong><small>'+escape(doc.author)+'</small></div><div class="book-intro-copy"><span class="eyebrow">كتب الأرشيف</span><h1>'+escape(doc.title)+'</h1><p class="book-author">'+escape(doc.author)+'</p><div class="book-facts"><span>'+number(model.sections.length)+' أجزاء للقراءة</span>'+(model.pages.length?'<span>'+number(model.pages.length)+' صفحة مرقمة في المصدر</span>':'')+'</div><p>اقرأ الكتاب جزءًا بعد جزء، أو اختر موضعك من الفهرس.</p><div class="book-actions"><a class="book-primary" href="'+sectionUrl(doc,first,url)+'">ابدأ القراءة <span aria-hidden="true">←</span></a><a class="book-secondary" href="#book-contents">تصفّح الفهرس</a></div></div></div><section class="panel book-contents" id="book-contents" data-toc-scope><div class="section-heading"><div><span class="eyebrow">اختر موضع القراءة</span><h2>فهرس الكتاب</h2></div><span>'+number(model.sections.length)+' أجزاء</span></div>'+filter()+entries(doc,model,url)+
 (model.pages.length?'<details class="book-pages" data-toc-group data-toc-reveal><summary>الانتقال إلى صفحة <span>'+number(model.pages.length)+' صفحة</span></summary><div class="page-grid">'+model.pages.map(page=>'<a data-toc-entry href="'+pageUrl(doc,page,url)+'">صفحة '+number(page.number)+'<span class="page-search-number"> '+page.number+'</span></a>').join('')+'</div></details>':'')+
 '<p class="toc-empty" data-toc-empty hidden role="status">لا توجد عناوين أو صفحات مطابقة.</p></section></section>';
}
export function bookReader(doc,model,position,url){
 const section=model.sections[position],previous=model.sections[position-1],next=model.sections[position+1];
 const root=url(`documents/d${doc.id}/`);
 const sidebar='<aside class="reader-toc panel book-sidebar" id="book-navigation"><details open><summary>فهرس الكتاب <span>'+number(model.sections.length)+' أجزاء</span></summary><div data-toc-scope>'+filter()+entries(doc,model,url,section.id)+'<p class="toc-empty" data-toc-empty hidden role="status">لا توجد عناوين مطابقة.</p></div>'+
 (section.pages.length?'<div class="within-section"><h3>صفحات هذا الجزء</h3><div class="page-grid">'+section.pages.map(page=>'<a href="#'+escape(page.anchor)+'">'+number(page.number)+'</a>').join('')+'</div>':'')+
 (section.headings.length?'<div class="within-section"><h3>داخل هذا الجزء</h3><ul>'+section.headings.map(heading=>'<li><a href="#'+escape(heading.anchor)+'">'+escape(heading.title)+'</a></li>').join('')+'</ul></div>':'')+'</details></aside>';
 const toolbar='<div class="book-toolbar" data-book-root="'+root+'"><div class="book-toolbar-top">'+(previous?'<a href="'+sectionUrl(doc,previous,url)+'" rel="prev">→ السابق</a>':'<span aria-disabled="true">→ السابق</span>')+'<a href="#book-navigation" data-open-book-toc>فهرس الكتاب</a>'+(next?'<a href="'+sectionUrl(doc,next,url)+'" rel="next">التالي ←</a>':'<span aria-disabled="true">التالي ←</span>')+'</div><div class="book-jumps"><label>الانتقال إلى جزء<select data-book-jump aria-label="الانتقال إلى جزء">'+model.sections.map(part=>'<option value="'+sectionUrl(doc,part,url)+'"'+(part.id===section.id?' selected':'')+'>'+number(part.index+1)+' · '+escape(part.label)+'</option>').join('')+'</select></label>'+
 (model.pages.length?'<label>الانتقال إلى صفحة<select data-book-jump aria-label="الانتقال إلى صفحة"><option value="">اختر الصفحة</option>'+model.pages.map(page=>'<option value="'+pageUrl(doc,page,url)+'">صفحة '+number(page.number)+'</option>').join('')+'</select></label>':'')+'</div></div>';
 const footer='<nav class="chapter-nav book-section-nav" aria-label="تنقل أجزاء الكتاب">'+(previous?'<a href="'+sectionUrl(doc,previous,url)+'" rel="prev"><small>→ الجزء السابق</small><strong>'+escape(previous.label)+'</strong></a>':'<span></span>')+'<a class="book-index-link" href="'+root+'">الفهرس الكامل</a>'+(next?'<a href="'+sectionUrl(doc,next,url)+'" rel="next"><small>الجزء التالي ←</small><strong>'+escape(next.label)+'</strong></a>':'<span></span>')+'</nav>';
 return '<section class="book-reader"><div class="reader-heading book-reading-heading"><a class="eyebrow" href="'+root+'">'+escape(doc.title)+'</a><h1>'+escape(section.label)+'</h1><p>'+escape(doc.author)+(section.range?' · '+escape(section.range):'')+'</p><div class="book-progress"><progress value="'+(position+1)+'" max="'+model.sections.length+'" aria-label="موضع الجزء في الكتاب"></progress><span>الجزء '+number(position+1)+' من '+number(model.sections.length)+'</span></div></div><div class="reader-layout book-layout">'+sidebar+'<div class="book-reading-column">'+toolbar+'<div class="reading-tools"><span>حجم الخط</span><button type="button" data-font="-1" aria-label="تصغير الخط">أ−</button><button type="button" data-font="1" aria-label="تكبير الخط">أ+</button></div><article class="prose panel" id="section-'+section.id+'">'+section.html+'</article>'+footer+'</div></div></section>';
}

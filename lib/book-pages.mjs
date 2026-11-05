import {parseDocument} from 'htmlparser2';
import {createHash} from 'node:crypto';
import {escape,verifyStoredHtml} from './text.mjs';
import {extractText} from './content.mjs';
import {cleanHeading,number} from './book-navigation.mjs';
const text=node=>node.data??(node.children||[]).map(text).join('');
const walk=(node,visit)=>{visit(node);for(const child of node.children||[])walk(child,visit);};
const outer=node=>node.type==='text'?escape(node.data):'<'+node.name+Object.entries(node.attribs||{}).map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'+(['br','hr'].includes(node.name)?'':(node.children||[]).map(outer).join('')+'</'+node.name+'>');
export function paginateBook(doc,{targetChars=2200}={}){
 const blocks=[],ids=new Map(),legacy=new Map(),headings=[];
 for(const section of doc.sections){
  verifyStoredHtml(section.html);
  const sectionMap={start:null,anchors:{}};legacy.set(section.id,sectionMap);
  for(const node of parseDocument(section.html).children){
   if(node.type==='text'&&!node.data.trim())continue;
   const value=text(node).trim(),marker=node.name==='p'?/^صفحة\s+PDF\s+(\d+)\s*$/u.exec(value):null;
   const block={node,sectionId:section.id,marker:marker?Number(marker[1]):null,chars:value.length,refs:[]};
   walk(node,child=>{if(child.attribs?.id){const original=child.attribs.id;const anchor=(original.startsWith('note-')?'note-':'passage-')+createHash('sha256').update(doc.id+':'+section.id+':'+original).digest('hex').slice(0,32)+'-'+section.id+'-1';const key=section.id+':'+original;if(ids.has(key))throw Error('Duplicate book source anchor');ids.set(key,{anchor,block});block.refs.push({original,anchor});child.attribs.id=anchor;}});
   if(/^h[1-4]$/u.test(node.name||'')&&node.attribs?.id&&!/[.\u2026·]{3,}/u.test(value))headings.push({title:cleanHeading(value),anchor:node.attribs.id,block});
   blocks.push(block);
  }
 }
 const sourcePages=blocks.some(block=>block.marker!==null);
 const pages=[];let current=null;
 for(const block of blocks){
  if(sourcePages&&block.marker!==null){
   if(current&&current.blocks.length&&block.marker<=current.sourceNumber)throw Error('Non-monotonic source page numbers');
   current={number:pages.length+1,sourceNumber:block.marker,blocks:[],chars:0};pages.push(current);
  }else if(!current||!sourcePages&&current.chars+block.chars>targetChars&&current.blocks.length){
   current={number:pages.length+1,sourceNumber:null,blocks:[],chars:0};pages.push(current);
  }
  current.blocks.push(block);current.chars+=block.chars;block.page=current;
 }
 for(const block of blocks){
  for(const ref of block.refs)legacy.get(block.sectionId).anchors[ref.original]={page:block.page.number,anchor:ref.anchor};
  legacy.get(block.sectionId).start??={page:block.page.number,anchor:block.refs[0]?.anchor||''};
  walk(block.node,node=>{
   if(node.name==='a'&&node.attribs.href?.startsWith('#')){
    const reference=node.attribs.href.slice(1);
    const matches=[...ids].filter(([key])=>key.endsWith(':'+reference));
    const destination=ids.get(block.sectionId+':'+reference)||(matches.length===1?matches[0][1]:null);
    if(!destination)throw Error('Unresolved book footnote');
    node.attribs.href=`../p${destination.block.page.number}/#${destination.anchor}`;
   }
  });
 }
 for(const page of pages){page.html=page.blocks.map(block=>outer(block.node)).join('');page.text=extractText(page.html).text;page.noText=/^صفحة\s+PDF\s+(\d+)\s+\1\s*$/u.test(page.text.trim());}
 return {pages:pages.map(({blocks,...page})=>page),sourcePages,legacy,
  headings:headings.map(({block,...heading})=>({...heading,page:block.page.number}))};
}
const pagePath=(doc,n)=>`documents/d${doc.id}/pages/p${n}/`;
export const bookPageUrl=(doc,n,url)=>url(pagePath(doc,n));
export function pageLocation(doc,location,url){return {url:bookPageUrl(doc,location.page,url),anchor:location.anchor};}
export function legacyLocations(doc,pages,sectionId,url){const original=pages.legacy.get(sectionId);return {start:pageLocation(doc,original.start,url),anchors:Object.fromEntries(Object.entries(original.anchors).map(([id,target])=>[id,pageLocation(doc,target,url)]))};}
export function pagedBookOverview(doc,book,url){
 const firstReadable=book.pages.find(page=>!page.noText)||book.pages[0];
 const links=book.pages.map(page=>'<a data-toc-entry href="'+bookPageUrl(doc,page.number,url)+'">صفحة '+number(page.number)+'<span class="page-search-number"> '+page.number+'</span></a>').join('');
 return '<section class="book-overview"><div class="book-intro"><div class="book-cover" aria-hidden="true"><span>من مكتبة الأنبا مكسيموس</span><strong>'+escape(doc.title)+'</strong><small>'+escape(doc.author)+'</small></div><div class="book-intro-copy"><span class="eyebrow">كتب الأرشيف</span><h1>'+escape(doc.title)+'</h1><p class="book-author">'+escape(doc.author)+'</p><div class="book-facts"><span>'+number(book.pages.length)+' صفحة</span><span>'+(book.sourcePages?'ترقيم الصفحات حسب المصدر':'صفحات قراءة مرتبة حسب النص')+'</span></div><p>اقرأ صفحة واحدة في كل مرة، وتنقّل بالسابق والتالي أو اختر رقم الصفحة.</p><div class="book-actions"><a class="book-primary" href="'+bookPageUrl(doc,firstReadable.number,url)+'">ابدأ القراءة ←</a><a class="book-secondary" href="#book-contents">فهرس الكتاب</a></div></div></div><section class="panel book-contents" id="book-contents" data-toc-scope><div class="section-heading"><h2>فهرس الكتاب</h2><span>'+number(book.pages.length)+' صفحة</span></div><label class="toc-filter">ابحث في الفهرس<input type="search" data-toc-filter placeholder="عنوان أو رقم صفحة…" autocomplete="off"></label>'+
 (book.headings.length?'<ul class="book-chapter-index">'+book.headings.map(heading=>'<li data-toc-entry><a href="'+bookPageUrl(doc,heading.page,url)+'#'+heading.anchor+'"><strong>'+escape(heading.title)+'</strong><small>صفحة '+number(heading.page)+'</small></a></li>').join('')+'</ul>':'')+'<h3 class="page-index-title">الصفحات</h3><div class="page-grid book-page-index">'+links+'</div><p data-toc-empty class="toc-empty" hidden role="status">لا توجد صفحات أو عناوين مطابقة.</p></section></section>';
}
export function pagedBookReader(doc,book,page,url){
 const previous=page.number>1?bookPageUrl(doc,page.number-1,url):null,next=page.number<book.pages.length?bookPageUrl(doc,page.number+1,url):null;
 const nav=()=>'<nav class="page-turner" aria-label="تقليب صفحات الكتاب">'+(previous?'<a rel="prev" href="'+previous+'">→ السابق</a>':'<span aria-disabled="true">→ السابق</span>')+'<span>صفحة <b>'+number(page.number)+'</b> من '+number(book.pages.length)+'</span>'+(next?'<a rel="next" href="'+next+'">التالي ←</a>':'<span aria-disabled="true">التالي ←</span>')+'</nav>';
 return '<section class="book-reader paged-reader" data-paged-reader><div class="reader-heading book-reading-heading"><a class="eyebrow" href="'+url(`documents/d${doc.id}/`)+'">'+escape(doc.title)+'</a><h1>صفحة '+number(page.number)+'</h1><p>'+escape(doc.author)+'</p></div><div class="paged-reading-column"><div class="book-toolbar page-toolbar">'+nav()+'<div class="page-toolbar-actions"><a href="'+url(`documents/d${doc.id}/#book-contents` )+'">فهرس الكتاب</a><form data-page-jump data-page-root="'+url(`documents/d${doc.id}/pages/`)+'" data-page-count="'+book.pages.length+'"><label>اذهب إلى صفحة<input aria-label="رقم الصفحة" inputmode="numeric" maxlength="6" value="'+page.number+'" autocomplete="off"></label><button>اذهب</button></form></div><p class="page-jump-error" data-page-error role="status" hidden></p></div><div class="reading-tools"><span>حجم الخط</span><button type="button" data-font="-1" aria-label="تصغير الخط">أ−</button><button type="button" data-font="1" aria-label="تكبير الخط">أ+</button></div><article class="prose panel book-page" data-page-number="'+page.number+'">'+page.html+'</article>'+nav()+'<p class="page-key-hint">يمكنك التقليب أيضًا بالسهم الأيسر للتالي والأيمن للسابق.</p></div></section>';
}

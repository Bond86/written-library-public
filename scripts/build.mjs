import {mkdirSync,writeFileSync,readFileSync,cpSync,existsSync,rmSync,lstatSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import * as pagefind from 'pagefind';
import {loadContent,types} from '../lib/content.mjs';
import {escape,normalize} from '../lib/text.mjs';
import {exportAi} from '../lib/ai-export.mjs';
import {bookNavigation,bookReader} from '../lib/book-navigation.mjs';
import {paginateBook,pagedBookOverview,pagedBookReader,legacyLocations} from '../lib/book-pages.mjs';

const project=resolve(fileURLToPath(new URL('../',import.meta.url)));
if(resolve('.')!==project)throw Error('Run the build from this project directory.');
const out=resolve(project,'dist');
if(existsSync(out)&&lstatSync(out).isSymbolicLink())throw Error('Refusing a linked build directory.');
if(existsSync(out))rmSync(out,{recursive:true});
mkdirSync(out);
const base=(process.env.SITE_BASE||'/').replace(/\/?$/u,'/');
if(!/^\/(?:[a-zA-Z0-9._-]+\/)*$/u.test(base))throw Error('SITE_BASE must be a site path with a trailing slash');
const site=JSON.parse(readFileSync('config/site.json','utf8'));
const publicRoot=new URL(site.canonicalUrl);
if(publicRoot.protocol!=='https:'||publicRoot.username||publicRoot.password||publicRoot.search||publicRoot.hash||!publicRoot.pathname.endsWith('/'))throw Error('Invalid public canonical URL');
if(typeof site.title!=='string'||!site.title.trim())throw Error('Missing site title');
const visitor=JSON.parse(readFileSync('config/visitor-gate.json','utf8'));
if(!/^[a-f0-9]{64}$/u.test(visitor.sha256))throw Error('Configure the casual visitor code with tools/Set-VisitorPassphrase.ps1 before building');
const docs=loadContent();
const pagedBooks=new Map(docs.filter(doc=>doc.type==='book').map(doc=>[doc.id,paginateBook(doc)]));
const sectionTotal=docs.reduce((n,d)=>n+d.sections.length,0);
const bookPageTotal=[...pagedBooks.values()].reduce((n,book)=>n+book.pages.length,0);
const url=path=>base+path;
const write=(path,text)=>{mkdirSync(join(out,path,'..'),{recursive:true});writeFileSync(join(out,path),text);};
mkdirSync(join(out,'assets'),{recursive:true});
writeFileSync(join(out,'assets/site.css'),readFileSync('assets/site.css','utf8')+'\n'+readFileSync('assets/books.css','utf8'));
cpSync('assets/book.svg',join(out,'assets/book.svg'));
await build({entryPoints:['assets/site.mjs'],bundle:true,format:'esm',outfile:join(out,'assets/site.js'),minify:true});
await build({entryPoints:['assets/visitor-gate.mjs'],bundle:true,format:'esm',outfile:join(out,'assets/visitor-gate.js'),minify:true});
const versions=new Map();
function assetUrl(path){
 if(!versions.has(path))versions.set(path,createHash('sha256').update(readFileSync(join(out,path))).digest('hex').slice(0,16));
 return url(path)+'?v='+versions.get(path);
}
function shell(title,body,section='',path=''){
 return '<!doctype html><html lang="ar" dir="rtl" data-visitor-locked><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<meta name="robots" content="noindex, follow"><meta name="googlebot" content="noindex, follow"><meta name="bingbot" content="noindex, follow"><link rel="canonical" href="'+escape(new URL(path,site.canonicalUrl).href)+'">'+
 '<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'wasm-unsafe-eval\'; style-src \'self\'; img-src \'none\'; connect-src \'self\'; object-src \'none\'; base-uri \'none\'">'+
 '<title>'+escape(title)+' · '+escape(site.title)+'</title><link rel="icon" href="'+assetUrl('assets/book.svg')+'" type="image/svg+xml"><link rel="stylesheet" href="'+assetUrl('assets/site.css')+'"><script type="module" src="'+assetUrl('assets/visitor-gate.js')+'"></script><script type="module" src="'+assetUrl('assets/site.js')+'"></script></head><body data-base="'+base+'">'+
 '<section id="visitor-gate" class="visitor-screen" aria-labelledby="visitor-title" data-verifier="'+visitor.sha256+'"><div class="visitor-card"><span class="eyebrow">أهلًا بك في الأرشيف</span><h1 id="visitor-title">'+escape(site.title)+'</h1><p>أدخل رمز الزيارة لفتح واجهة القراءة.</p><form id="visitor-form" autocomplete="off"><label for="visitor-passphrase">رمز الزيارة</label><input id="visitor-passphrase" type="password" required maxlength="200" autocomplete="off" aria-describedby="visitor-message"><button type="submit" disabled>دخول الأرشيف</button><p id="visitor-message" role="status" aria-live="polite"></p></form><p class="visitor-notice">هذه بوابة زيارة بسيطة وليست حماية أمنية. محتوى الأرشيف متاح علنًا.</p><a href="'+url('ai/index.json')+'">فهرس النصوص العامة للقراءة الآلية</a><noscript><p>يتطلب فتح الواجهة JavaScript؛ ملفات النصوص العامة لا تحتاج إليه.</p></noscript></div></section>'+
 '<div id="site-content" hidden inert><a class="skip" href="#main">إلى المحتوى</a><header><a class="brand" href="'+base+'"><span class="brand-icon" aria-hidden="true">م</span><span>'+escape(site.title)+'<small>مقالات · محاضرات · كتب</small></span></a><nav aria-label="أقسام المكتبة">'+Object.entries(types).map(([k,v])=>'<a href="'+url(k+'/')+'"'+(section===k?' aria-current="page"':'')+'>'+v+'</a>').join('')+'<a href="'+url('search/')+'">البحث</a><button type="button" class="visitor-lock" data-visitor-lock>قفل الواجهة</button></nav></header>'+
 '<main id="main" tabindex="-1">'+body+'</main><footer>'+escape(site.title)+' · <a href="'+url('ai/index.json')+'">النصوص العامة</a></footer></div></body></html>';
}
const cards=items=>'<div class="catalog">'+items.map(d=>'<article class="card'+(d.type==='book'?' book-shelf-card':'')+'"><span class="eyebrow">'+types[d.type]+'</span><h2><a href="'+url('documents/d'+d.id+'/')+'">'+escape(d.title)+'</a></h2><p>'+escape(d.author)+'</p><span class="card-bottom">'+(d.type==='book'?pagedBooks.get(d.id).pages.length+' صفحة':d.sections.length>1?d.sections.length+' أقسام':'اقرأ النص')+' <span aria-hidden="true">←</span></span></article>').join('')+'</div>';
const searchForm=(full=false)=>'<form action="'+url('search/')+'" class="search-form"'+(full?' id="search-form"':'')+'><label for="q">ابحث في نصوص المكتبة</label><div class="search-row"><input id="q" name="q" type="search" maxlength="140" placeholder="عنوان، فكرة، أو عبارة من النص…" autocomplete="off"><select name="type" aria-label="نوع المحتوى"><option value="">كل الأقسام</option>'+Object.entries(types).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select><button>بحث</button></div></form>';
write('index.html',shell('الأرشيف','<section class="hero"><span class="eyebrow">أرشيف للقراءة والبحث</span><h1>'+escape(site.title)+'</h1><p>مقالات ومحاضرات وكتب للقراءة والتأمل، مع بحث داخل النص العربي الكامل.</p>'+searchForm()+'</section><div class="section-heading"><h2>تصفّح المكتبة</h2><span>'+docs.length+' مادة · '+bookPageTotal+' صفحة كتب</span></div><div class="type-grid">'+Object.entries(types).map(([k,v],i)=>'<a href="'+url(k+'/')+'"><span class="type-number">0'+(i+1)+'</span><h2>'+v+'</h2><span>'+docs.filter(d=>d.type===k).length+' مادة <span aria-hidden="true">←</span></span></a>').join('')+'</div><div class="section-heading"><h2>من المكتبة</h2><a href="'+url('search/')+'">ابحث عن مادة</a></div>'+cards(docs.filter(d=>d.type==='book').concat(docs.filter(d=>d.type==='article').slice(0,3)))));
for(const [type,label] of Object.entries(types)){
 const group=docs.filter(d=>d.type===type);
 write(type+'/index.html',shell(label,'<div class="page-heading"><span class="eyebrow">أقسام المكتبة</span><h1>'+label+'</h1><p>'+group.length+' مادة متاحة للقراءة</p></div>'+cards(group),type,type+'/'));
}
write('search/index.html',shell('بحث الأرشيف','<div class="page-heading"><span class="eyebrow">البحث في النص الكامل</span><h1>ما الذي تبحث عنه؟</h1><p>ابحث في المقالات والمحاضرات والكتب، واختر القسم المناسب.</p></div>'+searchForm(true)+'<p id="search-status" role="status" aria-live="polite" tabindex="-1">اكتب كلمة أو عبارة للبحث.</p><div id="results" class="search-results"></div><nav id="search-pagination" class="search-pagination" aria-label="صفحات نتائج البحث" hidden></nav><noscript>يلزم تفعيل JavaScript لاستخدام البحث. يمكنك قراءة الأقسام من روابط التصفح.</noscript>','','search/'));
write('404.html',shell('الصفحة غير موجودة','<section class="panel"><span class="eyebrow">الرابط غير متاح</span><h1>لم نعثر على هذه الصفحة</h1><p>يمكنك الرجوع إلى الأرشيف أو البحث عن المادة التي تريد قراءتها.</p><div class="book-actions"><a class="book-primary" href="'+base+'">الصفحة الرئيسية</a><a class="book-secondary" href="'+url('search/')+'">البحث في الأرشيف</a><a class="book-secondary" href="'+url('book/')+'">الكتب</a></div></section>','','404.html'));
const {index,errors}=await pagefind.createIndex({forceLanguage:'ar',writePlayground:false});
if(errors?.length)throw Error(errors.join('\n'));
for(const doc of docs){
 const directory='documents/d'+doc.id+'/';
 const book=doc.type==='book'?bookNavigation(doc):null;
 const pages=pagedBooks.get(doc.id);
 if(pages)for(const page of pages.pages){
  const path=directory+'pages/p'+page.number+'/';
  write(path+'index.html',shell(doc.title+' · صفحة '+page.number,pagedBookReader(doc,pages,page,url),doc.type,path));
 }
 const toc='<ol class="toc">'+doc.sections.map(s=>'<li><a href="'+url(directory+'s'+s.id+'/')+'">'+escape(s.chapter&&s.chapter!==s.heading?s.chapter+' · '+s.heading:s.heading)+'</a></li>').join('')+'</ol>';
 write(directory+'index.html',shell(doc.title,'<nav class="breadcrumbs" aria-label="مسار القراءة"><a href="'+url(doc.type+'/')+'">'+types[doc.type]+'</a><span> / </span><span>'+escape(doc.title)+'</span></nav>'+(book?pagedBookOverview(doc,pages,url):'<div class="page-heading"><span class="eyebrow">'+types[doc.type]+'</span><h1>'+escape(doc.title)+'</h1><p>'+escape(doc.author)+(doc.date?' · '+escape(doc.date):'')+'</p></div><section class="panel"><h2>'+(doc.sections.length>1?'فهرس المحتويات':'النص')+'</h2>'+toc+'</section>'),doc.type,directory));
 for(const [position,s] of doc.sections.entries()){
  const path=directory+'s'+s.id+'/';
  const html=shell(doc.title+' · '+s.heading,
   '<nav class="breadcrumbs" aria-label="مسار القراءة"><a href="'+url(doc.type+'/')+'">'+types[doc.type]+'</a><span> / </span><a href="'+url(directory)+'">'+escape(doc.title)+'</a></nav>'+
   (book?bookReader(doc,book,position,url).replace('<section class="book-reader">','<section class="book-reader" data-legacy-book-map="'+escape(JSON.stringify(legacyLocations(doc,pages,s.id,url)))+'">'):'<div class="reader-heading"><span class="eyebrow">'+escape(doc.author)+'</span><h1>'+escape(doc.title)+'</h1><p>'+escape(s.heading)+'</p></div>'+
   '<div class="reader-layout"><aside class="reader-toc panel"><details open><summary>فهرس المحتويات</summary>'+toc+'</details></aside><div><div class="reading-tools"><span>حجم الخط</span><button type="button" data-font="-1" aria-label="تصغير الخط">أ−</button><button type="button" data-font="1" aria-label="تكبير الخط">أ+</button></div>'+
   '<article class="prose panel" id="section-'+s.id+'">'+s.html+'</article><nav class="chapter-nav" aria-label="تنقل الأقسام">'+
   (position>0?'<a href="'+url(directory+'s'+doc.sections[position-1].id+'/')+'">→ القسم السابق</a>':'<span></span>')+
   '<a href="'+url(directory)+'">الفهرس</a>'+
   (position<doc.sections.length-1?'<a href="'+url(directory+'s'+doc.sections[position+1].id+'/')+'">القسم التالي ←</a>':'<span></span>')+'</nav></div></div>'),doc.type,path);
  write(path+'index.html',html);
  const prefix=[doc.title,doc.author,s.heading,s.chapter||''].filter(Boolean).join(' ')+' ';
  const original=prefix+s.text;
  const added=await index.addCustomRecord({url:'/'+path,content:normalize(original),language:'ar',
   meta:{title:normalize(doc.title),display_title:doc.title,heading:s.heading,type:doc.type,original,
    anchors:JSON.stringify(s.anchors.map(([at,anchor])=>[at+prefix.length,anchor])),...(pages?{page_locations:JSON.stringify(legacyLocations(doc,pages,s.id,url))}:{})},
   filters:{type:[doc.type]}});
  if(added.errors?.length)throw Error(added.errors.join('\n'));
 }
}
await index.writeFiles({outputPath:join(out,'pagefind')});
await pagefind.close();
await build({entryPoints:['tools/editor.mjs'],bundle:true,format:'iife',outfile:'tools/editor.bundle.js'});
exportAi(docs,write,site,pagedBooks);
write('robots.txt','# HTML must remain crawlable for noindex meta directives.\n# Install at the HOST ROOT to have crawler effect; see ACCESS-AND-INDEXING.md.\n'+
 ['Googlebot','Bingbot','DuckDuckBot','Baiduspider','YandexBot','Slurp'].map(bot=>'User-agent: '+bot).join('\n')+'\nDisallow: '+publicRoot.pathname+'ai/\nDisallow: '+publicRoot.pathname+'pagefind/\n\nUser-agent: *\nAllow: '+publicRoot.pathname+'\n');
write('.nojekyll','');
mkdirSync('audit',{recursive:true});
writeFileSync('audit/build.json',JSON.stringify({documents:docs.length,sections:sectionTotal,base,canonicalUrl:site.canonicalUrl,pagefindRecords:sectionTotal,aiDocuments:docs.length,aiSections:sectionTotal,generated:new Date().toISOString()},null,2));
console.log('Built '+docs.length+' documents and '+sectionTotal+' indexed section pages.');


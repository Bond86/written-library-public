import {parseDocument} from 'htmlparser2';
import {types} from './content.mjs';

const paragraphs=new Set('p div h1 h2 h3 h4 h5 h6 blockquote pre ul ol table caption'.split(' '));
export function plainText(html){
 function render(node){
  if(node.type==='text')return node.data;
  if(node.name==='br')return '\n';
  if(node.name==='hr')return '\n\n';
  const value=(node.children||[]).map(render).join('');
  if(node.name==='td'||node.name==='th')return value+'\t';
  if(node.name==='tr'||node.name==='li')return '\n'+value+'\n';
  return paragraphs.has(node.name)?'\n\n'+value+'\n\n':value;
 }
 return render(parseDocument(html)).replace(/\r\n?/gu,'\n')
  .replace(/[^\S\n\t]+/gu,' ').replace(/ *\t */gu,'\t')
  .replace(/[ \t]+\n/gu,'\n').replace(/\n[ \t]+/gu,'\n')
  .replace(/\n{3,}/gu,'\n\n').trim();
}
export function exportAi(docs,write,site,pagedBooks=new Map()){
 const canonical=path=>new URL(path,site.canonicalUrl).href;
 const entries=[];
 for(const doc of docs){
  const sections=doc.sections.map(section=>{
   const contentUrl=canonical(`ai/sections/d${doc.id}-s${section.id}.txt`);
   const canonicalUrl=canonical(`documents/d${doc.id}/s${section.id}/`);
   const label=[section.chapter,section.heading].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' — ');
   const text=plainText(section.html);
   write(`ai/sections/d${doc.id}-s${section.id}.txt`,[
    doc.title,`المؤلف: ${doc.author}`,`النوع: ${types[doc.type]}`,
    `القسم: ${label}`,`الرابط: ${canonicalUrl}`,'',text,''
   ].join('\n'));
   return {id:section.id,position:section.position,chapter:section.chapter||null,
    title:section.heading,canonical_url:canonicalUrl,content_url:contentUrl,text,label};
  });
  const contentUrl=canonical(`ai/documents/d${doc.id}.txt`);
  const canonicalUrl=canonical(`documents/d${doc.id}/`);
  write(`ai/documents/d${doc.id}.txt`,[
   doc.title,`المؤلف: ${doc.author}`,`النوع: ${types[doc.type]}`,
   ...(doc.date?[`التاريخ: ${doc.date}`]:[]),`الرابط: ${canonicalUrl}`,'',
   'فهرس الأقسام',...sections.map((s,i)=>`${i+1}. ${s.label}\n${s.content_url}`),'',
   ...sections.flatMap((s,i)=>[`القسم ${i+1}: ${s.label}`,'',s.text,'']),''
  ].join('\n'));
  const book=pagedBooks.get(doc.id);
  const pages=book?.pages.map(page=>{
   const canonicalUrl=canonical(`documents/d${doc.id}/pages/p${page.number}/`),contentUrl=canonical(`ai/pages/d${doc.id}-p${page.number}.txt`);
   write(`ai/pages/d${doc.id}-p${page.number}.txt`,`${doc.title}\nالمؤلف: ${doc.author}\nصفحة ${page.number}\nالرابط: ${canonicalUrl}\n\n${plainText(page.html)}\n`);
   return {number:page.number,source_number:page.sourceNumber,canonical_url:canonicalUrl,content_url:contentUrl};
  });
  entries.push({id:doc.id,type:doc.type,category:types[doc.type],title:doc.title,
   author:doc.author,date:doc.date||null,subject_category:doc.category||null,tags:doc.tags||null,
   description:Array.from(doc.sections[0].text).slice(0,220).join(''),
   canonical_url:canonicalUrl,content_url:contentUrl,
   sections:sections.map(({text,label,...metadata})=>metadata),...(pages?{page_numbering:book.sourcePages?'source':'reading',pages}:{})});
 }
 const result={schema_version:1,title:site.title,language:'ar',public_data:true,
  document_count:docs.length,section_count:docs.reduce((n,d)=>n+d.sections.length,0),documents:entries};
 write('ai/index.json',JSON.stringify(result,null,2)+'\n');
 write('ai/README.txt',`${site.title}\n\nفهرس النصوص العامة: ${canonical('ai/index.json')}\nالملفات نصوص UTF-8 عامة ولا تحتاج إلى JavaScript أو رمز الزيارة.\nكل مادة لها نص كامل وأقسام مرتبة؛ الروابط والمعرّفات موجودة في الفهرس.\nهذه الملفات متاحة لأي شخص أو أداة؛ لا توجد صلاحيات خاصة بناءً على هوية المتصفح.\n`);
 return result;
}

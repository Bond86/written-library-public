import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
import {loadContent,extractText} from '../lib/content.mjs';import {paginateBook,legacyLocations} from '../lib/book-pages.mjs';import {parseDocument} from 'htmlparser2';
const books=loadContent().filter(doc=>doc.type==='book');const tight=text=>text.replace(/\s/gu,'');
test('book pages preserve all source text exactly once and carry pages across old section boundaries',()=>{
 for(const doc of books){
  const original=JSON.stringify(doc),book=paginateBook(doc);
  assert.equal(book.pages.length,doc.id===543?120:doc.id===544?180:60);
  assert.equal(tight(book.pages.map(page=>page.text).join('')),tight(doc.sections.map(section=>section.text).join('')));
  assert.equal(JSON.stringify(doc),original);
  for(const section of doc.sections)for(const [,anchor] of section.anchors)assert.ok(book.legacy.get(section.id).anchors[anchor]);
  for(const page of book.pages){const html=readFileSync(`dist/documents/d${doc.id}/pages/p${page.number}/index.html`,'utf8');assert.ok(html.includes(page.html));assert.match(html,/data-paged-reader/u);assert.match(html,/<meta name="robots" content="noindex, follow">/u);assert.ok(!html.includes('أجزاء للقراءة'));assert.ok(!html.includes('data-legacy-book-map'));}
  const landing=readFileSync(`dist/documents/d${doc.id}/index.html`,'utf8');assert.ok(!landing.includes('أجزاء'));assert.ok(!landing.includes('/s'+doc.sections[0].id+'/'));
 }
 const doc=books.find(doc=>doc.id===543),book=paginateBook(doc);
 assert.equal(book.legacy.get(545).start.page,14);
 const map=legacyLocations(doc,book,545,path=>'/'+path);assert.ok(map.start.url.endsWith('/pages/p14/'));
});
test('pagination keeps tables, Arabic formatting and cross-page footnotes structurally valid',()=>{
 const doc={id:999,sections:[{id:1,html:'<h2 id="passage-1">عنوان</h2><p id="passage-2">نص <strong>عربي</strong> <a href="#note-1">حاشية</a></p><table id="passage-3"><tr><td>خلية</td><td>أخرى</td></tr></table><p id="note-1">نص الحاشية</p>'}]};
 const book=paginateBook(doc,{targetChars:15});
 assert.equal(tight(book.pages.map(page=>page.text).join('')),tight(extractText(doc.sections[0].html).text));
 const all=book.pages.map(page=>page.html).join('');assert.equal((all.match(/<table /gu)||[]).length,1);assert.match(all,/<tr><td>خلية<\/td><td>أخرى<\/td><\/tr>/u);
 const seen=new Set();for(const page of book.pages){const visit=node=>{if(node.attribs?.id){assert.ok(!seen.has(node.attribs.id));seen.add(node.attribs.id);}for(const child of node.children||[])visit(child);};visit(parseDocument(page.html));}
 assert.match(all,/href="\.\.\/p\d+\/#note-/u);
});
test('page text exports and AI page links match the published reading pages',()=>{
 const index=JSON.parse(readFileSync('dist/ai/index.json','utf8'));
 assert.equal(readdirSync('dist/ai/pages').length,360);
 for(const doc of books){const model=paginateBook(doc),entry=index.documents.find(item=>item.id===doc.id);assert.equal(entry.pages.length,model.pages.length);for(const page of model.pages){const output=readFileSync(`dist/ai/pages/d${doc.id}-p${page.number}.txt`,'utf8');assert.ok(output.includes(`documents/d${doc.id}/pages/p${page.number}/`));assert.equal(tight(output.slice(output.indexOf('\n\n')+2)),tight(page.text));}}
});

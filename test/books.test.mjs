import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDocument} from 'htmlparser2';
import {transformSync} from 'esbuild';
import {loadContent} from '../lib/content.mjs';
import {bookNavigation,cleanHeading,bookOverview} from '../lib/book-navigation.mjs';
const books=loadContent().filter(doc=>doc.type==='book');
const nodes=root=>{const result=[];function walk(node){result.push(node);for(const child of node.children||[])walk(child);}walk(root);return result;};
test('book indexes preserve source order and resolve every existing PDF page anchor',()=>{
 assert.equal(books.length,3);
 for(const doc of books){
  const original=JSON.stringify(doc),model=bookNavigation(doc);
  assert.deepEqual(model.sections.map(section=>section.id),doc.sections.map(section=>section.id));
  assert.equal(JSON.stringify(doc),original);
  for(const page of model.pages){
   const source=doc.sections.find(section=>section.id===page.sectionId);
   assert.ok(source.html.includes('id="'+page.anchor+'"'));
   assert.ok(source.html.includes('صفحة PDF '+page.number));
  }
  assert.equal(model.pages.length,doc.id===543?120:doc.id===544?180:0);
 }
 assert.equal(bookNavigation(books.find(doc=>doc.id===543)).sections[0].label,'الجزء ١');
 assert.equal(cleanHeading('الفصل الأول - البدايات .................. 17'),'الفصل الأول - البدايات');
});
test('book pages expose complete indexes, correct current part and bounded previous/next links',()=>{
 for(const doc of books){
  const overview=readFileSync(`dist/documents/d${doc.id}/index.html`,'utf8');
  assert.match(overview,/class="book-overview"/u);
  assert.match(overview,/data-toc-filter/u);
  const model=bookNavigation(doc);
  for(const [position,section] of model.sections.entries()){
   const html=readFileSync(`dist/documents/d${doc.id}/s${section.id}/index.html`,'utf8');
   const tree=nodes(parseDocument(html));
   const current=tree.filter(node=>node.name==='a'&&node.attribs?.['aria-current']==='page'&&node.attribs.href.includes('/documents/'));
   assert.equal(current.length,1);
   assert.ok(current[0].attribs.href.endsWith(`/s${section.id}/`));
   const jumps=tree.filter(node=>node.name==='select'&&Object.hasOwn(node.attribs||{},'data-book-jump'));
   assert.equal(jumps.length,model.pages.length?2:1);
   assert.equal(nodes(jumps[0]).filter(node=>node.name==='option').length,model.sections.length);
   const links=tree.filter(node=>node.name==='a'&&['prev','next'].includes(node.attribs?.rel));
   assert.equal(links.filter(node=>node.attribs.rel==='prev').length,position>0?2:0);
   assert.equal(links.filter(node=>node.attribs.rel==='next').length,position<model.sections.length-1?2:0);
   for(const link of links){const expected=model.sections[position+(link.attribs.rel==='prev'?-1:1)];assert.ok(link.attribs.href.endsWith(`/s${expected.id}/`));}
   assert.ok(html.includes('<article class="prose panel" id="section-'+section.id+'">'+section.html+'</article>'));
  }
 }
});
test('book display titles are escaped and do not invent chapters for unstructured books',()=>{
 const doc=books.find(book=>book.id===545),model=bookNavigation(doc);
 assert.ok(model.sections.every(section=>section.label.startsWith('الجزء ')));
 const html=bookOverview({...doc,title:'<script>unsafe</script>',author:'<img src=x>'},model,path=>'/'+path);
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(!html.includes('<img '));
});
test('book stylesheet parses without invalid layout declarations',()=>{
 const result=transformSync(readFileSync('assets/books.css','utf8'),{loader:'css',logLevel:'silent'});
 assert.deepEqual(result.warnings,[]);
});

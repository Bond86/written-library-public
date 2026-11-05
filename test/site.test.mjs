import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {join,extname} from 'node:path';
import {loadContent,extractText} from '../lib/content.mjs';
import {cleanHtml,normalize,verifyStoredHtml} from '../lib/text.mjs';
import {presentResult} from '../lib/search.mjs';
const docs=loadContent();
test('all source documents and sections have complete generated pages',()=>{
 assert.ok(docs.length>0);
 const sections=docs.flatMap(d=>d.sections);
 assert.ok(sections.length>=docs.length);
 assert.ok(['article','lecture','book'].every(t=>docs.some(d=>d.type===t)));
 for(const d of docs){
  const toc=readFileSync('dist/documents/d'+d.id+'/index.html','utf8');
  for(const s of d.sections){
   const file='dist/documents/d'+d.id+'/s'+s.id+'/index.html';
   const html=readFileSync(file,'utf8');
   assert.ok(html.includes('<article class="prose panel" id="section-'+s.id+'">'+s.html+'</article>'),file);
   assert.ok(toc.includes('/documents/d'+d.id+(d.type==='book'?'/pages/p1/':'/s'+s.id+'/')));
   assert.match(html,/<html lang="ar" dir="rtl" data-visitor-locked>/u);
   assert.ok(s.text.trim());
  }
 }
});
test('Arabic normalization and original spellings in marked excerpts',()=>{
 assert.equal(normalize('أ إ آ ٱ اَلـكِتَابُ'),'ا ا ا ا الكتاب');
 const r=presentResult({excerpt:'توجيهات <mark>اب</mark> اعترافي',meta:{display_title:'نص عربي',original:'تمهيد توجيهات أَب اعترافي كاملة',anchors:JSON.stringify([[6,'passage-2']])}});
 assert.equal(r.anchor,'passage-2');
 assert.match(r.snippetHtml,/<mark>أَب<\/mark>/u);
 assert.equal(r.title,'نص عربي');
});
test('Word formatting, tables, footnotes and unsafe input handling',()=>{
 const source='<h2 onclick="bad()">عنوان</h2><p dir="rtl"><span style="mso-bidi-font-weight:bold;font-style:italic">نص عربي</span></p><table><tr><td colspan="2">خلية</td></tr></table><a href="#_ftn1">١</a><p id="_ftn1">حاشية</p><script>bad()</script><img src=x onerror=bad()>';
 const result=cleanHtml(source);
 verifyStoredHtml(result.html);
 assert.match(result.html,/<em><strong>نص عربي<\/strong><\/em>/u);
 assert.match(result.html,/<td colspan="2">خلية/u);
 assert.match(result.html,/href="#note-_ftn1"/u);
 assert.match(result.html,/id="note-_ftn1"/u);
 assert.doesNotMatch(result.html,/onclick|onerror|<script|<img/u);
 assert.throws(()=>verifyStoredHtml('<p onclick="bad()">test</p>'),/Unsafe/u);
 assert.match(extractText(result.html).text,/نص عربي/u);
});
test('only static public files are present in the deployment output',()=>{
 const disallowed=/BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{30,}|__Host-library_session|AUTH_PEPPER|AUTH_SETUP_DIGEST|C:[\\/]+Users[\\/]|selected_path|source_sha256|local-private/iu;
 let bytes=0,files=0;
 function scan(dir){
  for(const name of readdirSync(dir)){
   const path=join(dir,name),info=lstatSync(path);
   assert.ok(!info.isSymbolicLink(),path);
   if(info.isDirectory()){scan(path);continue;}
   assert.ok(!/^\.env|\.sqlite|\.pem$|\.key$|\.map$|package-lock|metadata\.json/u.test(name),path);
   const b=readFileSync(path);bytes+=b.length;files++;
   if(['.html','.js','.css','.json','.svg','.txt'].includes(extname(name)))assert.ok(!disallowed.test(b.toString('utf8')),path);
  }
 }
 scan('dist');
 assert.ok(files>1200);
 assert.ok(bytes<1024*1024*1024);
});


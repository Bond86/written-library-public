import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {serve} from '../scripts/serve.mjs';
import {loadContent,extractText} from '../lib/content.mjs';
import {plainText} from '../lib/ai-export.mjs';
const docs=loadContent();
const ai=JSON.parse(readFileSync('dist/ai/index.json','utf8'));
const site=JSON.parse(readFileSync('config/site.json','utf8'));
const verifier=JSON.parse(readFileSync('config/visitor-gate.json','utf8')).sha256;
const contentOnly=text=>text.replace(/\s/gu,'');

test('complete AI exports preserve every source section and ordered book structure',()=>{
 assert.equal(ai.documents.length,docs.length);
 assert.equal(ai.document_count,605);assert.equal(ai.section_count,661);
 assert.equal(readdirSync('dist/ai/documents').length,605);
 assert.equal(readdirSync('dist/ai/sections').length,661);
 for(const doc of docs){
  const entry=ai.documents.find(d=>d.id===doc.id);
  assert.equal(entry.title,doc.title);assert.equal(entry.author,doc.author);assert.equal(entry.type,doc.type);
  assert.ok(['مقالات','محاضرات','كتب'].includes(entry.category));
  assert.ok(entry.canonical_url.startsWith(site.canonicalUrl+'documents/'));
  assert.ok(entry.content_url.endsWith(`/ai/documents/d${doc.id}.txt`));
  assert.deepEqual(entry.sections.map(s=>s.id),doc.sections.map(s=>s.id));
  const full=readFileSync(`dist/ai/documents/d${doc.id}.txt`,'utf8');
  let previous=-1;
  for(const section of doc.sections){
   const expected=plainText(section.html);
   assert.equal(contentOnly(expected),contentOnly(extractText(section.html).text),'Text lost in '+section.id);
   const output=readFileSync(`dist/ai/sections/d${doc.id}-s${section.id}.txt`,'utf8');
   assert.ok(output.endsWith('\n\n'+expected+'\n'));
   const position=full.indexOf(expected,previous+1);assert.ok(position>previous);previous=position;
   assert.ok(!output.includes(verifier));
   assert.doesNotMatch(output,/<script|visitor-passphrase|data-verifier|C:\\Users\\/u);
  }
  assert.ok(!full.includes(verifier));
 }
 assert.ok(!JSON.stringify(ai).includes(verifier));
});
test('plain-text conversion retains Arabic headings, lists, tables, footnotes and mixed text',()=>{
 const html='<h2>إيمانٌ ورجاء</h2><p>نص <strong>عربي</strong> English.</p><ol><li>أولًا</li><li>ثانيًا</li></ol><table><tr><th>عمود</th><th>آخر</th></tr><tr><td>خانة</td><td>قيمة</td></tr></table><p><a href="#note-1">١</a></p><p id="note-1">حاشية</p>';
 const text=plainText(html);
 assert.match(text,/إيمانٌ ورجاء\n\nنص عربي English\./u);
 assert.match(text,/أولًا\n\nثانيًا/u);
 assert.match(text,/عمود\tآخر/u);
 assert.match(text,/خانة\tقيمة/u);
 assert.equal(contentOnly(text),contentOnly(extractText(html).text));
});
test('noindex is unconditional, robots preserves HTML access and no sitemap is generated',()=>{
 const files=['dist/index.html','dist/search/index.html',...['article','lecture','book'].map(type=>`dist/${type}/index.html`),...docs.flatMap(d=>[`dist/documents/d${d.id}/index.html`,...d.sections.map(s=>`dist/documents/d${d.id}/s${s.id}/index.html`)])];
 for(const path of files){
  const html=readFileSync(path,'utf8');
  assert.match(html,/<meta name="robots" content="noindex, follow">/u);
  assert.match(html,/<meta name="googlebot" content="noindex, follow">/u);
  assert.match(html,/<meta name="bingbot" content="noindex, follow">/u);
  assert.ok(html.includes(site.title));
  assert.doesNotMatch(html,/كلمة مكتوبة|وذاكرة ممتدة/u);
  assert.match(html,/<div id="site-content" hidden inert>/u);
  assert.doesNotMatch(html,/Sitemap:|sitemap\.xml/u);
 }
 const robots=readFileSync('dist/robots.txt','utf8');
 const base=new URL(site.canonicalUrl).pathname;
 assert.ok(robots.includes('Disallow: '+base+'ai/'));
 assert.ok(robots.includes('User-agent: *\nAllow: '+base));
 assert.ok(!robots.includes('Disallow: '+base+'\n'));
 assert.doesNotMatch(robots,/Sitemap:|noindex:/iu);
 assert.ok(!existsSync('dist/sitemap.xml'));
 assert.doesNotMatch(readFileSync('dist/assets/visitor-gate.js','utf8'),/userAgent|navigator\.platform/iu);
 const audit=JSON.parse(readFileSync('audit/build.json','utf8'));
 assert.equal(audit.pagefindRecords,661);
});
test('AI text and JSON return directly without JS, cookies or visitor authorization for any agent',async()=>{
 const server=await serve('dist',0);
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  for(const agent of ['Mozilla/5.0','Googlebot','Bingbot','ChatGPT-User','Claude-User']){
   const headers={'User-Agent':agent};
   const html=await fetch(origin+'/',{headers});assert.equal(html.status,200);
   assert.ok((await html.text()).includes('name="robots" content="noindex, follow"'));
   const index=await fetch(origin+'/ai/index.json',{headers});assert.equal(index.status,200);
   assert.equal((await index.json()).document_count,605);
   const text=await fetch(origin+'/ai/sections/d545-s584.txt',{headers});
   assert.equal(text.status,200);assert.match(text.headers.get('content-type'),/text\/plain; charset=utf-8/u);
   assert.equal(text.headers.get('set-cookie'),null);
   assert.ok((await text.text()).includes('صمت الدارسين عبرة'));
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
});

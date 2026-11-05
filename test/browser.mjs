import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {serve} from '../scripts/serve.mjs';
import {browser} from './chrome.mjs';
import {cleanHtml} from '../lib/text.mjs';
import {createHash} from 'node:crypto';

const base=JSON.parse(readFileSync('audit/build.json','utf8')).base;
const realVerifier=JSON.parse(readFileSync('config/visitor-gate.json','utf8')).sha256;
const testPhrase='synthetic-visitor-only';
const testVerifier=createHash('sha256').update(testPhrase).digest('hex');
const {outputFiles}=await build({stdin:{contents:"export {normalize} from './lib/text.mjs';export {presentResult} from './lib/search.mjs';",resolveDir:process.cwd()},write:false,bundle:true,format:'esm'});
const fixture=cleanHtml('<h2>جدول عربي</h2><p><a href="#_ftn1">١</a></p><table><tr><th>العمود الأول</th><th>العمود الثاني</th></tr>'+Array.from({length:25},(_,i)=>'<tr><td>خلية عربية '+i+'</td><td><strong>إيمان</strong></td></tr>').join('')+'</table><p id="_ftn1">حاشية تجريبية</p><script>window.bad=true</script>').html;
const server=await serve('dist',0,async(url,req,res)=>{
 if([base+'__gate-test/',base+'__gate-test-next/'].includes(url.pathname)){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  res.end(readFileSync('dist/index.html','utf8').replace('data-verifier="'+realVerifier+'"','data-verifier="'+testVerifier+'"'));return true;
 }
 if(url.pathname===base+'__test-lib.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(outputFiles[0].text);return true;}
 if(url.pathname===base+'__editor-bundle.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(readFileSync('tools/editor.bundle.js'));return true;}
 if(url.pathname===base+'__editor/'){
  const html=readFileSync('tools/editor.html','utf8').replace('../assets/site.css',base+'assets/site.css').replace('editor.bundle.js',base+'__editor-bundle.js');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return true;
 }
 if(url.pathname===base+'__fixture/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<html lang="ar" dir="rtl"><link rel="stylesheet" href="'+base+'assets/site.css"><body><main><article class="prose panel">'+fixture+'</article></main></body></html>');return true;}
 if(base!=='/'&&url.pathname.startsWith(base))url.pathname='/'+url.pathname.slice(base.length);
 return false;
});
const origin='http://127.0.0.1:'+server.address().port;
const chrome=await browser();
const screenshots=[];
const waitFor=async expression=>{
 for(let i=0;i<200;i++){
  if(await chrome.evaluate(expression))return;
  await new Promise(r=>setTimeout(r,100));
 }
 throw Error('Browser condition timed out '+expression);
};
try{
 await chrome.navigate(origin+base+'__gate-test/');
 assert.ok(await chrome.evaluate('!document.querySelector("#visitor-gate").hidden&&document.querySelector("#site-content").hidden&&document.querySelector("#site-content").inert'));
 assert.ok(await chrome.evaluate('!document.querySelector("#visitor-form button").disabled'));
 const gateShot=await chrome.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 writeFileSync('test-output/visitor-gate.png',Buffer.from(gateShot.data,'base64'));screenshots.push('visitor-gate.png');
 await chrome.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert.ok(await chrome.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
 const mobileGate=await chrome.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 writeFileSync('test-output/visitor-gate-mobile.png',Buffer.from(mobileGate.data,'base64'));screenshots.push('visitor-gate-mobile.png');
 await chrome.evaluate('document.querySelector("#visitor-passphrase").value="wrong-synthetic-code";document.querySelector("#visitor-form").requestSubmit()');
 await waitFor('document.querySelector("#visitor-message").textContent.includes("غير صحيح")');
 assert.ok(await chrome.evaluate('document.querySelector("#site-content").hidden&&document.querySelector("#visitor-passphrase").value===""'));
 await chrome.evaluate('document.querySelector("#visitor-passphrase").value='+JSON.stringify(testPhrase)+';document.querySelector("#visitor-form").requestSubmit()');
 await waitFor('document.querySelector("#visitor-gate").hidden');
 assert.equal(await chrome.evaluate('localStorage.getItem("written-library-visitor:"+document.body.dataset.base)'),testVerifier);
 await chrome.navigate(origin+base+'__gate-test-next/');
 await waitFor('document.querySelector("#visitor-gate").hidden');
 await chrome.evaluate('document.querySelector("[data-visitor-lock]").click()');
 assert.ok(await chrome.evaluate('!document.querySelector("#visitor-gate").hidden&&localStorage.getItem("written-library-visitor:"+document.body.dataset.base)===null'));
 await chrome.navigate(origin+base+'documents/d545/s584/');
 assert.ok(await chrome.evaluate('!document.querySelector("#visitor-gate").hidden'));
 // The real verifier is public: this intentional bypass illustrates the UI-only trust model.
 await chrome.evaluate('localStorage.setItem("written-library-visitor:"+document.body.dataset.base,'+JSON.stringify(realVerifier)+')');
 await chrome.navigate(origin+base);
 await waitFor('document.querySelector("#visitor-gate").hidden');
 console.log('Visitor gate: wrong/right synthetic passphrase, remembered navigation, Lock and direct-reader gate passed.');
 const results=await chrome.evaluate("(async()=>{\n const base=document.body.dataset.base;\n const {normalize,presentResult}=await import(base+'__test-lib.js');\n const pf=await import(base+'pagefind/pagefind.js');\n await pf.options({baseUrl:base,excerptLength:24});\n const check=(ok,message)=>{if(!ok)throw Error(message);};\n const ids=async(q,options)=> (await pf.search(normalize(q),options)).results.map(r=>r.id).sort();\n for(const [a,b] of [['أب','اب'],['إيمان','ايمان'],['وُلدت','ولدت'],['الـكـتـاب','الكتاب'],['ٱلإيمان','الايمان'],['آدم','ادم']]){\n  const left=await ids(a),right=await ids(b);\n  check(left.length>0,'No real hits '+a);\n  check(JSON.stringify(left)===JSON.stringify(right),'Normalization differs '+a);\n }\n const q=await pf.search(normalize('\"صمت الدارسين عبرة\"'));\n check(q.results.length>0,'Long chapter phrase missing');\n const bodies=await Promise.all(q.results.map(r=>r.data()));\n const item=bodies.find(d=>d.url.includes('/d545/s584/'));\n check(item,'Expected section 584 missing');\n const display=presentResult(item);\n check(display.snippetHtml.includes('<mark>'),'Missing original-text highlight');\n check(display.anchor==='passage-91','Wrong phrase anchor '+display.anchor);\n check(display.snippetHtml.includes('الدارسين'),'Original snippet missing');\n const quote=await pf.search(normalize('\"توجيهات أب اعترافي\"'),{filters:{type:'book'}});\n check(quote.results.length>0,'Book quote missing');\n const found=await Promise.all(quote.results.map(r=>r.data()));\n check(found.every(d=>d.meta.type==='book'),'Type filter leaked');\n check(found.some(d=>presentResult(d).snippetHtml.includes('أب')),'Original Alef spelling missing');\n const excluded=await pf.search(normalize('\"توجيهات أب اعترافي\"'),{filters:{type:'article'}});\n check(excluded.results.length===0,'Book phrase appeared in articles');\n const title=await pf.search(normalize('\"كتاب بين العهدين\"'));\n check(title.results.length>=15,'Book title does not cover chapters');\n const authors=await pf.search(normalize('محاكمة البابا شنودة'));\n check(authors.results.length>0,'Multiword query missing');\n return {normalizationPairs:6,longPhraseSection:item.url,anchor:display.anchor,phraseResults:q.results.length,bookTitleResults:title.results.length};\n})()");
 console.log('Real Pagefind WASM tests '+JSON.stringify(results));
 const recordCount=await chrome.evaluate('(async()=>{const pf=await import(document.body.dataset.base+"pagefind/pagefind.js");const filters=await pf.filters();return Object.values(filters.type).reduce((sum,n)=>sum+n,0);})()');
 assert.equal(recordCount,661,'AI exports must not add duplicate Pagefind records');
 await chrome.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await chrome.navigate(origin+base+'documents/d543/');
 assert.equal(await chrome.evaluate('document.querySelectorAll(".book-page-index a").length'),120);
 assert.ok(await chrome.evaluate('!document.querySelector(".book-overview").textContent.includes("أجزاء")'));
 const bookOverviewShot=await chrome.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 writeFileSync('test-output/book-overview.png',Buffer.from(bookOverviewShot.data,'base64'));screenshots.push('book-overview.png');
 await chrome.evaluate('document.querySelector("[data-toc-filter]").value="١٢٠";document.querySelector("[data-toc-filter]").dispatchEvent(new Event("input"))');
 assert.equal(await chrome.evaluate('document.querySelectorAll(".book-page-index [data-toc-entry]:not([hidden])").length'),1);
 await chrome.navigate(origin+base+'documents/d543/pages/p1/');
 await waitFor('document.querySelector("[data-paged-reader]")?.dataset.readerReady==="true"&&!document.querySelector("#site-content").hidden');
 assert.ok(await chrome.evaluate('!document.querySelector(".page-turner [rel=prev]")'));
 await chrome.evaluate('const form=document.querySelector("[data-page-jump]");form.querySelector("input").value="999";form.requestSubmit()');
 assert.ok(await chrome.evaluate('!document.querySelector("[data-page-error]").hidden&&location.pathname.endsWith("/p1/")'));
 await chrome.evaluate('document.querySelector("[data-page-jump] input").focus()');
 await chrome.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
 await chrome.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
 assert.ok(await chrome.evaluate('location.pathname.endsWith("/p1/")'));
 await chrome.evaluate('document.activeElement.blur()');
 await chrome.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
 await chrome.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
 await waitFor('location.pathname.endsWith("/p2/")&&document.querySelector("[data-paged-reader]")?.dataset.readerReady==="true"&&document.querySelector("[data-page-number]")?.dataset.pageNumber==="2"&&!document.querySelector("#site-content").hidden');
 await chrome.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
 await chrome.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
 await waitFor('location.pathname.endsWith("/p1/")&&document.querySelector("[data-paged-reader]")?.dataset.readerReady==="true"&&document.querySelector("[data-page-number]")?.dataset.pageNumber==="1"&&!document.querySelector("#site-content").hidden');
 await chrome.evaluate('const form=document.querySelector("[data-page-jump]");form.querySelector("input").value="١٢٠";form.requestSubmit()');
 await waitFor('location.pathname.endsWith("/p120/")&&document.querySelector("[data-paged-reader]")?.dataset.readerReady==="true"&&document.querySelector("[data-page-number]")?.dataset.pageNumber==="120"');
 assert.ok(await chrome.evaluate('!document.querySelector(".page-turner [rel=next]")'));
 await chrome.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await chrome.navigate(origin+base+'documents/d543/pages/p15/');
 assert.ok(await chrome.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
 const bookReaderShot=await chrome.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 writeFileSync('test-output/book-reader-mobile.png',Buffer.from(bookReaderShot.data,'base64'));screenshots.push('book-reader-mobile.png');
 console.log('Real page reader: page indexes, Arabic page jump, invalid numbers, RTL keyboard turns, input focus guards and mobile layout passed.');
 await chrome.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await chrome.navigate(origin+base+'search/?q='+encodeURIComponent('إيمان')+'&type=book');
 await waitFor('document.querySelectorAll(".search-hit").length>0');
 const ui=await chrome.evaluate("({marks:document.querySelectorAll('.search-hit mark').length,links:[...document.querySelectorAll('.search-hit h2 a')].map(a=>a.getAttribute('href')),width:document.documentElement.scrollWidth,viewport:innerWidth})");
 assert.ok(ui.marks>0);
 assert.ok(ui.links.every(link=>link.includes('/documents/')&&link.includes('#passage-')));
 assert.ok(ui.links.every(link=>link.includes('/pages/p')),'Book search results must open actual pages');
 assert.ok(ui.width<=ui.viewport+1);
 await chrome.navigate(origin+base);
 assert.ok(await chrome.evaluate("document.documentElement.scrollWidth<=innerWidth+1"));
 const shot=await chrome.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 writeFileSync('test-output/mobile-home.png',Buffer.from(shot.data,'base64'));screenshots.push('mobile-home.png');
 await chrome.navigate(origin+base+'documents/d545/s584/?q='+encodeURIComponent('صمت الدارسين عبرة')+'#passage-91');
 await waitFor('!!document.querySelector("[data-paged-reader]")');
 assert.ok(await chrome.evaluate("document.querySelector('.prose').textContent.includes('صمت الدارسين عبرة')"));
 assert.ok(await chrome.evaluate("document.querySelector('.prose').textContent.length>100"));
 assert.ok(await chrome.evaluate("document.querySelectorAll('.prose mark').length>0"));
 assert.ok(await chrome.evaluate("document.documentElement.scrollWidth<=innerWidth+1"));
 const reader=await chrome.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 writeFileSync('test-output/mobile-reader.png',Buffer.from(reader.data,'base64'));screenshots.push('mobile-reader.png');
 await chrome.navigate(origin+base+'__fixture/');
 assert.equal(await chrome.evaluate("document.querySelectorAll('table tr').length"),26);
 assert.ok(await chrome.evaluate("document.querySelector('a').hash==='#note-_ftn1'&&!!document.getElementById('note-_ftn1')"));
 assert.ok(await chrome.evaluate("!window.bad&&document.documentElement.scrollWidth<=innerWidth+1"));
 console.log('Mobile 390px UI, long chapter, snippets, matching anchors, table and footnote passed.');
 await chrome.navigate(origin+base+'__editor/');
 const edited=await chrome.evaluate(`(async()=>{
  document.querySelector('#new-document').click();
  document.querySelector('#title').value='مقال تجريبي';
  document.querySelector('#author').value='مؤلف تجريبي';
  const transfer=new DataTransfer();
  transfer.setData('text/html','<h2 onclick="bad()">عنوان</h2><p><strong>نص عربي</strong></p><table><tr><td>خلية</td></tr></table><script>window.bad=true</script>');
  const rich=document.querySelector('#rich');rich.focus();
  rich.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true}));
  if(!rich.querySelector('table')||rich.querySelector('script,[onclick]'))throw Error('Word paste sanitization failed');
  HTMLAnchorElement.prototype.click=function(){};
  const create=URL.createObjectURL.bind(URL);
  URL.createObjectURL=function(blob){window.savedBlob=blob;return create(blob);};
  document.querySelector('#save-section').click();
  const section=await window.savedBlob.text();
  document.querySelector('#save-metadata').click();
  const metadata=JSON.parse(await window.savedBlob.text());
  if(!section.includes('نص عربي')||metadata.title!=='مقال تجريبي'||metadata.sections.length!==1)throw Error('Editor export failed');
  document.querySelector('#new-section').click();
  document.querySelector('#section-heading').value='فصل ثانٍ';
  document.querySelector('#type').value='book';
  document.querySelector('#save-metadata').click();
  const book=JSON.parse(await window.savedBlob.text());
  if(book.type!=='book'||book.sections.length!==2||book.sections[1].heading!=='فصل ثانٍ')throw Error('Chapter metadata failed');
  return {newDocument:true,wordPaste:true,sanitization:true,newChapter:true};
 })()`);
 console.log('Local nontechnical editor '+JSON.stringify(edited));
 writeFileSync('test-output/browser-report.json',JSON.stringify({base,search:results,mobileWidth:390,screenshots,status:'PASS'},null,2));
}finally{await chrome.close();server.close();}


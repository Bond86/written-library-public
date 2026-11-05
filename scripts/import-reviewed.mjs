import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {verifyStoredHtml} from '../lib/text.mjs';

const path=process.argv[2];
if(!path) throw Error('Supply the verified reviewed-drafts.json path.');
const bytes=readFileSync(path);
const checksum=createHash('sha256').update(bytes).digest('hex');
assert.equal(checksum,'cccbc1c47ebacb1c8d1b7fea119a17377e60bde31072620364d413ca467ec7a8','Source checksum mismatch');
const source=JSON.parse(bytes);
assert.equal(source.documents.length,605);
assert.equal(source.sections.length,661);
assert.ok(source.documents.every(d=>d[11]===null));
if(readdirSync('content').length) throw Error('Import requires an empty content directory.');
const groups=Map.groupBy(source.sections,s=>s[1]);
for(const [id,type,title,author,...details] of source.documents){
 const directory=join('content','d'+id);
 mkdirSync(directory);
 const sections=groups.get(id).sort((a,b)=>a[4]-b[4]||a[0]-b[0]).map(([sid,,chapter,heading,position,html])=>{
  verifyStoredHtml(html);
  const file='s'+sid+'.html';
  writeFileSync(join(directory,file),html,{flag:'wx'});
  return {id:sid,file,chapter,heading,position};
 });
 const metadata={id,type,title,author,date:details[4]||null,category:details[0]||null,tags:details[1]||null,sections};
 writeFileSync(join(directory,'metadata.json'),JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
}
writeFileSync('audit/import.json',JSON.stringify({sourceSha256:checksum,documents:605,sections:661,
 sectionChecksums:source.sections.map(s=>({document:s[1],section:s[0],sha256:createHash('sha256').update(s[5]).digest('hex')}))},null,2));
console.log('Imported only public HTML and metadata: 605 documents, 661 sections.');


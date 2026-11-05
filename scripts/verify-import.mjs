import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadContent} from '../lib/content.mjs';
const docs=loadContent(),sections=docs.flatMap(d=>d.sections);
assert.equal(docs.length,605);
assert.equal(sections.length,661);
const audit=JSON.parse(readFileSync('audit/import.json','utf8'));
for(const item of audit.sectionChecksums){
 const file='content/d'+item.document+'/s'+item.section+'.html';
 assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),item.sha256,file);
}
console.log('Initial migration verified: 605 documents, 661 byte-identical HTML sections.');

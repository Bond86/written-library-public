import test from 'node:test';import assert from 'node:assert/strict';
import {paginateResults,SEARCH_PAGE_SIZE} from '../lib/pagination.mjs';
test('search pages show twenty results with exact first and last ranges',()=>{
 assert.equal(SEARCH_PAGE_SIZE,20);
 assert.deepEqual(paginateResults(100,2),{page:2,pages:5,start:20,end:40,items:[1,2,3,4,5]});
 assert.equal(paginateResults(20).pages,1);assert.equal(paginateResults(21).pages,2);
 assert.deepEqual([paginateResults(0).start,paginateResults(0).end],[0,0]);
 assert.deepEqual([paginateResults(661,34).start,paginateResults(661,34).end],[660,661]);
});
test('invalid or excessive page parameters are normalized within bounds',()=>{
 for(const input of [0,-1,'no','2.5','Infinity','1e2','9'.repeat(100)])assert.equal(paginateResults(100,input).page,1);
 assert.equal(paginateResults(100,999).page,5);
 assert.equal(paginateResults(0,999).page,1);
});
test('large page counts retain first, last and nearby numbered links with bounded gaps',()=>{
 for(let page=1;page<=34;page++){
  const state=paginateResults(661,page),numbers=state.items.filter(n=>n!==null);
  assert.ok(numbers.includes(1)&&numbers.includes(34)&&numbers.includes(page));
  assert.equal(new Set(numbers).size,numbers.length);assert.ok(state.items.length<=9);
  assert.ok(numbers.every(n=>n>=1&&n<=34));
 }
});
test('all result pages cover every result once with no accumulation or omission',()=>{
 const source=Array.from({length:101},(_,i)=>i),seen=[];
 for(let page=1;page<=paginateResults(source.length).pages;page++){
  const state=paginateResults(source.length,page),items=source.slice(state.start,state.end);
  assert.ok(items.length<=20);seen.push(...items);
 }
 assert.deepEqual(seen,source);
});

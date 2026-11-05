import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {parseDocument} from 'htmlparser2';
import {verifyStoredHtml} from './text.mjs';

export const types={article:'مقالات',lecture:'محاضرات',book:'كتب'};
const blockTags=new Set('p div h1 h2 h3 h4 h5 h6 li blockquote pre tr td th br hr'.split(' '));
export function extractText(html){
  let text='';
  const anchors=[];
  function space(){if(text&&!text.endsWith(' '))text+=' ';}
  function walk(node,anchor=''){
    if(node.type==='text'){
      const value=node.data.replace(/\s+/gu,' ');
      if(value.trim()) {
        if(anchor)anchors.push([text.length,anchor]);
        text+=value;
      } else space();
      return;
    }
    const block=blockTags.has(node.name);
    if(block)space();
    const current=node.attribs?.id||anchor;
    for(const child of node.children||[])walk(child,current);
    if(block)space();
  }
  walk(parseDocument(html));
  return {text:text.trimEnd(),anchors:anchors.filter((a,i)=>!i||a[1]!==anchors[i-1][1])};
}
export function loadContent(root='content'){
  const docs=[];
  for(const folder of readdirSync(root).sort()){
    if(!/^d[1-9]\d*$/u.test(folder))throw Error('Unexpected content directory');
    const dir=join(root,folder);
    const metadata=JSON.parse(readFileSync(join(dir,'metadata.json'),'utf8'));
    const allowed=['id','type','title','author','date','category','tags','sections'];
    if(Object.keys(metadata).some(k=>!allowed.includes(k))||
      !Object.hasOwn(types,metadata.type)||folder!=='d'+metadata.id||
      typeof metadata.title!=='string'||!metadata.title.trim()||
      typeof metadata.author!=='string'||!Array.isArray(metadata.sections)||!metadata.sections.length)throw Error('Invalid document '+folder);
    const files=new Set(['metadata.json']);
    const ids=new Set();
    metadata.sections=metadata.sections.map(s=>{
      if(!Number.isSafeInteger(s.id)||ids.has(s.id)||typeof s.heading!=='string'||
        !Number.isSafeInteger(s.position)||s.file!=='s'+s.id+'.html'||
        Object.keys(s).some(k=>!['id','file','chapter','heading','position'].includes(k)))throw Error('Invalid section '+folder);
      ids.add(s.id);files.add(s.file);
      const html=readFileSync(join(dir,s.file),'utf8');
      verifyStoredHtml(html);
      const extracted=extractText(html);
      return {...s,html,...extracted};
    }).sort((a,b)=>a.position-b.position||a.id-b.id);
    if(readdirSync(dir).some(file=>!files.has(file)))throw Error('Unexpected file in '+folder);
    docs.push(metadata);
  }
  return docs;
}


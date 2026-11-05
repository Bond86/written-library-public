import { parseDocument } from 'htmlparser2';

const entities = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
export const escape = (s = '') => String(s ?? '').replace(/[&<>"']/g, c => entities[c]);
const marks = /[\u0610-\u061a\u0640\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7-\u06e8\u06ea-\u06ed\u08d3-\u08ff]/gu;
export const normalize = (s = '') => s.replace(/[أإآٱ]/gu, 'ا').replace(marks, '');

const allowed = new Set('p div span h1 h2 h3 h4 h5 h6 strong em b i u s br hr blockquote pre code ol ul li table caption thead tbody tfoot tr th td sup sub a'.split(' '));
const discard = new Set('script style svg math template iframe object embed applet frame frameset noscript noembed form input button textarea select audio video canvas img link meta base'.split(' '));
const blocks = new Set('p h1 h2 h3 h4 h5 h6 li blockquote pre tr caption'.split(' '));
const anchorPattern = /^(?:passage-(?:[a-f0-9]{32}-\d+-\d+-)?\d+|note-[A-Za-z0-9_.:-]+)$/u;
function wordItem(node) {
  if (node.name!=='p' || !/\bmso-list\s*:\s*l\d+\s+level\d+/iu.test(node.attribs?.style || '')) return null;
  const marker=(node.children || []).find(child=>/\bmso-list\s*:\s*ignore\b/iu.test(child.attribs?.style || ''));
  if (!marker) return null;
  const text = child => child.data ?? (child.children || []).map(text).join('');
  const prefix = text(marker).trim().replace(/[٠-٩]/gu, digit=>String(digit.charCodeAt(0)-0x660));
  const number = /^(\d{1,4})[.)]$/u.exec(prefix)?.[1];
  if (!number && !/^[•·●▪◦\-–\uf0b7]$/u.test(prefix)) return null;
  return {marker,number,tag:number?'ol':'ul'};
}
function safeAttribute(tag, key, value) {
  if (key==='id') return anchorPattern.test(value);
  if (key==='dir') return /^(rtl|ltr|auto)$/u.test(value);
  if (key==='href') return tag==='a' && value.startsWith('#') && anchorPattern.test(value.slice(1));
  if (key==='type') return tag==='ol' && /^[1aAiI]$/u.test(value);
  return /^\d{1,4}$/u.test(value) &&
    (['td','th'].includes(tag) && ['colspan','rowspan'].includes(key) || tag==='ol' && key==='start' || tag==='li' && key==='value');
}

export function verifyStoredHtml(html) {
  if (typeof html!=='string' || new TextEncoder().encode(html).length>300000 || html.includes('\0')) throw new Error('Invalid stored HTML');
  const pending = [...parseDocument(html).children];
  while (pending.length) {
    const node = pending.pop();
    if (node.type==='text') continue;
    if (node.type!=='tag' || !allowed.has(node.name) || !Object.entries(node.attribs).every(([key,value])=>safeAttribute(node.name,key,value))) {
      throw new Error('Unsafe stored HTML');
    }
    pending.push(...node.children);
  }
}
export function cleanHtml(source, collectPassages = true, anchorPrefix = 'passage-', anchors) {
  if (new TextEncoder().encode(source).length > 131072 || source.includes('\0')) throw new Error('HTML_LIMIT');
  return renderHtml(parseDocument(source),collectPassages,anchorPrefix,anchors);
}

function renderHtml(dom, collectPassages, anchorPrefix, anchors) {
  const passages = [];
  const identifiers = new Set();
  let count = 0;
  let passageCount = 0;
  function children(nodes,depth,current,ignored) {
    let result='', list=null;
    for (const node of nodes) {
      if (node === ignored) continue;
      const item=node.attribs?.style ? wordItem(node) : null;
      if (list && node.type==='text' && !node.data.trim()) continue;
      if (list && (!item || item.tag!==list)) { result+='</'+list+'>'; list=null; }
      if (item && !list) {
        list=item.tag;
        result+='<'+list+(item.number && item.number!=='1'?' start="'+item.number+'"':'')+'>';
      }
      result+=render(node,depth,current,item);
    }
    return result+(list?'</'+list+'>':'');
  }
  function render(node, depth, current, item) {
    if (++count > 18000 || depth > 80) throw new Error('HTML_LIMIT');
    if (node.type === 'text') {
      if (current) {
        if (collectPassages) current.text += node.data;
      } else if (node.data.trim()) {
        passageCount++;
        if (collectPassages) passages.push({anchor:null, text:node.data});
      }
      return escape(node.data);
    }
    if ((node.type !== 'tag' && node.type !== 'root') || discard.has(node.name)) return '';
    let tag = node.name;
    const attrs = node.attribs || {};
    if (tag?.startsWith('o:') && !(node.children || []).some(child => child.data?.trim() || child.children?.length)) return '';
    if (tag === 'b') tag = 'strong';
    if (tag === 'i') tag = 'em';
    if (item) tag='li';
    let id = attrs.id || attrs.name;
    if (id && /^_ftn(?:ref)?\d+$/iu.test(id)) id = 'note-' + id;
    if (!id || !anchorPattern.test(id) || identifiers.has(id)) id = null;
    const isBlock = blocks.has(tag);
    if (isBlock && !id) {
      let candidate = passageCount + 1;
      do { id = anchorPrefix + candidate++; } while (identifiers.has(id));
    }
    if (id) identifiers.add(id);
    let block = current;
    if (isBlock && !current) {
      passageCount++;
      block = collectPassages ? {anchor:id,text:''} : true;
      if (collectPassages) passages.push(block);
    }
    const css = attrs.style;
    let inner = children(node.children,depth+1,block,item?.marker);
    if (collectPassages && tag === 'br' && block) block.text += ' ';
    if (css && tag !== 'strong' && /(?:^|;)\s*(?:mso-bidi-)?font-weight\s*:\s*(?:bold|[6-9]00)\b/iu.test(css)) inner = '<strong>' + inner + '</strong>';
    if (css && tag !== 'em' && /(?:^|;)\s*(?:mso-bidi-)?font-style\s*:\s*(?:italic|oblique)\b/iu.test(css)) inner = '<em>' + inner + '</em>';
    if (!allowed.has(tag)) return inner;
    if (id && anchors) anchors.push(id);
    let safe = id ? ` id="${id}"` : '';
    if (item?.number) safe += ` value="${item.number}"`;
    if (attrs.dir && safeAttribute(tag,'dir',attrs.dir)) safe += ` dir="${attrs.dir}"`;
    if (tag === 'a' && attrs.href) {
      const href = attrs.href.replace(/^#(_ftn(?:ref)?\d+)$/iu,'#note-$1');
      if (safeAttribute(tag,'href',href)) safe += ` href="${href}"`;
    }
    if (tag === 'td' || tag === 'th') {
      if (attrs.colspan && safeAttribute(tag,'colspan',attrs.colspan)) safe += ` colspan="${attrs.colspan}"`;
      if (attrs.rowspan && safeAttribute(tag,'rowspan',attrs.rowspan)) safe += ` rowspan="${attrs.rowspan}"`;
    } else if (tag === 'ol') {
      if (attrs.start && safeAttribute(tag,'start',attrs.start)) safe += ` start="${attrs.start}"`;
      if (attrs.type && safeAttribute(tag,'type',attrs.type)) safe += ` type="${attrs.type}"`;
    } else if (tag === 'li' && attrs.value && safeAttribute(tag,'value',attrs.value)) {
      safe += ` value="${attrs.value}"`;
    }
    if (collectPassages && block && (tag === 'td' || tag === 'th')) block.text += ' ';
    return '<' + tag + safe + '>' +
      (tag === 'br' || tag === 'hr' ? '' : inner + '</' + tag + '>');
  }
  const html = render(dom, 0, null);
  if (!collectPassages) return {html};
  return {html, passages:passages.map(p => ({...p,text:p.text.replace(/\s+/gu,' ').trim()})).filter(p => p.text)};
}


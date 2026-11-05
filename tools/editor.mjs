import {cleanHtml} from '../lib/text.mjs';
const rich=document.querySelector('#rich'),message=document.querySelector('#message');
let filename='section.html',metadata;
const sectionSelect=document.querySelector('#section');
function sectionFields(){
 const section=metadata?.sections.find(s=>String(s.id)===sectionSelect.value);
 if(!section)return;
 for(const field of ['heading','chapter','position'])document.querySelector('#section-'+field).value=section[field]??'';
 filename=section.file;
 document.querySelector('#filename').textContent=filename;
}
function refresh(){
 sectionSelect.replaceChildren();
 for(const section of metadata.sections){
  const option=document.createElement('option');option.value=String(section.id);option.textContent=section.heading;sectionSelect.append(option);
 }
 document.querySelector('#folder').textContent='content/d'+metadata.id+'/';
 sectionFields();
}
function updateSection(){
 const section=metadata?.sections.find(s=>String(s.id)===sectionSelect.value);
 if(!section)return;
 section.heading=document.querySelector('#section-heading').value.trim()||'النص';
 section.chapter=document.querySelector('#section-chapter').value.trim()||null;
 const position=Number(document.querySelector('#section-position').value);
 if(!Number.isSafeInteger(position)||position<0)throw Error('راجع ترتيب القسم.');
 section.position=position;
}
sectionSelect.addEventListener('change',()=>{sectionFields();rich.replaceChildren();notice('افتح ملف القسم المحدد لتحرير نصه.');});
document.querySelector('#new-document').addEventListener('click',()=>{
 const id=Date.now();
 metadata={id,type:'article',title:'مادة جديدة',author:'',date:null,category:null,tags:null,
 sections:[{id:id+1,file:'s'+(id+1)+'.html',chapter:null,heading:'النص',position:1}]};
 rich.replaceChildren();refresh();
 for(const field of ['title','author','date'])document.querySelector('#'+field).value=metadata[field]||'';
 document.querySelector('#type').value='article';
 notice('أدخل البيانات والنص ثم نزّل ملف القسم وبيانات المادة. أنشئ المجلد الظاهر في GitHub وارفع الملفين إليه.');
});
document.querySelector('#new-section').addEventListener('click',()=>{
 if(!metadata){notice('افتح بيانات مادة أو أنشئ مادة أولًا.');return;}
 updateSection();
 const id=Date.now();
 if(metadata.sections.some(s=>s.id===id))return;
 metadata.sections.push({id,file:'s'+id+'.html',chapter:null,heading:'قسم جديد',position:Math.max(...metadata.sections.map(s=>s.position))+1});
 refresh();sectionSelect.value=String(id);sectionFields();rich.replaceChildren();
 notice('اكتب القسم الجديد ثم نزّل ملفه واحفظ بيانات المادة أيضًا.');
});
function notice(text){message.textContent=text;}
function download(name,text,type){
 const blob=new Blob([text],{type});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
document.querySelector('#open-section').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;
 try{
  const source=await file.text();
  rich.innerHTML=cleanHtml(source).html;filename=file.name;
  const selected=metadata?.sections.find(s=>s.file===filename);
  if(selected){sectionSelect.value=String(selected.id);sectionFields();}
  document.querySelector('#filename').textContent=filename;notice('تم فتح القسم. احفظ نسخة بعد المراجعة.');
 }catch{notice('تعذر فتح الملف. اختر قسم HTML من مجلد المحتوى.');}
});
document.querySelector('#open-metadata').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;
 try{
  const value=JSON.parse(await file.text());
  if(!['article','lecture','book'].includes(value.type)||!Array.isArray(value.sections))throw Error();
  metadata=value;
  refresh();
  for(const field of ['title','author','date'])document.querySelector('#'+field).value=value[field]||'';
  document.querySelector('#type').value=value.type;
  notice('تم فتح بيانات المادة. يمكنك تعديل العنوان والمؤلف والتاريخ.');
 }catch{notice('تعذر فتح ملف metadata.json.');}
});
document.querySelector('#save-section').addEventListener('click',()=>{
 try{updateSection();const html=cleanHtml(rich.innerHTML).html;rich.innerHTML=html;download(filename,html,'text/html;charset=utf-8');notice('حُفظ القسم في التنزيلات. ارفعه مكان الملف نفسه في GitHub.');}
 catch{notice('تعذر الحفظ. حجم القسم أو تركيبه أكبر من الحد المسموح.');}
});
document.querySelector('#save-metadata').addEventListener('click',()=>{
 if(!metadata){notice('افتح metadata.json الخاص بالمادة أولًا.');return;}
 try{updateSection();}catch(e){notice(e.message);return;}
 for(const field of ['title','author','date'])metadata[field]=document.querySelector('#'+field).value.trim()||null;
 if(!metadata.title||!metadata.author){notice('أدخل العنوان والمؤلف.');return;}
 metadata.type=document.querySelector('#type').value;
 download('metadata.json',JSON.stringify(metadata,null,2)+'\n','application/json;charset=utf-8');
 notice('حُفظت بيانات المادة. ارفعها في مجلد المادة نفسه.');
});
document.querySelectorAll('[data-command]').forEach(button=>{
 button.addEventListener('mousedown',event=>event.preventDefault());
 button.addEventListener('click',()=>{
  const [command,value]=button.dataset.command.split(':');
  rich.focus();document.execCommand(command,false,value);
 });
});
document.querySelector('#table').addEventListener('click',()=>{
 rich.focus();document.execCommand('insertHTML',false,'<table><tbody><tr><th>العنوان</th><th>العنوان</th></tr><tr><td>النص</td><td>النص</td></tr></tbody></table>');
});
rich.addEventListener('paste',event=>{
 event.preventDefault();
 try{
  const html=event.clipboardData.getData('text/html');
  const plain=event.clipboardData.getData('text/plain');
  const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const source=html||plain.split(/\r?\n/u).map(line=>'<p>'+escape(line)+'</p>').join('');
  const clean=cleanHtml(source).html;
  document.execCommand('insertHTML',false,clean);
 }catch{notice('تعذر لصق النص. قسّم النص الكبير إلى أقسام أقصر.');}
});
rich.addEventListener('drop',event=>event.preventDefault());


// A convenience screen only: the HTML, AI files and verifier remain public.
const gate=document.querySelector('#visitor-gate');
if(gate){
 const content=document.querySelector('#site-content');
 const input=document.querySelector('#visitor-passphrase');
 const message=document.querySelector('#visitor-message');
 const form=document.querySelector('#visitor-form');
 const button=form.querySelector('button');
 const digest=gate.dataset.verifier;
 const key='written-library-visitor:'+document.body.dataset.base;
 let remembered=false;
 const stored=()=>{try{return localStorage.getItem(key)===digest;}catch{return false;}};
 function display(open){
  gate.hidden=open;content.hidden=!open;content.inert=!open;
  document.documentElement.toggleAttribute('data-visitor-locked',!open);
 }
 function lock(){
  try{localStorage.removeItem(key);}catch{}
  remembered=false;input.value='';message.textContent='تم قفل واجهة القراءة على هذا المتصفح.';
  display(false);input.focus();
 }
 for(const lockButton of document.querySelectorAll('[data-visitor-lock]'))lockButton.addEventListener('click',lock);
 if(!/^[a-f0-9]{64}$/u.test(digest)){
  message.textContent='لم يتم إعداد رمز الزيارة بعد. النصوص العامة متاحة من الرابط أدناه.';
 }else{
  form.addEventListener('submit',async event=>{
   event.preventDefault();button.disabled=true;message.textContent='';
   try{
    const bytes=new TextEncoder().encode(input.value);
    const result=await crypto.subtle.digest('SHA-256',bytes);
    bytes.fill(0);input.value='';
    const actual=Array.from(new Uint8Array(result),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(actual!==digest){message.textContent='رمز الزيارة غير صحيح. حاول مرة أخرى.';input.focus();return;}
    try{localStorage.setItem(key,digest);remembered=true;}catch{
     message.textContent='التخزين المحلي غير متاح؛ يلزم إدخال الرمز عند فتح صفحة أخرى.';
    }
    display(true);
    document.querySelector('#main')?.focus({preventScroll:true});
   }catch{
    message.textContent='تعذر التحقق محليًا. افتح الموقع عبر HTTPS أو استخدم رابط النصوص العامة.';
   }finally{button.disabled=false;}
  });
  button.disabled=false;
  remembered=stored();display(remembered);
  window.addEventListener('storage',event=>{
   if(event.key===key||event.key===null){remembered=stored();display(remembered);}
  });
  window.addEventListener('pageshow',()=>{if(remembered&&!stored())display(false);});
 }
}

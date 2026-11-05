import {spawn} from 'node:child_process';
import {mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {once} from 'node:events';
export async function browser(){
 const candidates=[process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean);
 const exe=candidates.find(existsSync);
 if(!exe)throw Error('Set CHROME_PATH to an installed Chrome or Chromium browser.');
 mkdirSync('test-output',{recursive:true});
 const child=spawn(exe,['--headless',...(process.env.CI?['--no-sandbox']:[]),'--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+resolve('test-output/chrome-'+Date.now()),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 const ws=await new Promise((yes,no)=>{
  let stderr='';const timer=setTimeout(()=>no(Error('Chrome startup timed out')),20000);
  child.stderr.on('data',chunk=>{stderr+=chunk;const match=/DevTools listening on (ws:\/\/[^\s]+)/u.exec(stderr);if(match){clearTimeout(timer);yes(match[1]);}});
  child.on('error',no);
 });
 const socket=new WebSocket(ws);await once(socket,'open');
 let next=0;const pending=new Map();
 socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  const task=pending.get(message.id);
  if(task){pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}
 });
 const send=(method,params={},sessionId)=>new Promise((resolveReply,reject)=>{
  const id=++next;pending.set(id,{resolve:resolveReply,reject});
  socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
 });
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const tab=(method,params={})=>send(method,params,sessionId);
 const evaluate=async expression=>{
  const reply=await tab('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(reply.exceptionDetails)throw Error(reply.exceptionDetails.exception?.description||reply.exceptionDetails.text);
  return reply.result.value;
 };
 const navigate=async url=>{
  await tab('Page.navigate',{url});
  for(let i=0;i<150;i++){
   if(await evaluate('document.readyState==="complete"'))return;
   await new Promise(r=>setTimeout(r,100));
  }
  throw Error('Page load timed out');
 };
 return {send:tab,evaluate,navigate,close:async()=>{try{await send('Browser.close');}catch{}socket.close();child.kill();}};
}

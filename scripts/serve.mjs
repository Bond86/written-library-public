import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const mime={'.html':'text/html; charset=utf-8','.txt':'text/plain; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.wasm':'application/wasm'};
export function serve(root='dist',port=0,extra){
 const directory=resolve(root);
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   if(extra&&await extra(url,req,res))return;
   const path=decodeURIComponent(url.pathname);
   const file=resolve(directory,'.'+path);
   if(!file.startsWith(directory+sep)&&file!==directory){res.writeHead(404);res.end();return;}
   const info=await stat(file);
   const target=info.isDirectory()?resolve(file,'index.html'):file;
   const ext=target.slice(target.lastIndexOf('.'));
   res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'no-store'});
   res.end(await readFile(target));
  }catch{res.writeHead(404);res.end('Not found');}
 });
 return new Promise(resolveReady=>server.listen(port,'127.0.0.1',()=>resolveReady(server)));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const editor=process.argv.includes('--editor');
 const server=await serve(editor?'.':'dist',editor?8091:8090);
 console.log(editor?'Local editor http://127.0.0.1:8091/tools/editor.html':'Local preview http://127.0.0.1:8090/');
 process.on('SIGINT',()=>server.close(()=>process.exit(0)));
}


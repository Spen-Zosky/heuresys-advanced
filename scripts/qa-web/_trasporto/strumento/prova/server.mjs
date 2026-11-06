import http from 'node:http'; import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./banco.html',import.meta.url));
let scritture=0;
http.createServer((q,r)=>{ if(q.method!=='GET'){scritture++;console.log('SCRITTURA ARRIVATA',q.method,q.url)}
 if(q.url==='/'){r.writeHead(200,{'content-type':'text/html'});return r.end(html)}
 if(q.url.startsWith('/api/dati')){r.writeHead(200,{'content-type':'application/json'});return r.end('{}')}
 r.writeHead(404);r.end('no')}).listen(4789,()=>console.log('banco su 4789'));

// Dev server for app/: `node serve.ts` serves it on http://localhost:8080
// (`--port <n>` for another port). Node stdlib only, no build step; it sends the
// MIME types a browser needs and refuses any path outside app/.
import {createReadStream,statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname,join,normalize,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('./app',import.meta.url)));
const args=process.argv.slice(2);
const portIndex=args.indexOf('--port');
const wanted=portIndex===-1?8080:Number(args[portIndex+1]);
const port=Number.isInteger(wanted)&&wanted>0&&wanted<65536?wanted:8080;

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};

createServer((req,res)=>{
  const url=new URL(req.url??'/','http://localhost');
  let pathname;
  try{pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end('bad request');return;}
  if(pathname.endsWith('/'))pathname+='index.html';
  const file=resolve(join(root,normalize(pathname)));
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end('forbidden');return;}
  let size;
  try{const s=statSync(file);if(!s.isFile())throw new Error('not a file');size=s.size;}catch{res.writeHead(404).end('not found');return;}
  res.writeHead(200,{'content-type':MIME[extname(file).toLowerCase()]??'application/octet-stream','content-length':size,'cache-control':'no-store'});
  createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>{console.log(`app/ is on http://localhost:${port}`);});

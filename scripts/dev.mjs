import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { handle, authenticate } from '../lib/server.mjs';
// Local QA only: shared state is in memory. Production always uses Netlify Blobs.
let data=null,version=0;
const store={async getWithMetadata(){return data?{data:structuredClone(data),etag:String(version)}:null;},async setJSON(key,value,opts){if((opts.onlyIfNew&&data)||(opts.onlyIfMatch&&opts.onlyIfMatch!==String(version)))return {modified:false};data=structuredClone(value);version++;return {modified:true};}};
const env={...process.env};
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost:4173');
  if(url.pathname.startsWith('/api/')){
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12000){res.writeHead(413);res.end();return;}}
    const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:raw});
    const response=url.pathname==='/api/auth'?await authenticate(request,env):await handle(request,env,()=>store);
    const headers=Object.fromEntries(response.headers);if(headers['set-cookie'])headers['set-cookie']=headers['set-cookie'].replace('; Secure','');
    res.writeHead(response.status,headers);res.end(await response.text());return;
  }
  const file=resolve('dist',url.pathname==='/'?'index.html':`.${url.pathname}`);
  if(!file.startsWith(resolve('dist')+'/')){res.writeHead(403);res.end();return;}
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));
}catch{res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log('Together preview: http://localhost:4173'));

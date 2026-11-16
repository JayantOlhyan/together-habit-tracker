import { handle } from '../../lib/server.mjs';
import { runtime } from '../../lib/netlify-runtime.mjs';
export default async req=>{
  try { const {env,store}=await runtime();return handle(req,env,()=>store); }
  catch { return Response.json({error:'The shared store is temporarily unavailable. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
};
export const config={path:['/api/status','/api/data','/api/export','/api/habits','/api/archive','/api/entries','/api/undo'],rateLimit:{windowSize:60,windowLimit:120,aggregateBy:['ip']}};

import { authenticate } from '../../lib/server.mjs';
import { runtime } from '../../lib/netlify-runtime.mjs';
export default async req=>{
  try { const {env}=await runtime();return authenticate(req,env); }
  catch { return Response.json({error:'Sign-in is temporarily unavailable. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
};
export const config={path:'/api/auth',rateLimit:{windowSize:60,windowLimit:8,aggregateBy:['ip']}};

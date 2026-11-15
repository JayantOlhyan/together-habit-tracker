import { getStore } from '@netlify/blobs';
import { handle } from '../../lib/server.mjs';
export default req=>handle(req,process.env,()=>getStore({name:'together-family',consistency:'strong'}));
export const config={path:['/api/status','/api/data','/api/export','/api/habits','/api/archive','/api/entries','/api/undo'],rateLimit:{windowSize:60,max:120,aggregateBy:['ip']}};

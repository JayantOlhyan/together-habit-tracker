import { authenticate } from '../../lib/server.mjs';
export default req=>authenticate(req,process.env);
export const config={path:'/api/auth',rateLimit:{windowSize:60,windowLimit:8,aggregateBy:['ip']}};

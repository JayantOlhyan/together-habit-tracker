import { getStore } from '@netlify/blobs';
import { runtimeEnvironment } from './server.mjs';
let pending;
export function runtime(){
  if(!pending) pending=(async()=>{
    const store=getStore({name:'together-family',consistency:'strong'});
    return {store,env:await runtimeEnvironment(store,process.env)};
  })().catch(error=>{pending=undefined;throw error;});
  return pending;
}

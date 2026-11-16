import { runtimeEnvironment } from './server.mjs';
import { protectStore } from './storage.mjs';

export function createRequestRuntime(getStore,getEnvironment=()=>process.env) {
  return async function runtime() {
    // Netlify injects fresh Blobs credentials into each invocation. A Store
    // snapshots those credentials; retaining it across invocations retains an
    // eventually expired token. Do not cache this Store or the returned promise.
    const store=protectStore(getStore({name:'together-family',consistency:'strong'}));
    const env=await runtimeEnvironment(store,getEnvironment());
    return {store,env};
  };
}

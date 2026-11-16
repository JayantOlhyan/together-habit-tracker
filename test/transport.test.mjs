import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../public/transport.mjs';
test('a failed database read retries with a fresh request and retains credentials',async()=>{
  let calls=0;
  const api=createApi(async(url,options)=>{calls++;assert.equal(options.credentials,'same-origin');return calls===1?Response.json({error:'expired provider token'},{status:503}):Response.json({person:'Jayant',entries:[]});});
  assert.equal((await api('data')).person,'Jayant');assert.equal(calls,2);
});
test('writes are not automatically retried after a storage failure',async()=>{
  let calls=0;const api=createApi(async()=>{calls++;return Response.json({error:'provider token internals'},{status:503});});
  await assert.rejects(api('entries',{quantity:1}),e=>e.status===503&&!/token|provider/.test(e.message));assert.equal(calls,1);
});
test('a connection interruption retries a read once',async()=>{
  let calls=0;const api=createApi(async()=>{if(++calls===1)throw new TypeError('fetch failed');return Response.json({configured:true});});
  assert.equal((await api('status')).configured,true);assert.equal(calls,2);
});
test('authentication failures keep their status and are not retried',async()=>{
  let calls=0;const api=createApi(async()=>{calls++;return Response.json({error:'Sign in to see your shared space.'},{status:401});});
  await assert.rejects(api('data'),e=>e.status===401);assert.equal(calls,1);
});

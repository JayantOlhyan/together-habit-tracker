import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { handle, authenticate, signSession, session, ready, runtimeEnvironment } from '../lib/server.mjs';
import { achieved, initialState, today, validateHabit, validDate } from '../lib/model.mjs';
const env={SESSION_SECRET:'test-session-signing-secret-over-32-characters'};
function memoryStore(){let data=null,version=0;return {async getWithMetadata(){return data?{data:structuredClone(data),etag:String(version)}:null;},async setJSON(key,value,opts){if((opts.onlyIfNew&&data)||(opts.onlyIfMatch&&opts.onlyIfMatch!==String(version)))return {modified:false};data=structuredClone(value);version++;return {modified:true,etag:String(version)};}};}
function req(path,person='Jayant',body,origin='https://together.test'){return new Request(`https://together.test/api/${path}`,{method:body?'POST':'GET',headers:{cookie:person?`together_session=${signSession(person,env)}`:'',origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});}
const entry=(id=randomUUID(),person='jayant')=>({id,habitId:`${person}-0`,quantity:2,date:today(),note:''});
test('session signing requires independent secret material',()=>{assert.equal(ready(env),true);assert.equal(ready({SESSION_SECRET:'jayant|babita|naveen'}),false);assert.equal(ready({}),false);});
test('sign-in succeeds, sets secure cookie, rejects bad credentials and cross-origin',async()=>{const make=(data,origin='https://together.test')=>new Request('https://together.test/api/auth',{method:'POST',headers:{origin},body:JSON.stringify(data)});const r=await authenticate(make({person:'Babita',password:'bAbItA'}),env);assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);assert.equal(session(new Request('https://together.test',{headers:{cookie:r.headers.get('set-cookie').split(';')[0]}}),env),'Babita');assert.equal((await authenticate(make({person:'Babita',password:'incorrect'}),env)).status,401);assert.equal((await authenticate(make({person:'Jayant',password:'Jayant'},'https://evil.test'),env)).status,403);});
test('private data requires authentication and setup',async()=>{const store=memoryStore();assert.equal((await handle(req('data',null),env,()=>store)).status,401);assert.equal((await handle(req('data'),{},()=>store)).status,503);});
test('everyone sees all habits, but writes are scoped to the signed-in person',async()=>{const store=memoryStore();let r=await handle(req('data','Babita'),env,()=>store);assert.equal((await r.json()).habits.length,9);r=await handle(req('entries','Babita',entry()),env,()=>store);assert.equal(r.status,400);r=await handle(req('entries','Babita',entry(randomUUID(),'babita')),env,()=>store);assert.equal(r.status,201);const data=await (await handle(req('data','Naveen'),env,()=>store)).json();assert.equal(data.entries[0].owner,'Babita');});
test('concurrent saves do not overwrite each other',async()=>{const store=memoryStore();const rs=await Promise.all(Array.from({length:6},()=>handle(req('entries','Jayant',entry()),env,()=>store)));assert.ok(rs.every(r=>r.status===201));const data=await (await handle(req('data'),env,()=>store)).json();assert.equal(data.entries.length,6);});
test('replayed entry is idempotent; conflicting entry ID is rejected',async()=>{const store=memoryStore(),input=entry();await handle(req('entries','Jayant',input),env,()=>store);await handle(req('entries','Jayant',input),env,()=>store);let data=await (await handle(req('data'),env,()=>store)).json();assert.equal(data.entries.length,1);assert.equal((await handle(req('entries','Jayant',{...input,quantity:3}),env,()=>store)).status,400);});
test('undo is restricted to owner, preserves history, and can be restored',async()=>{const store=memoryStore(),input=entry();await handle(req('entries','Jayant',input),env,()=>store);assert.equal((await handle(req('undo','Babita',{id:input.id}),env,()=>store)).status,400);await handle(req('undo','Jayant',{id:input.id}),env,()=>store);let data=await (await handle(req('data'),env,()=>store)).json();assert.equal(data.entries[0].deleted,true);await handle(req('undo','Jayant',{id:input.id,restore:true}),env,()=>store);data=await (await handle(req('data'),env,()=>store)).json();assert.equal(data.entries[0].deleted,false);});
test('a zero limit goal requires an explicit zero entry',()=>{const h={id:'smoking',mode:'limit',target:0};assert.equal(achieved(h,[],today()),false);assert.equal(achieved(h,[{habitId:h.id,date:today(),quantity:0}],today()),true);assert.equal(achieved(h,[{habitId:h.id,date:today(),quantity:1}],today()),false);});
test('invalid dates, quantities and origin are rejected',async()=>{const store=memoryStore();for(const patch of [{date:'2026-02-30'},{date:'2099-01-01'},{quantity:-2},{quantity:1000001},{note:'x'.repeat(301)}])assert.equal((await handle(req('entries','Jayant',{...entry(),...patch}),env,()=>store)).status,400);assert.equal((await handle(req('entries','Jayant',entry(),'https://evil.test'),env,()=>store)).status,403);assert.equal(validDate('not-a-date'),false);assert.throws(()=>validateHabit({name:'bad',unit:'times',mode:'build',target:0,step:1}));});
test('archiving preserves past entries and prevents new logs until restored',async()=>{const store=memoryStore();await handle(req('entries','Jayant',entry()),env,()=>store);await handle(req('archive','Jayant',{id:'jayant-0',archived:true}),env,()=>store);assert.equal((await handle(req('entries','Jayant',entry()),env,()=>store)).status,400);const data=await (await handle(req('export'),env,()=>store)).json();assert.equal(data.entries.length,1);assert.equal(data.habits.find(h=>h.id==='jayant-0').archived,true);});

test('all three names work case-insensitively; another person’s name fails',async()=>{
  for(const person of ['Jayant','Babita','Naveen']) {
    const request=password=>new Request('https://together.test/api/auth',{method:'POST',headers:{origin:'https://together.test'},body:JSON.stringify({person,password})});
    assert.equal((await authenticate(request(person.toUpperCase()),env)).status,200);
    assert.equal((await authenticate(request('someone else'),env)).status,401);
  }
});
test('concurrent runtime initialization converges on one persistent random signing key',async()=>{
  const records=new Map();const store={async get(k){return records.get(k)||null;},async set(k,v,{onlyIfNew}){if(onlyIfNew&&records.has(k))return {modified:false};records.set(k,v);return {modified:true};}};
  const results=await Promise.all(Array.from({length:8},()=>runtimeEnvironment(store,{})));
  assert.equal(new Set(results.map(x=>x.SESSION_SECRET)).size,1);
  assert.match(results[0].SESSION_SECRET,/^[a-f0-9]{64}$/);
  assert.deepEqual(await runtimeEnvironment(store,{}),results[0]);
});

test('sign-in persists for a year, renews on reads, and explicit sign-out clears the cookie',async()=>{
  const store=memoryStore();
  const request=new Request('https://together.test/api/auth',{method:'POST',headers:{origin:'https://together.test'},body:JSON.stringify({person:'Jayant',password:'jayant'})});
  const login=await authenticate(request,env),cookie=login.headers.get('set-cookie');
  assert.match(cookie,/Max-Age=31536000/);
  const payload=JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0],'base64url').toString());
  assert.ok(payload.exp>Date.now()+364*86400000);
  const refreshed=await handle(req('data'),env,()=>store);
  assert.equal(refreshed.status,200);
  assert.match(refreshed.headers.get('set-cookie'),/Max-Age=31536000/);
  const logout=await authenticate(new Request('https://together.test/api/auth',{method:'DELETE',headers:{origin:'https://together.test',cookie:cookie.split(';')[0]}}),env);
  assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
});

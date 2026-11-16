import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequestRuntime} from '../lib/request-runtime.mjs';
import {StorageUnavailableError,protectStore} from '../lib/storage.mjs';
import {authenticate,handle} from '../lib/server.mjs';
import {today} from '../lib/model.mjs';
import {randomUUID} from 'node:crypto';

function provider(){
  let generation=0,created=0;
  const records=new Map();
  const getStore=options=>{
    assert.deepEqual(options,{name:'together-family',consistency:'strong'});
    const tokenGeneration=generation;created++;
    const check=()=>{if(tokenGeneration!==generation){const e=new Error('Netlify Blobs has generated an internal error (Failed to decode token: Token expired)');e.name='BlobsInternalError';throw e;}};
    return {
      async get(key){check();return records.get(key)?.data??null;},
      async set(key,data,options={}){check();if(options.onlyIfNew&&records.has(key))return {modified:false};records.set(key,{data,etag:randomUUID()});return {modified:true};},
      async getWithMetadata(key){check();return records.has(key)?structuredClone(records.get(key)):null;},
      async setJSON(key,data,options={}){check();const old=records.get(key);if((options.onlyIfNew&&old)||(options.onlyIfMatch&&old?.etag!==options.onlyIfMatch))return {modified:false};const etag=randomUUID();records.set(key,{data:structuredClone(data),etag});return {modified:true,etag};}
    };
  };
  return {getStore,expire(){generation++;},get created(){return created;}};
}
const origin='https://together.test';
const request=(path,cookie,body)=>new Request(`${origin}/api/${path}`,{method:body?'POST':'GET',headers:{origin,cookie:cookie||'','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
test('new requests replace expired Blobs credentials while keeping records and signing key',async()=>{
  const db=provider(),runtime=createRequestRuntime(db.getStore,()=>({}));
  const first=await runtime();
  const login=await authenticate(request('auth','',{person:'Jayant',password:'jayant'}),first.env);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const entry={id:randomUUID(),habitId:'jayant-0',date:today(),quantity:2,note:'request-scope test'};
  assert.equal((await handle(request('entries',cookie,entry),first.env,()=>first.store)).status,201);
  db.expire();
  // Reproduce the original failure with an old Store in the same warm process.
  await assert.rejects(first.store.get('state'),StorageUnavailableError);
  const second=await runtime();
  assert.notEqual(first.store,second.store);
  assert.equal(first.env.SESSION_SECRET,second.env.SESSION_SECRET);
  const read=await handle(request('data',cookie),second.env,()=>second.store);
  assert.equal(read.status,200);
  assert.equal((await read.json()).entries[0].id,entry.id);
  assert.equal(db.created,2);
});
test('all three profiles use the same persistent records after credential rotation',async()=>{
  const db=provider(),runtime=createRequestRuntime(db.getStore,()=>({}));
  let current=await runtime();
  const login=await authenticate(request('auth','',{person:'Jayant',password:'jayant'}),current.env);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const entry={id:randomUUID(),habitId:'jayant-0',date:today(),quantity:1,note:''};
  await handle(request('entries',cookie,entry),current.env,()=>current.store);
  for(const person of ['Jayant','Babita','Naveen']){
    db.expire();current=await runtime();
    const signed=await authenticate(request('auth','',{person,password:person.toLowerCase()}),current.env);
    const personCookie=signed.headers.get('set-cookie').split(';')[0];
    const read=await handle(request('data',personCookie),current.env,()=>current.store);
    assert.equal(read.status,200);
    const body=await read.json();assert.equal(body.person,person);assert.equal(body.entries[0].id,entry.id);
  }
});
test('storage SDK failures become retryable 503s without exposing internal token errors',async()=>{
  const db=provider(),runtime=createRequestRuntime(db.getStore,()=>({}));
  const current=await runtime();
  const login=await authenticate(request('auth','',{person:'Jayant',password:'jayant'}),current.env);
  db.expire();
  const read=await handle(request('data',login.headers.get('set-cookie').split(';')[0]),current.env,()=>current.store);
  assert.equal(read.status,503);
  const text=await read.text();assert.match(text,/temporarily unavailable/);assert.doesNotMatch(text,/token|Netlify|decode/i);
});
test('a failed runtime initialization does not poison the next request',async()=>{
  let fail=true;
  const db=provider();
  const runtime=createRequestRuntime(options=>{if(fail)throw new Error('temporary provider failure');return db.getStore(options);},()=>({}));
  await assert.rejects(runtime());fail=false;
  assert.ok((await runtime()).env.SESSION_SECRET);
});

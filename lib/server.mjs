import { createHash, createHmac, timingSafeEqual, randomUUID, randomBytes } from 'node:crypto';
import { PEOPLE, initialState, today, validDate, validMonth, validateHabit } from './model.mjs';

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const digest=v=>createHash('sha256').update(v).digest();
const equal=(a,b)=>timingSafeEqual(digest(a),digest(b));
// The owner explicitly chose case-insensitive names as passwords.
// Keep session signatures independently random even with guessable passwords.
export function ready(env) { return typeof env.SESSION_SECRET==='string' && env.SESSION_SECRET.length>=32; }
function secret(env) { if(!ready(env)) throw new Error('Session signing is unavailable.'); return env.SESSION_SECRET; }
export async function runtimeEnvironment(store,env={}) {
  if(ready(env)) return {SESSION_SECRET:env.SESSION_SECRET};
  let key=await store.get('session-signing-key',{type:'text',consistency:'strong'});
  if(!key) {
    const candidate=randomBytes(32).toString('hex');
    const saved=await store.set('session-signing-key',candidate,{onlyIfNew:true});
    key=saved.modified?candidate:await store.get('session-signing-key',{type:'text',consistency:'strong'});
  }
  if(typeof key!=='string'||key.length<32) throw new Error('Session signing is unavailable.');
  return {SESSION_SECRET:key};
}
function signature(value,env) { return createHmac('sha256',secret(env)).update(value).digest('base64url'); }
export function signSession(person,env) {
  const payload=Buffer.from(JSON.stringify({person,exp:Date.now()+7*86400000})).toString('base64url');
  return `${payload}.${signature(payload,env)}`;
}
export function session(request,env) {
  try {
    const raw=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('together_session='))?.slice(17);
    if(!raw) return null;
    const [p,s,...rest]=raw.split('.');
    if(rest.length || !s || !equal(s,signature(p,env))) return null;
    const v=JSON.parse(Buffer.from(p,'base64url').toString());
    return PEOPLE.includes(v.person) && v.exp>Date.now() ? v.person : null;
  } catch { return null; }
}
function sameOrigin(req) { const origin=req.headers.get('origin'); return origin===new URL(req.url).origin; }
async function body(req) {
  const text=await req.text();
  if(text.length>12000) throw new Error('Request is too large.');
  try { return JSON.parse(text); } catch { throw new Error('Invalid request.'); }
}
export async function authenticate(req,env) {
  if(!['POST','DELETE'].includes(req.method)) return json({error:'Method not allowed.'},405);
  if(!sameOrigin(req)) return json({error:'Request origin not allowed.'},403);
  if(req.method==='DELETE') return json({ok:true},200,{'Set-Cookie':'together_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
  if(!ready(env)) return json({error:'Sign-in is temporarily unavailable. Please try again.'},503);
  try {
    const {person,password}=await body(req);
    if(!PEOPLE.includes(person) || typeof password!=='string' || !equal(password.trim().toLowerCase(),person.toLowerCase())) return json({error:'That name and passphrase do not match.'},401);
    return json({person},200,{'Set-Cookie':`together_session=${signSession(person,env)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`});
  } catch(e) { return json({error:e.message},400); }
}
async function load(store) { const found=await store.getWithMetadata('state',{type:'json',consistency:'strong'}); return found || {data:initialState(),etag:null}; }
export async function mutate(store,change) {
  for(let attempt=0;attempt<8;attempt++) {
    const {data,etag}=await load(store);
    const result=change(data);
    const saved=await store.setJSON('state',data,etag?{onlyIfMatch:etag}:{onlyIfNew:true});
    if(saved.modified) return result;
  }
  const err=new Error('Someone else is saving. Please try again.'); err.status=409; throw err;
}
export async function handle(req,env,getStore) {
  const url=new URL(req.url), path=url.pathname;
  if(path==='/api/status' && req.method==='GET') return json({configured:ready(env)});
  if(!ready(env)) return json({error:'Sign-in is temporarily unavailable. Please try again.'},503);
  const person=session(req,env);
  if(!person) return json({error:'Sign in to see your shared space.'},401);
  if(!['GET','POST'].includes(req.method)) return json({error:'Method not allowed.'},405);
  if(req.method==='POST' && !sameOrigin(req)) return json({error:'Request origin not allowed.'},403);
  try {
    const store=getStore();
    if(req.method==='GET' && path==='/api/data') {
      const month=url.searchParams.get('month')||today().slice(0,7);
      if(!validMonth(month)) return json({error:'Choose a valid month.'},400);
      const {data}=await load(store);
      return json({person,people:PEOPLE,habits:data.habits,entries:data.entries.filter(e=>e.date.startsWith(month)),month});
    }
    if(req.method==='GET' && path==='/api/export') return json((await load(store)).data);
    if(req.method==='POST') {
      const input=await body(req);
      if(path==='/api/habits') {
        const fields=validateHabit(input),id=randomUUID();
        await mutate(store,data=>{
          if(data.habits.filter(h=>h.owner===person && !h.archived).length>=60) throw new Error('Archive a habit before adding another.');
          data.habits.push({...fields,id,owner:person,createdOn:today(),archived:false});
        });
        return json({ok:true,id},201);
      }
      if(path==='/api/archive') {
        await mutate(store,data=>{
          const habit=data.habits.find(h=>h.id===input.id && h.owner===person);
          if(!habit) throw new Error('You can only change your own habits.');
          habit.archived=Boolean(input.archived);
        }); return json({ok:true});
      }
      if(path==='/api/entries') {
        if(!validDate(input.date)) throw new Error('Choose today or a valid past date.');
        if(!Number.isFinite(input.quantity) || input.quantity<0 || input.quantity>1000000) throw new Error('Quantity must be between 0 and 1,000,000.');
        if(typeof input.note!=='string' || input.note.length>300) throw new Error('Notes can have up to 300 characters.');
        if(typeof input.id!=='string' || !/^[a-f0-9-]{36}$/.test(input.id)) throw new Error('Invalid entry identifier.');
        await mutate(store,data=>{
          const habit=data.habits.find(h=>h.id===input.habitId && h.owner===person && !h.archived);
          if(!habit) throw new Error('You can only log your own active habits.');
          const existing=data.entries.find(e=>e.id===input.id);
          if(existing) {
            if(existing.owner!==person || existing.habitId!==habit.id || existing.date!==input.date || existing.quantity!==input.quantity || existing.note!==input.note.trim()) throw new Error('Entry identifier already used.');
            return;
          }
          if(data.entries.length>=50000) throw new Error('Storage limit reached. Export your history and contact the owner.');
          data.entries.push({id:input.id,habitId:habit.id,owner:person,date:input.date,quantity:Math.round(input.quantity*100)/100,note:input.note.trim(),createdAt:new Date().toISOString(),deleted:false});
        }); return json({ok:true,id:input.id},201);
      }
      if(path==='/api/undo') {
        await mutate(store,data=>{
          const entry=data.entries.find(e=>e.id===input.id && e.owner===person);
          if(!entry) throw new Error('You can only undo your own entries.');
          entry.deleted=!Boolean(input.restore);
        }); return json({ok:true});
      }
    }
    return json({error:'Not found.'},404);
  } catch(e) { if(e.status) return json({error:e.message},e.status); if(e instanceof TypeError) {console.error('Storage failure',e.name);return json({error:'The shared store is unavailable. Your change was not confirmed; please retry.'},503);} return json({error:e.message||'Unable to save.'},400); }
}

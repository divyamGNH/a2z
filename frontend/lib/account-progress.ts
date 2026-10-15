'use client';
import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import sheet from '../data/sheet.json';
export type Progress = { solved: string[]; starred: string[]; notes: Record<string,string> };
export type User = { id: string; name: string; email: string };
type Change = { id: string; field: 'solved'|'starred'|'note'; value: boolean|string; stamp: string };
export const empty: Progress = { solved: [], starred: [], notes: {} };
export const guestKey = 'a2z-original-progress-v1';
const ids = sheet.flatMap(s=>s.lectures.flatMap(l=>l.questions.map(q=>q.id)));
const idSet = new Set(ids);
export const apiURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export async function api(path: string, options: RequestInit = {}) {
 const response = await fetch(`${apiURL}/api${path}`, { ...options, credentials: 'include', cache: 'no-store', headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers } });
 const body = await response.json().catch(()=>({}));
 if (!response.ok) throw new Error(body.message || (response.status===401 ? 'Your session expired. Sign in again to save pending changes.' : 'Could not reach your account. Please retry.'));
 return body;
}
export function validateProgress(p: Progress): Progress {
 if (!p || !Array.isArray(p.solved) || !Array.isArray(p.starred) || !p.notes || typeof p.notes!=='object' || Array.isArray(p.notes)) throw Error('Invalid progress file');
 return { solved:[...new Set(p.solved.filter(id=>idSet.has(id)))], starred:[...new Set(p.starred.filter(id=>idSet.has(id)))], notes:Object.fromEntries(Object.entries(p.notes).filter(([id,v])=>idSet.has(id)&&typeof v==='string')) };
}
function overlay(base: Progress, changes: Change[]): Progress {
 const p = { solved:new Set(base.solved), starred:new Set(base.starred), notes:{...base.notes} };
 for (const c of changes) { if(c.field==='note') { if(c.value) p.notes[c.id]=String(c.value); else delete p.notes[c.id]; } else if(c.value) p[c.field].add(c.id); else p[c.field].delete(c.id); }
 return {solved:[...p.solved],starred:[...p.starred],notes:p.notes};
}
function changesBetween(before: Progress, after: Progress): Change[] {
 const result: Change[]=[];
 for (const id of ids) for (const field of ['solved','starred','note'] as const) {
  const a=field==='note' ? before.notes[id]||'' : before[field].includes(id);
  const b=field==='note' ? after.notes[id]||'' : after[field].includes(id);
  if(a!==b) result.push({id,field,value:b,stamp:crypto.randomUUID()});
 }
 return result;
}
export function useAccountProgress() {
 const [progress,render]=useState<Progress>(empty),[user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false),[status,setStatus]=useState('Checking account…'),[error,setError]=useState(''),[guestAvailable,setGuestAvailable]=useState(false);
 const state=useRef(empty),account=useRef<User|null>(null),queue=useRef<Change[]>([]),busy=useRef(false),generation=useRef(0),mounted=useRef(true),loadedRef=useRef(false);
 const outboxKey=(id:string)=>`a2z-account-outbox-${id}`;
 function publish(p:Progress){state.current=p;if(mounted.current)render(p)}
 function persistQueue(){try{localStorage.setItem(outboxKey(account.current!.id),JSON.stringify(queue.current));return true}catch{setError('This browser cannot keep pending changes. Keep this tab open until the server confirms they are saved.');return false}}
 const sync=useCallback(async()=>{
  if(busy.current||!account.current||!loadedRef.current)return;
  busy.current=true;const epoch=generation.current;
  try{
   while(queue.current.length&&epoch===generation.current){
    const batch=queue.current.slice(0,1365);setStatus('Saving…');
    const data=await api('/progress',{method:'PATCH',headers:{'X-A2Z-Account-Id':account.current!.id},body:JSON.stringify({changes:batch.map(({id,field,value})=>({id,field,value}))})});
    if(epoch!==generation.current)return;
    const sent=new Set(batch.map(c=>c.stamp));queue.current=queue.current.filter(c=>!sent.has(c.stamp));persistQueue();publish(overlay(validateProgress(data.progress),queue.current));
   }
   if(epoch===generation.current){setError('');setStatus('Saved to account');}
  }catch(e){if(epoch===generation.current){setError(e instanceof Error?e.message:'Save failed.');setStatus('Not synced — retry');}}
  finally{busy.current=false;}
 },[]);
 const refreshSession=useCallback(async()=>{
  const epoch=++generation.current;setLoading(true);loadedRef.current=false;setLoaded(false);setError('');
  try{
   const session=await api('/auth/get-session');if(epoch!==generation.current)return;
   account.current=session?.user||null;setUser(account.current);queue.current=[];
   if(account.current){
    let pending=[];try{pending=JSON.parse(localStorage.getItem(outboxKey(account.current.id))||'[]')}catch{}
    queue.current=Array.isArray(pending)?pending.filter(c=>c&&idSet.has(c.id)&&['solved','starred','note'].includes(c.field)&&typeof c.stamp==='string'&&(c.field==='note'?typeof c.value==='string':typeof c.value==='boolean')):[];
    const data=await api('/progress',{headers:{'X-A2Z-Account-Id':account.current!.id}});if(epoch!==generation.current)return;
    publish(overlay(validateProgress(data.progress),queue.current));loadedRef.current=true;setLoaded(true);setStatus(queue.current.length?'Pending changes':'Saved to account');
    try{const guest=validateProgress(JSON.parse(localStorage.getItem(guestKey)||JSON.stringify(empty)));setGuestAvailable(!!(guest.solved.length||guest.starred.length||Object.values(guest.notes).some(Boolean)))}catch{setGuestAvailable(false)}
   }else{let guest=empty;try{guest=validateProgress(JSON.parse(localStorage.getItem(guestKey)||JSON.stringify(empty)))}catch{}publish(guest);setStatus('Saved on this device');setGuestAvailable(false);}
  }catch(e){setError(e instanceof Error?e.message:'Account unavailable.');setStatus('Account unavailable');}
  finally{if(epoch===generation.current){setLoading(false);void sync();}}
 },[sync]);
 useEffect(()=>{mounted.current=true;try{publish(validateProgress(JSON.parse(localStorage.getItem(guestKey)||JSON.stringify(empty))))}catch{}void refreshSession();return()=>{mounted.current=false;generation.current++}},[refreshSession]);
 useEffect(()=>{
  async function pull(){if(!account.current||!loadedRef.current||busy.current)return;if(queue.current.length){void sync();return;}const epoch=generation.current;busy.current=true;try{const data=await api('/progress',{headers:{'X-A2Z-Account-Id':account.current!.id}});if(epoch===generation.current){publish(overlay(validateProgress(data.progress),queue.current));setError('');setStatus(queue.current.length?'Pending changes':'Saved to account')}}catch(e){if(epoch===generation.current){setStatus('Connection interrupted');setError(e instanceof Error?e.message:'Connection interrupted.')}}finally{busy.current=false;if(queue.current.length)void sync();}}
  const timer=setInterval(pull,15000);window.addEventListener('focus',pull);window.addEventListener('online',pull);
  function beforeUnload(e:BeforeUnloadEvent){if(queue.current.length){e.preventDefault();e.returnValue='';}}
  window.addEventListener('beforeunload',beforeUnload);
  return()=>{clearInterval(timer);window.removeEventListener('focus',pull);window.removeEventListener('online',pull);window.removeEventListener('beforeunload',beforeUnload)};
 },[sync]);
 function setProgress(action:SetStateAction<Progress>){
  if(loading||(account.current&&!loadedRef.current))return;
  const next=validateProgress(typeof action==='function'?action(state.current):action);
  if(account.current){const updates=changesBetween(state.current,next);for(const c of updates){queue.current=queue.current.filter(old=>!(old.id===c.id&&old.field===c.field));queue.current.push(c)}publish(next);persistQueue();setStatus('Saving…');void sync();}
  else {publish(next);try{localStorage.setItem(guestKey,JSON.stringify(next));setStatus('Saved on this device')}catch{setError('Browser storage is unavailable. Export your progress to keep it.');setStatus('Not saved');}}
 }
 function migrateGuest(){try{const guest=validateProgress(JSON.parse(localStorage.getItem(guestKey)||JSON.stringify(empty)));setProgress(p=>({solved:[...new Set([...p.solved,...guest.solved])],starred:[...new Set([...p.starred,...guest.starred])],notes:{...guest.notes,...p.notes}}));setGuestAvailable(false)}catch{setError('Could not import the progress saved on this device.')}}
 async function logout(){await api('/auth/sign-out',{method:'POST',body:'{}'});try{sessionStorage.removeItem('a2z-explicit-guest-access');window.dispatchEvent(new Event('a2z-access-changed'))}catch{}await refreshSession()}
 return {progress,setProgress,user,loading,editable:!loading&&(!user||loaded),status,error,guestAvailable,migrateGuest,dismissGuest:()=>setGuestAvailable(false),refreshSession,retry:()=>loadedRef.current?sync():refreshSession(),logout};
}

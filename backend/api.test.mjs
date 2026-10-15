import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)), quiet: true });
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from './app.mjs';

test('Supabase-backed auth, account isolation, session recovery and durable progress', {timeout:180000}, async t => {
 const schema=`a2z_test_${Date.now()}_${randomBytes(4).toString('hex')}`;
 const secret=randomBytes(48).toString('base64url');
 let service,listener,base;
 const options={schema,secret,production:false,github:{clientId:'test-github-client-id',clientSecret:'test-github-client-secret'}};
 async function start(){service=await createServer(options);listener=service.app.listen(0,'127.0.0.1');await once(listener,'listening');base=`http://127.0.0.1:${listener.address().port}`;}
 async function stop(){await new Promise(resolve=>listener.close(resolve));await service.close();}
 async function request(path,{method='GET',cookie='',body,origin='http://localhost:3000',expectedAccount}={}){
  const r=await fetch(base+'/api'+path,{method,headers:{Origin:origin,...(expectedAccount?{'X-A2Z-Account-Id':expectedAccount}:{}),...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const json=await r.json();const cookies=r.headers.getSetCookie().map(s=>s.split(';')[0]).filter(s=>!s.endsWith('=')).join('; ');
  return {status:r.status,json,cookie:cookies};
 }
 try{
  await start();
  await t.test('Rejects unauthenticated reads and writes',async()=>{assert.equal((await request('/progress')).status,401);assert.equal((await request('/progress',{method:'PATCH',body:{changes:[{id:'dttyps',field:'solved',value:true}]}})).status,401)});
  await t.test('GitHub OAuth initiation uses the Node callback and minimal scopes without exposing the secret',async()=>{
   const config=await request('/config');assert.equal(config.json.githubEnabled,true);assert.ok(!JSON.stringify(config.json).includes(options.github.clientSecret));
   const result=await request('/auth/sign-in/social',{method:'POST',body:{provider:'github',callbackURL:'http://localhost:3000/?oauth=github',errorCallbackURL:'http://localhost:3000/?oauth=github',disableRedirect:true}});
   assert.equal(result.status,200,JSON.stringify(result.json));const url=new URL(result.json.url);assert.equal(url.origin,'https://github.com');assert.equal(url.pathname,'/login/oauth/authorize');assert.equal(url.searchParams.get('client_id'),options.github.clientId);assert.equal(url.searchParams.get('redirect_uri'),'http://localhost:4000/api/auth/callback/github');assert.deepEqual(url.searchParams.get('scope').split(/[ ,]+/).sort(),['read:user','user:email']);assert.ok(url.searchParams.get('state'));assert.ok(result.cookie);assert.ok(!JSON.stringify(result.json).includes(options.github.clientSecret));
  });
  await t.test('GitHub sign-in rejects an untrusted return URL',async()=>{const result=await request('/auth/sign-in/social',{method:'POST',body:{provider:'github',callbackURL:'https://untrusted.example/return',disableRedirect:true}});assert.equal(result.status,403)});
  const emailA=`qa-a-${randomBytes(6).toString('hex')}@example.test`,emailB=`qa-b-${randomBytes(6).toString('hex')}@example.test`,password=randomBytes(24).toString('base64url');
  const signupA=await request('/auth/sign-up/email',{method:'POST',body:{name:'Test learner A',email:emailA,password}});
  assert.equal(signupA.status,200,JSON.stringify(signupA.json));assert.ok(signupA.cookie);
  const signupB=await request('/auth/sign-up/email',{method:'POST',body:{name:'Test learner B',email:emailB,password}});assert.equal(signupB.status,200,JSON.stringify(signupB.json));
  const a=signupA.cookie,b=signupB.cookie;
  await t.test('Passwords are hashed and auth cookies are HTTP-only',async()=>{const {rows}=await service.db.query('SELECT password FROM account WHERE "userId"=$1',[signupA.json.user.id]);assert.ok(rows.length);assert.notEqual(rows[0].password,password);assert.ok(rows[0].password.length>40);const r=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({email:emailA,password})});assert.ok(r.headers.getSetCookie().some(c=>c.toLowerCase().includes('httponly')))});
  await t.test('Saves only to the authenticated account',async()=>{const result=await request('/progress',{method:'PATCH',cookie:a,body:{userId:signupB.json.user.id,changes:[{id:'dttyps',field:'solved',value:true},{id:'dttyps',field:'starred',value:true},{id:'dttyps',field:'note',value:'Durable test note'}]}});assert.equal(result.status,200);assert.deepEqual(result.json.progress.solved,['dttyps']);assert.equal(result.json.progress.notes.dttyps,'Durable test note');assert.deepEqual((await request('/progress',{cookie:b})).json.progress,{solved:[],starred:[],notes:{}})});
  await t.test('Independent field writes do not overwrite other-device edits',async()=>{await Promise.all([request('/progress',{method:'PATCH',cookie:a,body:{changes:[{id:'dttyps',field:'solved',value:false}]}}),request('/progress',{method:'PATCH',cookie:a,body:{changes:[{id:'dttyps',field:'note',value:'Updated from another device'}]}})]);const p=(await request('/progress',{cookie:a})).json.progress;assert.deepEqual(p.solved,[]);assert.deepEqual(p.starred,['dttyps']);assert.equal(p.notes.dttyps,'Updated from another device')});
  await t.test('Rejects hostile origins, invalid IDs and malformed values',async()=>{assert.equal((await request('/progress',{method:'PATCH',cookie:a,origin:'https://untrusted.example',body:{changes:[{id:'dttyps',field:'solved',value:true}]}})).status,403);for(const change of [{id:'not-in-sheet',field:'solved',value:true},{id:'dttyps',field:'user_id',value:'other'},{id:'dttyps',field:'solved',value:'true'},{id:'dttyps',field:'note',value:'x'.repeat(20001)}])assert.equal((await request('/progress',{method:'PATCH',cookie:a,body:{changes:[change]}})).status,400)});
  await t.test('A cookie changed by another tab cannot send old-account edits to the new account',async()=>{const result=await request('/progress',{method:'PATCH',cookie:b,expectedAccount:signupA.json.user.id,body:{changes:[{id:'dttyps',field:'solved',value:true}]}});assert.equal(result.status,409);assert.deepEqual((await request('/progress',{cookie:b})).json.progress.solved,[])});
  await t.test('Production backend initializes with GitHub-only login and secure cookies without SMTP',async()=>{const prod=await createServer({...options,production:true,frontend:'https://sheet.example.com',baseURL:'https://api.example.com'});try{assert.equal(prod.auth.options.emailAndPassword.enabled,false);assert.equal(prod.auth.options.advanced.useSecureCookies,true)}finally{await prod.close()}});
  await stop();await start();
  await t.test('Progress and sessions survive a Node backend restart',async()=>{const result=await request('/progress',{cookie:a});assert.equal(result.status,200);assert.equal(result.json.progress.notes.dttyps,'Updated from another device')});
  await t.test('Signing back in with no previous cookies restores saved progress',async()=>{const login=await request('/auth/sign-in/email',{method:'POST',body:{email:emailA,password}});assert.equal(login.status,200);const p=(await request('/progress',{cookie:login.cookie})).json.progress;assert.equal(p.notes.dttyps,'Updated from another device');assert.deepEqual(p.starred,['dttyps']);await request('/auth/sign-out',{method:'POST',cookie:login.cookie,body:{}});assert.equal((await request('/progress',{cookie:login.cookie})).status,401)});
 }finally{
  // Only delete the unique, disposable test schema created by this test.
  if(service&&/^a2z_test_[0-9]+_[a-f0-9]+$/.test(schema))await service.db.query(`DROP SCHEMA "${schema}" CASCADE`);
  if(listener?.listening)await stop();
 }
});

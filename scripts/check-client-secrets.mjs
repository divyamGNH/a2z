import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';
const readEnv=file=>fs.existsSync(file)?dotenv.parse(fs.readFileSync(file)):{};
const publicEnv=readEnv('frontend/.env'),serverEnv=readEnv('backend/.env'),env={...publicEnv,...serverEnv};
const values=['DATABASE_URL','BETTER_AUTH_SECRET','SMTP_PASSWORD','GITHUB_CLIENT_SECRET'].flatMap(key=>env[key]?[{key,value:env[key]}]:[]);
if(env.DATABASE_URL){const u=new URL(env.DATABASE_URL);if(u.password)values.push({key:'DATABASE_PASSWORD',value:decodeURIComponent(u.password)});}
const needles=values.flatMap(({key,value})=>[...new Set([value,encodeURIComponent(value),Buffer.from(value).toString('base64')])].map(v=>({key,bytes:Buffer.from(v)})));
const findings=[];let scanned=0;
function scan(dir,skip=()=>false){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isSymbolicLink()||skip(file,entry))continue;if(entry.isDirectory())scan(file,skip);else{const contents=fs.readFileSync(file);scanned++;for(const secret of needles)if(contents.includes(secret.bytes))findings.push(`${file}: ${secret.key}`)}}}
scan('.',(file,entry)=>{const relative=path.relative('.',file).split(path.sep).join('/');return entry.isDirectory()&&['node_modules','.git','.next','out','frontend/node_modules','backend/node_modules','frontend/.next','frontend/out','backend/storage'].includes(relative)||/^\.env(?:\.|$)/.test(entry.name)&&!entry.name.endsWith('.example')});
for(const dir of ['frontend/out','frontend/.next/static','frontend/.next/dev/static'])scan(dir);
for(const key of Object.keys(publicEnv))if(key!=='NEXT_PUBLIC_API_URL')findings.push(`.env: unexpected frontend environment variable ${key}`);
for(const key of Object.keys(serverEnv))if(key.startsWith('NEXT_PUBLIC_'))findings.push(`backend/.env: unexpected public variable ${key}`);
function checkFrontend(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())checkFrontend(file);else if(/\.[jt]sx?$/.test(file)){const code=fs.readFileSync(file,'utf8');if(/(?:from\s*|import\s*\()\s*['"][^'"]*\b(?:server|backend)\//.test(code))findings.push(`${file}: backend import in frontend`);for(const match of code.matchAll(/process\.env\.([A-Z_0-9]+)/g))if(match[1]!=='NEXT_PUBLIC_API_URL')findings.push(`${file}: unexpected frontend environment reference ${match[1]}`)}}}
for(const dir of ['frontend/app','frontend/components','frontend/lib'])checkFrontend(dir);
const ignore=fs.readFileSync('.gitignore','utf8');
if(!ignore.includes('.env\n')||!ignore.includes('.env.*')||!ignore.includes('backend/storage/'))findings.push('.gitignore: missing credential exclusions');
try{const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0');for(const file of tracked)if(/(^|\/)\.env(?:\.|$)/.test(file)&&!file.endsWith('.example')||file.startsWith('backend/storage/'))findings.push(`${file}: credential file tracked by Git`);console.log('Git tracked-file check completed.')}catch{console.log('No Git repository available; tracked-file/history checks are not available.')}
if(findings.length){console.error('Secret audit failed (values redacted):\n'+findings.join('\n'));process.exit(1)}
console.log(`Secret audit passed: ${scanned} source and client artifact files scanned; frontend env, imports, and ignore rules checked.`);

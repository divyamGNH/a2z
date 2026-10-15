import fs from 'node:fs';
const raw=JSON.parse(fs.readFileSync('research/old-sheet.json','utf8'));
const issues=[];
function url(value,domains,id,field){if(!value)return '';try{const u=new URL(value);if(u.protocol==='https:'&&domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d)))return value;}catch{}issues.push({id,field,value,reason:'Wrong platform or invalid URL; left blank'});return '';}
const steps=raw.map(s=>({id:s.step_no,title:s.step_title,lectures:s.sub_steps.map(l=>({id:`${s.step_no}-${l.sub_step_no}`,title:l.sub_step_title,questions:l.topics.map(q=>({id:q.id,title:q.question_title,difficulty:['Easy','Medium','Hard'][q.difficulty]||'Unrated',leetcode:url(q.lc_link,['leetcode.com'],q.id,'leetcode'),gfg:url(q.gfg_link,['geeksforgeeks.org'],q.id,'gfg'),youtube:url(q.yt_link,['youtube.com','youtu.be'],q.id,'youtube'),article:url(q.post_link,['takeuforward.org'],q.id,'article')}))}))}));
fs.writeFileSync('frontend/data/sheet.json',JSON.stringify(steps,null,2)+'\n');
fs.writeFileSync('research/link-issues.json',JSON.stringify(issues,null,2)+'\n');
const qs=steps.flatMap(s=>s.lectures.flatMap(l=>l.questions));
console.log(JSON.stringify({steps:steps.length,lectures:steps.reduce((n,s)=>n+s.lectures.length,0),questions:qs.length,links:Object.fromEntries(['leetcode','gfg','youtube','article'].map(k=>[k,qs.filter(q=>q[k]).length])),issues},null,2));
const csvRows=[['step','stepTitle','lecture','lectureTitle','id','question','difficulty','leetcode','gfg','youtube','article'],...steps.flatMap(s=>s.lectures.flatMap(l=>l.questions.map(q=>[s.id,s.title,l.id,l.title,q.id,q.title,q.difficulty,q.leetcode,q.gfg,q.youtube,q.article])))];
fs.writeFileSync('frontend/data/questions.csv',csvRows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n');

fs.writeFileSync('backend/data/question-ids.json',JSON.stringify(qs.map(q=>q.id),null,2)+'\n');

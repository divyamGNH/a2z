import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const raw=JSON.parse(fs.readFileSync('research/old-sheet.json','utf8'));
const data=JSON.parse(fs.readFileSync('frontend/data/sheet.json','utf8'));
const qs=data.flatMap(s=>s.lectures.flatMap(l=>l.questions));
test('All historical questions and lecture order are preserved',()=>{assert.equal(data.length,18);assert.equal(qs.length,455);assert.deepEqual(qs.map(q=>q.title),raw.flatMap(s=>s.sub_steps.flatMap(l=>l.topics.map(q=>q.question_title))));assert.equal(new Set(qs.map(q=>q.id)).size,455)});
test('Every nonempty resource belongs to the labeled platform',()=>{for(const q of qs)for(const [key,domains] of Object.entries({leetcode:['leetcode.com'],gfg:['geeksforgeeks.org'],youtube:['youtube.com','youtu.be'],article:['takeuforward.org']})){assert.equal(typeof q[key],'string');if(q[key]){const u=new URL(q[key]);assert.equal(u.protocol,'https:');assert.ok(domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d)),`${q.title}: ${key}`)}}});
test('Missing links are empty strings and timestamps are retained',()=>{assert.equal(qs[0].leetcode,'');assert.equal(qs[0].youtube,'https://www.youtube.com/watch?v=EAR7De6Goz4&t=250');assert.ok(qs.some(q=>q.leetcode&&q.gfg&&q.youtube));assert.ok(qs.some(q=>!q.youtube))});

test('Standalone backend question allowlist matches the frontend sheet',()=>assert.deepEqual(JSON.parse(fs.readFileSync('backend/data/question-ids.json','utf8')),qs.map(q=>q.id)));

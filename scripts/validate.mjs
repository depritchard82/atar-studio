import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {predict,compare,batchPredict,scale,logistic,atarFromAggregate,rawScore} from '../dist/engine.mjs';
const {models}=JSON.parse(fs.readFileSync('dist/models.json','utf8'));
const reference=JSON.parse(fs.readFileSync('scripts/python-reference.json','utf8'));
assert.equal(Object.keys(models['2025'].subjects).length,49);
assert.equal(models['2025'].subjects['Chinese Extension'],undefined);
assert.equal(models['2025'].subjects['Music Extension (Musicology)'],undefined);
assert.equal(models['2025'].subjects['Arabic'],undefined);
assert.deepEqual(models['2025'].subjects['Accounting'].raw,[62,74,86,93,99]);
assert.deepEqual(models['2025'].subjects['Accounting'].scaled,[62.95,77.94,88.02,91.84,94.20]);
assert.deepEqual(models['2025'].subjects['Mathematical Methods'].scaled,[79.43,89.64,94.43,96.44,97.43]);
assert.deepEqual(models['2025'].subjects['Chinese (Senior External Examination)'].raw,[71,83,89,93,98]);
assert.notDeepEqual(models['2025'].subjects['Chinese'].raw,models['2025'].subjects['Chinese (Senior External Examination)'].raw);
for(const [subject,curve]of Object.entries(models['2025'].subjects)){assert.ok(curve.parameters.every(Number.isFinite));assert.equal(curve.raw.length,5);assert.equal(curve.scaled.length,5);assert.ok(models['2025'].source.subjects[subject]);}
for(const [year,model]of Object.entries(models)){
 const subjects=Object.keys(model.subjects).sort(),entries=subjects.slice(0,8).map(subject=>({subject,raw:80}));
 const r=predict(model,entries);assert.equal(r.rows.filter(r=>r.counted).length,5);assert.ok(Math.abs(r.aggregate-reference[year])<1e-9,'Python parity');
 const expected=entries.map(e=>scale(model,e.subject,e.raw)).sort((a,b)=>b-a).slice(0,5).reduce((a,b)=>a+b,0);assert.equal(r.aggregate,expected);
 for(const subject of subjects){const c=compare(model,subject,80);assert.ok(Math.abs(c.rows.find(r=>r.subject===subject).raw-80)<1e-8);}
 const data=entries.map(e=>({Name:'Synthetic student',Subject:e.subject,IA1:20,IA2:20,IA3:20,MEA:20}));
 const batch=batchPredict(model,data,null,false);assert.equal(batch.results[0].ATAR,r.atar);assert.equal(batch.results[0].Aggregate,r.aggregate);
 const fallback=data.map(({IA1,...row})=>({...row,FIA1:IA1}));assert.equal(batchPredict(model,fallback,null,false).results[0].ATAR,r.atar);
 assert.throws(()=>predict(model,entries.slice(0,4)),/five/);assert.throws(()=>predict(model,[...entries,entries[0]]),/Duplicate/);
 assert.throws(()=>batchPredict(model,data,null,true),/MEAConversions/);assert.throws(()=>batchPredict(model,[],null,false),/empty/);
 assert.throws(()=>batchPredict(model,[{...data[0],Name:''},...data.slice(1)],null,false),/Name/);
 const adj=batchPredict(model,data,[{Subject:subjects[0],m:1.9,c:1}],true);assert.equal(adj.breakdown[0]['Used external'],39);assert.equal(adj.warnings.length,1);
 console.log(year,subjects.length,'subjects: inverse, individual/batch parity and input checks passed');
}
for(const bad of ['',null,NaN,Infinity,-1,101])assert.throws(()=>rawScore(bad));assert.equal(rawScore(0),0);
assert.equal(atarFromAggregate(400),84.55);assert.equal(atarFromAggregate(500),99.95);assert.equal(atarFromAggregate(0),0);
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/vendor/xlsx.full.min.js','utf8'),ctx);const X=ctx.XLSX;
for(const bookType of ['xlsx','biff8']){const wb=X.utils.book_new(),data=[{Name:'Synthetic student',Subject:'Accounting',IA1:0,IA2:25,IA3:25,MEA:30}];X.utils.book_append_sheet(wb,X.utils.json_to_sheet(data),'Data');const buffer=X.write(wb,{type:'array',bookType});const read=X.read(buffer,{type:'array'});const rows=X.utils.sheet_to_json(read.Sheets.Data);assert.equal(rows[0].IA1,0);assert.equal(rows[0].Name,'Synthetic student');console.log(bookType,'read/write roundtrip passed');}
const html=fs.readFileSync('dist/index.html','utf8');for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g))assert.ok(fs.existsSync('dist/'+m[1]),m[1]);
assert.ok(!/https?:\/\//.test(html),'No external page resources');
const app=fs.readFileSync('dist/app.js','utf8');assert.equal((app.match(/fetch\(/g)||[]).length,1);assert.ok(app.includes("fetch('./models.json')"));assert.ok(!/localStorage|sendBeacon|XMLHttpRequest/.test(app));
console.log('Local assets and no-upload application contract passed');

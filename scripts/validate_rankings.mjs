import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bands,subjectRankings,sortRankings,rankingsCSV} from '../dist/rankings.mjs';
const {models}=JSON.parse(fs.readFileSync('dist/models.json','utf8'));
for(const model of Object.values(models)) {
  const rows=subjectRankings(model);
  for(const row of rows) for(const [key,start,end] of bands){
    const [L,a,b]=model.subjects[row.subject].parameters;
    const expected=Array.from({length:end-start+1},(_,i)=>L/(1+a*Math.exp(-b*(start+i)))).reduce((s,n)=>s+n,0)/(end-start+1);
    assert.ok(Math.abs(row[key]-expected)<1e-10);
  }
  const sorted=sortRankings(rows,'topscore');
  assert.ok(sorted.every((r,i)=>!i||sorted[i-1].topscore>=r.topscore));
  assert.ok(rankingsCSV(sorted,'test').includes('"subscore","topscore","ascore","bscore","cscore"'));
}
assert.deepEqual(bands.map(([,a,b])=>b-a+1),[100,10,20,20,20]);
const constant=subjectRankings({subjects:{Constant:{parameters:[300,1,0]}}})[0];
assert.equal(constant.subscore,150);assert.equal(constant.outside.length,5);
assert.equal(sortRankings([{subject:'Z',topscore:2},{subject:'A',topscore:1}],'topscore',true)[0].subject,'A');
console.log('Rankings: all years, exact integer bands, ordering, CSV and unclipped-value flags passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {convertMock} from '../dist/mock-engine.mjs';
const {subjects} = JSON.parse(fs.readFileSync('dist/mock-models.json', 'utf8'));
assert.equal(Object.keys(subjects).length, 13);
assert.equal(Object.values(subjects).reduce((n,m)=>n+m.n,0), 602);
assert.equal(Object.values(subjects).filter(m=>m.enabled).length, 11);
for (const m of Object.values(subjects)) {
  if (!m.enabled) { assert.throws(()=>convertMock(m,60),/more data/); continue; }
  let previous = -1;
  for (let mock=0;mock<=100;mock++) {
    const r = convertMock(m,mock,{roundPercentage:false,internal:100-m.externalMaximum});
    assert.ok(r.estimatedPercentage>=previous && r.estimatedPercentage<=100);
    assert.ok(r.externalMark>=0 && r.externalMark<=m.externalMaximum);
    assert.ok(r.total<=100);
    assert.equal(r.extrapolated,mock<m.mockRange[0]||mock>m.mockRange[1]);
    previous = r.estimatedPercentage;
  }
  for (const value of ['',null,NaN,Infinity,-1,101,true]) assert.throws(()=>convertMock(m,value));
  assert.throws(()=>convertMock(m,60,{internal:101-m.externalMaximum}),/Internal/);
  assert.throws(()=>convertMock(m,60,{internal:-1}),/Internal/);
  assert.equal(convertMock(m,60).total,null);
  assert.ok(convertMock(m,60,{internal:0}).total>0);
}
const engineering = convertMock(subjects.Engineering,55.79,{internal:60});
assert.equal(engineering.usedPercentage,86);
assert.equal(engineering.externalMark,21.5);
assert.equal(engineering.total,81.5);
assert.ok(Math.abs(subjects.Engineering.parameters[1]-2.4189)<.001);
assert.ok(Math.abs(subjects.Engineering.cvMAE-7.52316)<.001);
assert.ok(Math.abs(subjects.Chemistry.cvRMSE-6.06)<.01);
assert.equal(subjects.English.status,'Experimental');
assert.equal(subjects.Drama.status,'Experimental');
assert.equal(['Biology','Chemistry','Physics'].reduce((n,name)=>n+subjects[name].pooledTraining['2024'].n+subjects[name].pooledTraining['2025'].n,0),197);
assert.equal(subjects.Biology.pooledTraining['2025'].mae,2.69);
assert.equal(subjects.Chemistry.pooledTraining['2025'].mae,5.45);
assert.equal(subjects.Physics.pooledTraining['2025'].mae,2.8);
for (const name of ['Biology','Chemistry','Physics']) {
  assert.equal(subjects[name].independentValidation,undefined);
  assert.equal(subjects[name].historicalError80.basis,'in-sample training results');
}
const methods = convertMock(subjects['Mathematical Methods'],60,{roundPercentage:false});
assert.equal(methods.externalMark,methods.usedPercentage/2);
assert.equal(subjects['Mathematical Methods'].n,127);
assert.equal(subjects['General Mathematics'].n,45);
assert.equal(subjects['Specialist Mathematics'].n,71);
assert.ok(Math.abs(subjects['Mathematical Methods'].cvRMSE-7.07)<.01);
assert.ok(Math.abs(subjects['General Mathematics'].cvRMSE-6.22)<.01);
assert.ok(Math.abs(subjects['Specialist Mathematics'].cvRMSE-6.94)<.01);
const ui = fs.readFileSync('dist/mock-ui.mjs','utf8');
assert.ok(!/localStorage|sendBeacon|XMLHttpRequest/.test(ui));
assert.equal((ui.match(/fetch\(/g)||[]).length,3);
assert.ok(ui.includes("fetch('./mock-models.json')"));
assert.ok(ui.includes("fetch('./science-comparison.json')"));
assert.ok(ui.includes("fetch('./science-all-cohorts.json')"));
const pooled = JSON.parse(fs.readFileSync('dist/science-all-cohorts.json','utf8'));
for (const subject of ['Biology','Chemistry','Physics']) {
  const item = pooled.subjects[subject];
  assert.equal(Object.values(item.counts).reduce((a,b)=>a+b,0), item.pooledInSample.earlier.n + item.pooledInSample['2024'].n + item.pooledInSample['2025'].n);
  assert.ok(item.earlierPlus2024Test2025.rmse > 0);
  assert.equal(subjects[subject].n,Object.values(item.counts).reduce((a,b)=>a+b,0));
  assert.ok(Math.abs(subjects[subject].parameters[1]-item.pooledParameters[1])<1e-6);
  assert.ok(Math.abs(subjects[subject].parameters[2]-item.pooledParameters[2])<1e-6);
}
const comparison = JSON.parse(fs.readFileSync('dist/science-comparison.json','utf8'));
assert.deepEqual(Object.keys(comparison.subjects).sort(),['Biology','Chemistry','Physics']);
for (const subject of Object.values(comparison.subjects)) {
  assert.equal(subject.current.n,subject.n2025);
  assert.equal(subject.fit2024.n,subject.n2025);
  assert.equal(subject.mean2024.n,subject.n2025);
  assert.ok(subject.current.rmse < subject.fit2024.rmse);
  assert.ok(subject.current.rmse < subject.mean2024.rmse);
}
assert.equal(comparison.subjects.Chemistry.current2024Bias,-5.28);
assert.equal(comparison.subjects.Chemistry.current2025Bias,4.18);
assert.ok(!/student|surname|first name|identifier/i.test(JSON.stringify(comparison.subjects)));
console.log('13 subjects, 11 active models; units, rounding, invalid inputs, Engineering source parity and privacy checks passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {convertMock} from '../dist/mock-engine.mjs';
const {subjects} = JSON.parse(fs.readFileSync('dist/mock-models.json', 'utf8'));
assert.equal(Object.keys(subjects).length, 12);
assert.equal(Object.values(subjects).reduce((n,m)=>n+m.n,0), 221);
assert.equal(Object.values(subjects).filter(m=>m.enabled).length, 10);
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
assert.ok(Math.abs(subjects.Chemistry.cvMAE-3.16)<.01);
assert.equal(subjects.English.status,'Experimental');
assert.equal(subjects.Drama.status,'Experimental');
assert.equal(['Biology','Chemistry','Physics'].reduce((n,name)=>n+Object.values(subjects[name].independentValidation).reduce((sum,year)=>sum+year.n,0),0),197);
assert.equal(subjects.Biology.independentValidation['2025'].mae,2.76);
assert.equal(subjects.Chemistry.independentValidation['2025'].mae,5.86);
assert.equal(subjects.Physics.independentValidation['2025'].mae,3.12);
assert.equal(subjects.Biology.historicalError80.absoluteErrorPP,7.57);
assert.equal(subjects.Chemistry.historicalError80.absoluteErrorPP,9.74);
assert.equal(subjects.Physics.historicalError80.absoluteErrorPP,6.22);
const methods = convertMock(subjects['Mathematical Methods'],60,{roundPercentage:false});
assert.equal(methods.externalMark,methods.usedPercentage/2);
const ui = fs.readFileSync('dist/mock-ui.mjs','utf8');
assert.ok(!/localStorage|sendBeacon|XMLHttpRequest/.test(ui));
assert.equal((ui.match(/fetch\(/g)||[]).length,2);
assert.ok(ui.includes("fetch('./mock-models.json')"));
assert.ok(ui.includes("fetch('./science-comparison.json')"));
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
console.log('12 subjects, 10 active models; boundaries, units, rounding, invalid inputs, Engineering source parity and privacy checks passed.');

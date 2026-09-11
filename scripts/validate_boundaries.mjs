import assert from 'node:assert/strict';
import fs from 'node:fs';
import {predictionBoundary,boundaryText} from '../dist/boundaries.mjs';
import {atarFromAggregate,predict} from '../dist/engine.mjs';
import config from '../dist/boundary-config.mjs';
const rows=JSON.parse(fs.readFileSync('scripts/boundary-trials.json')).results;
const {models}=JSON.parse(fs.readFileSync('dist/models.json'));
for(const r of rows){const entries=r.subjects.map((subject,i)=>({subject,raw:r.scores[i]}));const original=predict(models['2025'],entries);assert.equal(original.atar,r.atar);assert.ok(Math.abs(original.aggregate-r.aggregate)<1e-8);const b=predictionBoundary('2025',entries,r.aggregate,r.atar);assert.ok(!b.reason);assert.ok((b.lower===0||b.lower<=r.range[0]+1e-8)&&b.upper>=r.range[1]-1e-8);assert.ok((b.lower===0||b.lower<=r.atar)&&b.upper>=r.atar);}
const entries=rows[0].subjects.map(subject=>({subject,raw:80}));
for(const [year,es,agg]of [['2024',entries,400],['2025',entries.slice(0,4),400],['2025',[...entries,{subject:'Business',raw:80}],400],['2025',entries.map((e,i)=>i?e:{...e,raw:54}),400],['2025',entries.map((e,i)=>i?e:{...e,subject:'French'}),400],['2025',entries,490]])assert.ok(predictionBoundary(year,es,agg,80).reason);
let previous={lower:0,upper:0};
for(let aggregate=config.minAggregate;aggregate<=config.maxAggregate;aggregate+=.01){const b=predictionBoundary('2025',entries,aggregate,atarFromAggregate(aggregate));assert.ok(b.lower>=previous.lower-1e-8&&b.upper>=previous.upper-1e-8,'Monotonic bounds');assert.ok(b.upper<=99.95);previous=b;}
assert.equal(boundaryText({lower:0,upper:35}),'<30–35.00');
console.log('100 benchmark envelopes, unchanged point estimates, scope guards, monotonic bounds and display checks passed');

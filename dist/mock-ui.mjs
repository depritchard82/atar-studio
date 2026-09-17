import {convertMock} from './mock-engine.mjs';
import {logistic} from './engine.mjs';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog, currentResult;
$('#mock').innerHTML = `
  <div class="card">
    <p class="eyebrow">MOCK → REAL EXTERNAL</p>
    <h2>Estimate your external result</h2>
    <p>Choose a subject and enter your mock percentage. These school-cohort models are separate from the scaling dataset year above.</p>
    <label>Subject<select id="mock-subject" disabled><option>Loading models…</option></select></label>
    <div class="inline mock-inputs">
      <label>Mock result (%)<input id="mock-percent" type="number" min="0" max="100" step="any" value="60"></label>
      <label>Internal total <span id="mock-internal-max"></span> (optional)<input id="mock-internal" type="number" min="0" step="any" placeholder="Add to estimate subject total"></label>
    </div>
    <label class="mock-round"><input id="mock-round" type="checkbox" checked> Round predicted percentage to a whole number</label>
    <p class="muted">This matches the percentage rounding in the Engineering spreadsheet. The weighted external mark may still contain decimals.</p>
    <button class="primary" id="mock-convert" disabled>Convert mock result</button>
    <div id="mock-error" role="alert"></div>
    <div id="mock-evidence"></div>
  </div>
  <div class="card result">
    <p class="eyebrow">PREDICTED EXTERNAL</p>
    <div id="mock-result" aria-live="polite"><p>Loading subject models…</p></div>
    <button id="mock-use" hidden>Use total in individual prediction</button>
    <p id="mock-copy-status" role="status"></p>
    <div id="mock-plot"></div>
    <p class="muted">Teal: fitted conversion. Dashed: unchanged percentage. Shading: observed mock range. Values beyond the shaded range extrapolate; this is not a confidence band.</p>
  </div>
  <div class="card full" id="science-review">
    <h2>Earlier science model check: 2025 results</h2>
    <p>These results explain the decision to try pooled curves. Each earlier option predicted the same later cohort without using 2025 results for fitting.</p>
    <div id="science-review-table"><p>Loading comparison…</p></div>
    <p class="muted">This is a historical test of the previous curve, not an independent test of the pooled curve now in use. MAE is the average miss; RMSE gives larger misses more weight. Signed error is prediction minus actual, in percentage points.</p>
    <p id="science-review-note"></p>
  </div>
  <div class="card full" id="science-pooled">
    <h2>Science curves using all available results</h2>
    <p>The active Biology, Chemistry and Physics curves now combine the earlier workbook, 2024 and 2025 paired results. To check how pooling might travel to a different year, each test curve below was fitted without the year being tested.</p>
    <div id="science-pooled-table"><p>Loading pooled comparison…</p></div>
    <p class="muted">RMSE is in percentage points. The active all-data curve has seen every result, so its fit to those same results is not a forecast test. The earlier workbook is mostly labelled completion year 2022, although its filename says 2023.</p>
    <p id="science-pooled-note"></p>
  </div>
  <div class="card full">
    <h2>Models available now</h2>
    <p id="mock-count"></p>
    <div id="mock-model-table"></div>
    <p class="muted">Training errors use leave-one-student-out cross-validation. For the pooled science curves, this is not a future-year check because other students from the same year remain in training. MAE is average absolute error; RMSE gives larger misses more weight. Errors are percentage points, not uncertainty intervals.</p>
    <p class="muted">Experimental models did not beat a cohort-mean baseline on held-out RMSE. They are available for exploration, with that limitation shown. Unavailable subjects are not substituted with another subject’s curve.</p>
    <details><summary>Sources and how to improve these models</summary><p id="mock-sources"></p><p>For the next update, collect paired mock and real external results for each subject, plus the exam maximum, mock paper, year and cohort. Include a broad range of results. Keep a new cohort separate when testing a revised curve.</p><p>No student names or individual score pairs are included in this site.</p></details>
  </div>`;

const selected = () => catalog.subjects[$('#mock-subject').value];
function clearResult() {
  currentResult = null;
  $('#mock-result').innerHTML = '<p>Enter a mock result, then convert.</p>';
  $('#mock-error').textContent = '';
  $('#mock-use').hidden = true;
  $('#mock-copy-status').textContent = '';
}
function plot(m) {
  if (!m.enabled) { $('#mock-plot').innerHTML = ''; return; }
  const x = n => 45 + n * 4.4, y = n => 270 - n * 2.3;
  let svg = `<svg viewBox="0 0 510 325" role="img" aria-label="${esc(m.subject)} mock percentage to predicted external percentage"><rect x="${x(m.mockRange[0])}" y="40" width="${(m.mockRange[1]-m.mockRange[0])*4.4}" height="230" fill="#e0f1ef"/>`;
  for (let n=0;n<=100;n+=20) svg += `<path d="M45 ${y(n)}H485 M${x(n)} 40V270" stroke="#d7e1eb"/><text x="35" y="${y(n)+4}" text-anchor="end" font-size="12" fill="#526479">${n}</text><text x="${x(n)}" y="291" text-anchor="middle" font-size="12" fill="#526479">${n}</text>`;
  svg += `<path d="M45 270L485 40" stroke="#6f8293" stroke-dasharray="5 5" fill="none"/><path d="${Array.from({length:101},(_,i)=>`${i?'L':'M'}${x(i)},${y(logistic(i,m.parameters))}`).join(' ')}" stroke="#007e75" stroke-width="3" fill="none"/>`;
  if (currentResult) svg += `<circle cx="${x(currentResult.mockPercentage)}" cy="${y(currentResult.estimatedPercentage)}" r="5" fill="#15263e"/>`;
  $('#mock-plot').innerHTML = svg + '<text x="45" y="22" font-size="13" fill="#526479">Predicted external (%)</text><text x="265" y="318" text-anchor="middle" font-size="13" fill="#526479">Mock (%)</text></svg>';
}
function changeSubject() {
  clearResult();
  const m = selected();
  $('#mock-internal').value = '';
  $('#mock-internal').max = 100 - m.externalMaximum;
  $('#mock-internal-max').textContent = `(out of ${100-m.externalMaximum})`;
  $('#mock-convert').disabled = !m.enabled;
  const independent = m.independentValidation ? `<p>Independent checks: 2024 MAE <strong>${m.independentValidation['2024'].mae.toFixed(2)} pp</strong> (${m.independentValidation['2024'].n} results); 2025 MAE <strong>${m.independentValidation['2025'].mae.toFixed(2)} pp</strong> (${m.independentValidation['2025'].n} results). These cohorts were not used to fit this curve.</p>` : '';
  const pooled = m.pooledTraining ? `<p>All-data fit: 2024 MAE <strong>${m.pooledTraining['2024'].mae.toFixed(2)} pp</strong>; 2025 MAE <strong>${m.pooledTraining['2025'].mae.toFixed(2)} pp</strong>. Both years were used to fit this curve, so these errors are optimistic for a future exam.</p>` : '';
  $('#mock-evidence').innerHTML = `<p><strong>${esc(m.status)} · ${m.n} training pairs</strong><br>Observed mocks: ${m.mockRange.map(n=>n.toFixed(1)).join('–')}%. Real external contribution: out of ${m.externalMaximum}.</p>${m.cvMAE == null ? '' : `<p>Training leave-one-student-out MAE: <strong>${m.cvMAE.toFixed(2)} percentage points</strong> (about ${(m.cvMAE*m.externalMaximum/100).toFixed(2)} marks out of ${m.externalMaximum}).</p>`}${independent}${pooled}${m.warnings.map(w=>`<p class="mock-warning">${esc(w)}</p>`).join('')}<details><summary>Model and source details</summary><p>${esc(m.source)} · ${esc(m.sheet)}<br>${esc(m.mapping)}<br>Cohort: ${esc(m.cohort)}</p>${m.parameters ? `<p>External % = 100 / (1 + ${m.parameters[1].toPrecision(7)} × exp(−${m.parameters[2].toPrecision(7)} × mock %)).</p><p>Training R²: ${m.r2.toFixed(3)}. Leave-one-student-out RMSE: ${m.cvRMSE.toFixed(2)} pp; cohort-mean baseline: ${m.baselineRMSE.toFixed(2)} pp.</p>` : ''}</details>`;
  if (!m.enabled) $('#mock-result').innerHTML = '<p>This subject is awaiting more data. No conversion is enabled.</p>';
  plot(m);
}
$('#mock-convert').onclick = () => {
  clearResult();
  try {
    const m = selected();
    currentResult = convertMock(m, $('#mock-percent').value, {roundPercentage:$('#mock-round').checked, internal:$('#mock-internal').value});
    const r = currentResult;
    const evidence = m.historicalError80;
    const checkedRange = evidence && r.mockPercentage >= evidence.mockRange[0] && r.mockPercentage <= evidence.mockRange[1];
    const low = checkedRange ? Math.max(0, r.estimatedPercentage - evidence.absoluteErrorPP) * m.externalMaximum / 100 : null;
    const high = checkedRange ? Math.min(100, r.estimatedPercentage + evidence.absoluteErrorPP) * m.externalMaximum / 100 : null;
    const history = checkedRange ? `<p class="mock-total">2024–25 ${m.pooledTraining?'training':'historical'} error guide: <strong>${low.toFixed(2)}–${high.toFixed(2)} / ${m.externalMaximum}</strong>. This span covered 80% of the ${evidence.n} ${m.pooledTraining?'fitted':'checked'} results; it is not a guaranteed range for a future exam.</p>` : evidence ? '<p class="muted">No historical error guide at this mock score; it is outside the 2024–25 score range.</p>' : '';
    $('#mock-result').innerHTML = `<div class="big">${r.usedPercentage.toFixed($('#mock-round').checked?0:1)}%</div><p><strong>${r.externalMark.toFixed(2)} / ${m.externalMaximum}</strong> weighted external marks</p><p class="muted">Unrounded fitted estimate: ${r.estimatedPercentage.toFixed(2)}%.</p>${history}${r.total===null?'':`<p class="mock-total">Projected subject total: <strong>${r.total.toFixed(2)} / 100</strong></p>`}${r.extrapolated?'<p class="mock-warning">Outside the observed mock range. This prediction is an extrapolation and has less support from the supplied data.</p>':''}<p class="muted">${esc(m.status)} estimate based on ${m.n} training pairs. Leave-one-student-out MAE ${m.cvMAE.toFixed(2)} percentage points${m.pooledTraining?'; this is not a future-year check':''}. This predicts an external result; it is not QTAC subject scaling.</p>`;
    $('#mock-use').hidden = r.total === null;
    plot(m);
  } catch (e) { $('#mock-error').textContent = e.message; plot(selected()); }
};
$('#mock-use').onclick = () => {
  if (currentResult?.total == null) return;
  const name = selected().subject;
  const rows = [...document.querySelectorAll('#subjects .subject-row')];
  const row = rows.find(r=>r.querySelector('select').value===name) || rows.find(r=>!r.querySelector('select').value && !r.querySelector('input').value);
  if (!row) { $('#mock-copy-status').textContent = 'All six subject rows are occupied. Clear a row in Individual prediction first.'; return; }
  const select = row.querySelector('select');
  if (![...select.options].some(o=>o.value===name)) { $('#mock-copy-status').textContent = 'This subject is not available in the selected scaling dataset.'; return; }
  select.value = name;
  row.querySelector('input').value = currentResult.total.toFixed(2);
  row.querySelector('input').dispatchEvent(new Event('input', {bubbles:true}));
  document.querySelector('nav button[data-tab="single"]').click();
};
$('#mock-subject').onchange = changeSubject;
for (const id of ['mock-percent','mock-internal','mock-round']) $('#'+id).addEventListener('input',()=>{if(!catalog)return;clearResult();plot(selected());});

fetch('./mock-models.json').then(r=>{if(!r.ok) throw Error('Could not load mock models.');return r.json();}).then(data=>{
  catalog = data;
  const models = Object.values(catalog.subjects).sort((a,b)=>a.subject.localeCompare(b.subject));
  $('#mock-subject').innerHTML = models.map(m=>`<option value="${esc(m.subject)}">${esc(m.subject)}${m.enabled?'':' — awaiting data'}</option>`).join('');
  $('#mock-subject').disabled = false;
  $('#mock-subject').value = 'Engineering';
  $('#mock-count').textContent = `${models.filter(m=>m.enabled).length} converters enabled across ${models.length} subjects reviewed, using ${models.reduce((n,m)=>n+m.n,0)} training pairs. The 2024 and 2025 science results are included in that total.`;
  $('#mock-model-table').innerHTML = `<div class="table-wrap"><table><thead><tr>${['Subject','Training pairs','Status','Leave-one-student-out MAE (pp)','2025 fit MAE (pp)','Mock range (%)','External maximum'].map(s=>`<th>${s}</th>`).join('')}</tr></thead><tbody>${models.map(m=>`<tr><td>${esc(m.subject)}</td><td>${m.n}</td><td>${esc(m.status)}</td><td>${m.cvMAE==null?'—':m.cvMAE.toFixed(2)}</td><td>${m.pooledTraining?.['2025']?.mae?.toFixed(2)??'—'}</td><td>${m.mockRange.map(n=>n.toFixed(1)).join('–')}</td><td>${m.externalMaximum}</td></tr>`).join('')}</tbody></table></div>`;
  $('#mock-sources').textContent = catalog.sourceNotes + ' Most completion-year labels in scaling comparisons - 2023.xlsx are 2022. The combined Mathematics workbook does not label its component years. Engineering uses the ten supplied percentage pairs; its cohort year is unknown.';
  changeSubject();
}).catch(e=>{$('#mock-error').textContent=e.message;$('#mock-result').textContent='Models unavailable. Reload to retry.';});

fetch('./science-comparison.json').then(r=>{if(!r.ok) throw Error('Comparison unavailable.');return r.json();}).then(data=>{
  const labels = {current:'Previous curve', fit2024:'Fitted on 2024', mean2024:'2024 cohort mean'};
  const rows = Object.entries(data.subjects).flatMap(([name, subject]) =>
    Object.entries(labels).map(([key, label]) => {
      const m = subject[key];
      const bar = `<div class="science-error-bar" aria-hidden="true"><i style="width:${Math.min(100,m.rmse/15*100)}%"></i></div>`;
      return `<tr><th scope="row">${esc(name)}</th><td>${label}</td><td class="num">${m.mae.toFixed(2)}</td><td class="num">${m.rmse.toFixed(2)}${bar}</td><td class="num">${m.bias>0?'+':''}${m.bias.toFixed(2)}</td></tr>`;
    })
  );
  $('#science-review-table').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Subject</th><th>Prediction used for 2025</th><th>MAE (pp)</th><th>RMSE (pp)</th><th>Signed error (pp)</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const chemistry = data.subjects.Chemistry;
  $('#science-review-note').innerHTML = `<strong>What the historical check showed:</strong> The previous curve had the lowest 2025 RMSE among these options. Chemistry's average signed error changed from ${chemistry.current2024Bias.toFixed(2)} pp in 2024 to +${chemistry.current2025Bias.toFixed(2)} pp in 2025. The active pooled curve includes 2025 results and cannot be fairly ranked on this historical test.`;
}).catch(()=>{$('#science-review-table').textContent='The comparison could not be loaded. Reload to retry.';});

fetch('./science-all-cohorts.json').then(r=>{if(!r.ok) throw Error('Pooled comparison unavailable.');return r.json();}).then(data=>{
  const rows = Object.entries(data.subjects).map(([name, item]) => `<tr><th scope="row">${esc(name)}</th><td class="num">${Object.values(item.counts).reduce((a,b)=>a+b,0)}</td><td class="num">${item.currentHeldOut['2024'].rmse.toFixed(2)}</td><td class="num">${item.earlierPlus2025Test2024.rmse.toFixed(2)}</td><td class="num">${item.currentHeldOut['2025'].rmse.toFixed(2)}</td><td class="num">${item.earlierPlus2024Test2025.rmse.toFixed(2)}</td></tr>`);
  $('#science-pooled-table').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Subject</th><th>All pairs</th><th>Previous on 2024</th><th>Earlier + 2025 on 2024</th><th>Previous on 2025</th><th>Earlier + 2024 on 2025</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  $('#science-pooled-note').textContent = 'The all-data curves are now active. Pooling uses every available paired result, but the year-held-out checks did not consistently beat the previous curves. Chemistry varies substantially by cohort, so treat its estimate with particular caution.';
}).catch(()=>{$('#science-pooled-table').textContent='The pooled comparison could not be loaded. Reload to retry.';});

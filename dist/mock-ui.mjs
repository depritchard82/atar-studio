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
  <div class="card full">
    <h2>Models available now</h2>
    <p id="mock-count"></p>
    <div id="mock-model-table"></div>
    <p class="muted">Held-out errors use leave-one-out cross-validation: each result is predicted by a model fitted without that result. MAE is the average absolute error; RMSE gives larger errors more weight. These are percentage points, not guarantees or uncertainty intervals. All models still need testing on a new cohort.</p>
    <p class="muted">Experimental models did not beat a cohort-mean baseline on held-out RMSE. They are available for exploration, with that limitation shown. Unavailable subjects are not substituted with another subject’s curve.</p>
    <details><summary>Sources and how to improve these models</summary><p id="mock-sources"></p><p>For the next update, collect paired mock and real external results for each subject, plus the exam maximum, mock paper, year and cohort. Include a broad range of results. Keep a new cohort separate so we can test whether these curves generalise.</p><p>No student names or individual score pairs are included in this site.</p></details>
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
  $('#mock-evidence').innerHTML = `<p><strong>${esc(m.status)} · ${m.n} paired results</strong><br>Observed mocks: ${m.mockRange.map(n=>n.toFixed(1)).join('–')}%. Real external contribution: out of ${m.externalMaximum}.</p>${m.cvMAE == null ? '' : `<p>Held-out MAE: <strong>${m.cvMAE.toFixed(2)} percentage points</strong> (about ${(m.cvMAE*m.externalMaximum/100).toFixed(2)} marks out of ${m.externalMaximum}).</p>`}${m.warnings.map(w=>`<p class="mock-warning">${esc(w)}</p>`).join('')}<details><summary>Model and source details</summary><p>${esc(m.source)} · ${esc(m.sheet)}<br>${esc(m.mapping)}<br>Cohort: ${esc(m.cohort)}</p>${m.parameters ? `<p>External % = 100 / (1 + ${m.parameters[1].toPrecision(7)} × exp(−${m.parameters[2].toPrecision(7)} × mock %)).</p><p>Training R²: ${m.r2.toFixed(3)}. Held-out RMSE: ${m.cvRMSE.toFixed(2)} pp; cohort-mean baseline: ${m.baselineRMSE.toFixed(2)} pp.</p>` : ''}</details>`;
  if (!m.enabled) $('#mock-result').innerHTML = '<p>This subject is awaiting more data. No conversion is enabled.</p>';
  plot(m);
}
$('#mock-convert').onclick = () => {
  clearResult();
  try {
    const m = selected();
    currentResult = convertMock(m, $('#mock-percent').value, {roundPercentage:$('#mock-round').checked, internal:$('#mock-internal').value});
    const r = currentResult;
    $('#mock-result').innerHTML = `<div class="big">${r.usedPercentage.toFixed($('#mock-round').checked?0:1)}%</div><p><strong>${r.externalMark.toFixed(2)} / ${m.externalMaximum}</strong> weighted external marks</p><p class="muted">Unrounded fitted estimate: ${r.estimatedPercentage.toFixed(2)}%.</p>${r.total===null?'':`<p class="mock-total">Projected subject total: <strong>${r.total.toFixed(2)} / 100</strong></p>`}${r.extrapolated?'<p class="mock-warning">Outside the observed mock range. This prediction is an extrapolation and has less support from the supplied data.</p>':''}<p class="muted">${esc(m.status)} estimate based on ${m.n} pairs. Held-out MAE ${m.cvMAE.toFixed(2)} percentage points. This predicts an external result; it is not QTAC subject scaling.</p>`;
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
  $('#mock-count').textContent = `${models.filter(m=>m.enabled).length} converters enabled across ${models.length} subjects reviewed, using ${models.reduce((n,m)=>n+m.n,0)} paired results. More data can be added in the next update.`;
  $('#mock-model-table').innerHTML = `<div class="table-wrap"><table><thead><tr>${['Subject','Pairs','Status','Held-out MAE (pp)','Mock range (%)','External maximum'].map(s=>`<th>${s}</th>`).join('')}</tr></thead><tbody>${models.map(m=>`<tr><td>${esc(m.subject)}</td><td>${m.n}</td><td>${esc(m.status)}</td><td>${m.cvMAE==null?'—':m.cvMAE.toFixed(2)}</td><td>${m.mockRange.map(n=>n.toFixed(1)).join('–')}</td><td>${m.externalMaximum}</td></tr>`).join('')}</tbody></table></div>`;
  $('#mock-sources').textContent = catalog.sourceNotes + ' Most completion-year labels in scaling comparisons - 2023.xlsx are 2022. Engineering uses the ten supplied percentage pairs; its cohort year is unknown.';
  changeSubject();
}).catch(e=>{$('#mock-error').textContent=e.message;$('#mock-result').textContent='Models unavailable. Reload to retry.';});

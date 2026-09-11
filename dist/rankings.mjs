import {logistic} from './engine.mjs';
export const bands = [
  ['subscore',0,99], ['topscore',90,99], ['ascore',80,99],
  ['bscore',60,79], ['cscore',40,59]
];
export function subjectRankings(model) {
  return Object.entries(model.subjects).map(([subject,curve]) => {
    const row = {subject, outside:[]};
    for (const [key,start,end] of bands) {
      let total=0, outside=false;
      for (let raw=start;raw<=end;raw++) {
        const value=logistic(raw,curve.parameters);
        total+=value;
        if(value<0||value>100) outside=true;
      }
      row[key]=Number.isFinite(total)?total/(end-start+1):null;
      if(outside) row.outside.push(key);
    }
    return row;
  });
}
export function sortRankings(rows,key='subscore',ascending=false) {
  return [...rows].sort((a,b)=>{
    if(key==='subject') return (ascending?1:-1)*a.subject.localeCompare(b.subject);
    if(a[key]===null) return b[key]===null?a.subject.localeCompare(b.subject):1;
    if(b[key]===null) return -1;
    return (ascending?a[key]-b[key]:b[key]-a[key]) || a.subject.localeCompare(b.subject);
  });
}
export function rankingsCSV(rows,year) {
  const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  return [['Year','Subject',...bands.map(([k])=>k),'Notes'],...rows.map(r=>[year,r.subject,...bands.map(([k])=>r[k]),r.outside.length?'Unclipped fitted values outside 0–100 in: '+r.outside.join(', '):''])].map(r=>r.map(quote).join(',')).join('\r\n');
}
export function initRankings(getModel,getYear) {
  const button=document.createElement('button');button.dataset.tab='rankings';button.textContent='Subject Rankings';document.querySelector('nav button[data-tab="compare"]').after(button);
  const panel=document.createElement('section');panel.id='rankings';panel.className='panel';panel.hidden=true;
  document.querySelector('footer').before(panel);
  panel.innerHTML=`<div class="card full"><h2>Compare scaling across score bands</h2><p>Average fitted scaled scores at every integer raw score in each band, using the selected scaling dataset. Raw 100 is excluded, matching your Python calculation.</p><p class="muted">These are equally weighted curve averages, not actual cohort averages or ATAR predictions. Curves extrapolate beyond their source points. Values are not clipped; * marks a band with fitted values outside 0–100.</p><button id="rank-export" disabled>Download rankings CSV</button><p id="rank-status" role="status">Loading rankings…</p><div id="rank-table" class="table-wrap"></div></div>`;
  let rows=[],key='subscore',ascending=false;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels=[['subject','Subject'],...bands.map(([k,a,b])=>[k,`${k} (${a}–${b})`])];
  function render() {
    const sorted=sortRankings(rows,key,ascending);
    panel.querySelector('#rank-table').innerHTML=`<table><thead><tr>${labels.map(([k,label])=>`<th aria-sort="${k===key?(ascending?'ascending':'descending'):'none'}"><button data-sort="${k}">${label}${k===key?(ascending?' ↑':' ↓'):''}</button></th>`).join('')}</tr></thead><tbody>${sorted.map(r=>`<tr><td>${esc(r.subject)}</td>${bands.map(([k])=>`<td class="num">${r[k]===null?'Unavailable':r[k].toFixed(2)+(r.outside.includes(k)?' *':'')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    panel.querySelector('#rank-status').textContent=`${getYear()} · ${rows.length} subjects · Sorted by ${key}, ${ascending?'ascending':'descending'}. Select a column heading to change the order. CSV retains full precision.`;
    for(const b of panel.querySelectorAll('[data-sort]')) b.onclick=()=>{const next=b.dataset.sort;ascending=next===key?!ascending:next==='subject';key=next;render();};
  }
  panel.querySelector('#rank-export').onclick=()=>{
    const blob=new Blob(['\uFEFF'+rankingsCSV(sortRankings(rows,key,ascending),getYear())],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`subject-rankings-${getYear()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return ()=>{rows=subjectRankings(getModel());render();panel.querySelector('#rank-export').disabled=false;};
}

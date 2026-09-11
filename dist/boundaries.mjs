import config from './boundary-config.mjs';
import {atarFromAggregate} from './engine.mjs';
export const boundaryNote='Experimental comparison range from 100 synthetic QTAC Navigator trials; not a confidence interval or a guarantee of your actual ATAR. The central estimate retains the original formula.';
export function predictionBoundary(year,entries,aggregate,atar){
 if(String(year)!==config.year)return {reason:'Comparison ranges are available only with the 2025 scaling dataset.'};
 if(entries.length!==5||!entries.some(e=>e.subject==='English')||new Set(entries.map(e=>e.subject)).size!==5||entries.some(e=>!config.subjects.includes(e.subject)||!Number.isFinite(Number(e.raw))||Number(e.raw)<55||Number(e.raw)>98))return {reason:'Range unavailable: benchmark scope is five tested subjects including English, with raw scores 55–98.'};
 if(!Number.isFinite(aggregate)||!Number.isFinite(atar)||atar===0||aggregate<config.minAggregate||aggregate>config.maxAggregate)return {reason:'Range unavailable: aggregate is outside the tested span.'};
 const b=config.bands.find(b=>aggregate>=b.min&&aggregate<b.max);
 // Carry forward preceding upper endpoints so crossing a band never lowers the range.
 const upper=Math.max(atar+b.upperOffset,...config.bands.filter(p=>p.max<=aggregate).map(p=>atarFromAggregate(p.max-1e-7)+p.upperOffset));
 const lower=Math.min(atar+b.lowerOffset,...config.bands.filter(p=>p.min>aggregate).map(p=>atarFromAggregate(p.min)+p.lowerOffset));
 const low=Math.floor((lower+1e-8)*20)/20,high=Math.ceil((upper-1e-8)*20)/20;
 return {lower:low<30?0:low,upper:Math.min(99.95,high),n:b.n};
}
export function boundaryText(r){return r.reason?r.reason:`${r.lower===0?'<30':r.lower.toFixed(2)}–${r.upper.toFixed(2)}`;}

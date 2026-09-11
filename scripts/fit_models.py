"""Reproduce the desktop app's curve fitting; no student records are used."""
import json, csv, hashlib, warnings
from pathlib import Path
import numpy as np
from scipy.optimize import differential_evolution, curve_fit

ROOT = Path(__file__).resolve().parents[1]
def logistic(x,L,a,b):
    return L/(1+a*np.exp(-b*x))

models = {}
for year, filename in [('2020','test.csv'),('2021','test2.csv'),('2023','2023scaling.csv'),('2024','2024scaling.csv'),('2025','2025scaling.csv')]:
    source = ROOT/'data'/filename
    subjects = {}
    with source.open(encoding='utf-8-sig',newline='') as f:
        for row in csv.reader(f,delimiter=';'):
            if not row: continue
            name = row[0].strip()
            raw = np.array([float(v) for v in row[1].split()])
            scaled = np.array([float(v) for v in row[2].split()])
            assert len(raw)==len(scaled) and len(raw)>=3
            def sse(params):
                with warnings.catch_warnings():
                    warnings.simplefilter('ignore')
                    return float(np.sum((scaled-logistic(raw,*params))**2))
            initial=differential_evolution(sse,[(1,200),(.001,200),(-.5,.5)],seed=3,polish=True).x
            params,_=curve_fit(logistic,raw,scaled,p0=initial,maxfev=20000)
            assert np.isfinite(params).all()
            subjects[name]={'parameters':params.tolist(),'raw':raw.tolist(),'scaled':scaled.tolist(),'rmse':float(np.sqrt(np.mean((scaled-logistic(raw,*params))**2)))}
    models[year]={'file':filename,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'subjects':subjects}
    if year == '2025':
        models[year]['source']=json.loads((ROOT/'data/2025-source.json').read_text())
    print(year,len(subjects),'subjects',flush=True)
(ROOT/'dist'/'models.json').write_text(json.dumps({'method':'atar_gui_app6.py logistic fit; original fixed aggregate approximation','models':models},allow_nan=False),encoding='utf-8')

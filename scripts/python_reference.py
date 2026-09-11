import json, math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
models=json.loads((root/'dist/models.json').read_text())['models']
references={}
for year, model in models.items():
    values=[]
    for subject,curve in sorted(model['subjects'].items())[:8]:
        L,a,b=curve['parameters']
        values.append(L/(1+a*math.exp(-b*80)))
    references[year]=sum(sorted(values,reverse=True)[:5])
(root/'scripts/python-reference.json').write_text(json.dumps(references))

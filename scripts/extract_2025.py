"""Extract numeric percentile pairs from QTAC 2025 tables 6–7 only."""
import csv, json, re, hashlib, sys
from pathlib import Path
import pdfplumber
root=Path(__file__).resolve().parents[1]
pdf_path=Path(sys.argv[1])
old=json.loads((root/'dist/models.json').read_text())['models']['2024']['subjects']
names={re.sub(r'\s+','',n):n for n in old}
names.update({'FrenchExtension':'French Extension','GermanExtension':'German Extension','ChineseExtension':'Chinese Extension','MusicExtension(Musicology)':'Music Extension (Musicology)'})
rows=[];withheld=[];metadata={}
with pdfplumber.open(pdf_path) as pdf:
    for page_index in range(8,13):
        lines=pdf.pages[page_index].extract_text().splitlines()
        for i,line in enumerate(lines):
            if not re.match(r'^\d{4}[cmp]? ',line):continue
            code,compact=line.split(' ',1)
            if code.startswith('6'):continue # Applied grades are outside this model.
            assert lines[i-1].startswith('Raw') and lines[i+1].startswith('Scaled'),line
            raw=lines[i-1].split()[1:];scaled=lines[i+1].split()[1:]
            category='Senior External Examination' if code.startswith('4') else 'General / General Extension'
            name=names.get(compact,compact)
            if code=='4011':name='Chinese (Senior External Examination)'
            if not raw:
                assert not scaled
                withheld.append({'code':code,'subject':name,'category':category});continue
            assert name!=compact or compact in names,compact
            assert len(raw)==len(scaled)==5
            assert all(0<=float(v)<=100 for v in raw+scaled)
            assert name not in metadata
            rows.append([name,' '.join(raw),' '.join(scaled)])
            metadata[name]={'code':code,'category':category,'report_page':page_index}
with (root/'data/2025scaling.csv').open('w',encoding='utf-8',newline='') as f:
    csv.writer(f,delimiter=';',lineterminator='\n').writerows(rows)
source={'url':'https://qtac-files.s3.ap-southeast-2.amazonaws.com/ATAR_Report_2025.pdf','title':'QTAC ATAR Report 2025','published':'February 2026','tables':[6,7],'pdf_sha256':hashlib.sha256(pdf_path.read_bytes()).hexdigest(),'subjects':metadata,'withheld':withheld}
(root/'data/2025-source.json').write_text(json.dumps(source,indent=2),encoding='utf-8')
print(json.dumps({'included':len(rows),'withheld':withheld},indent=2))

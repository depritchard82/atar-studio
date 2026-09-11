from pathlib import Path
p=Path('dist/app.js')
s=p.read_text(encoding='utf-8')
s=s.replace('Dataset years follow the existing filenames; their year labels have not been independently verified.', 'The 2025 data is from the QTAC ATAR Report 2025. Earlier year labels follow the original filenames and have not been independently verified.')
s=s.replace('notice();plotCurves();}', 'notice();plotCurves();updateSourceNote();}')
p.write_text(s,encoding='utf-8')

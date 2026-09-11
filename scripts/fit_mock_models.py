"""Fit aggregate-only mock converters from local source workbooks; never export names or pairs."""
import argparse
import json
import math
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares
from scipy.special import expit
import openpyxl

SPECS = [
    ('Methods', 'Mathematical Methods', 22, 23, 50, 2),
    ('Spec', 'Specialist Mathematics', 14, 15, 50, 1),
    ('Chem', 'Chemistry', 22, 23, 50, 2),
    ('Physics', 'Physics', 18, 19, 50, 2),
    ('Biology', 'Biology', 18, 19, 50, 2),
    ('Accounting', 'Accounting', 18, 19, 25, 2),
    ('Design', 'Design', 20, 21, 25, 2),
    ('Drama', 'Drama', 18, 19, 25, 2),
    ('Economics', 'Economics', 18, 19, 25, 2),
    ('English', 'English', 18, 19, 25, 2),
    ('englishlitext', 'English and Literature Extension', 18, 19, 25, 2),
]

def numeric(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)

def fit(x, y):
    return least_squares(lambda p: 100 * expit(p[1] * x - p[0]) - y,
                         [1, .04], bounds=([-15, 0], [15, 1]), max_nfev=2000).x

def build(name, pairs, maximum, source, sheet, mapping, cohort):
    x, y = np.array(pairs, dtype=float).T
    result = dict(subject=name, n=len(x), externalMaximum=maximum,
                  mockRange=[float(x.min()), float(x.max())], source=source,
                  sheet=sheet, mapping=mapping, cohort=cohort, enabled=False,
                  status='Awaiting data', warnings=[])
    if len(x) < 4:
        result['warnings'] = ['Only two paired results; no conversion fitted.']
        return result
    p = fit(x, y)
    errors, baseline_errors = [], []
    for i in range(len(x)):
        keep = np.arange(len(x)) != i
        lp = fit(x[keep], y[keep])
        errors.append(100 * expit(lp[1] * x[i] - lp[0]) - y[i])
        baseline_errors.append(y[keep].mean() - y[i])
    residual = 100 * expit(p[1] * x - p[0]) - y
    result.update(parameters=[100, float(np.exp(p[0])), float(p[1])],
                  cvMAE=float(np.mean(np.abs(errors))), cvRMSE=float(np.sqrt(np.mean(np.square(errors)))),
                  baselineRMSE=float(np.sqrt(np.mean(np.square(baseline_errors)))),
                  r2=float(1 - np.sum(residual ** 2) / np.sum((y - y.mean()) ** 2)),
                  enabled=True, status='Provisional')
    if len(x) < 12:
        result['warnings'].append('Small sample: estimates may change substantially with new data.')
    if result['cvRMSE'] >= result['baselineRMSE']:
        result['status'] = 'Experimental'
        result['warnings'].append('Held-out RMSE is worse than predicting the cohort mean; this curve has not demonstrated an improvement over that baseline.')
    if name == 'English and Literature Extension':
        result.update(enabled=False, status='Awaiting data')
        result['warnings'].append('The fitted curve is effectively flat. More varied paired results are needed before enabling conversion.')
    if sheet != 'Methods' and name != 'Engineering':
        result['warnings'].append('Mock/external column interpretation is inferred from the workbook layout and assessment weights; please confirm with the source owner.')
    return result

def engineering_pairs(path):
    ns = {'t': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0', 'o': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0'}
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read('content.xml'))
    table = root.find('.//t:table', ns)
    rows = []
    for row in table.findall('t:table-row', ns)[:11]:
        cells = []
        for cell in row.findall('t:table-cell', ns):
            v = cell.get('{'+ns['o']+'}value')
            cells.extend([float(v) if v is not None else None] * min(20, int(cell.get('{'+ns['t']+'}number-columns-repeated', '1'))))
        rows.append(cells)
    pairs = [(r[1], r[2]) for r in rows[1:11] if len(r)>2 and numeric(r[1]) and numeric(r[2])]
    if len(pairs) != 10:
        raise ValueError('Expected ten Engineering pairs in Sheet1 B2:C11; inspect the source before fitting.')
    return pairs

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('workbook')
    parser.add_argument('engineering')
    args = parser.parse_args()
    wb = openpyxl.load_workbook(args.workbook, read_only=True, data_only=True)
    subjects = {}
    for sheet, name, mock, actual, maximum, start in SPECS:
        pairs = []
        # The workbook's populated cohort tables end before row 250. Its inflated
        # formatted dimensions (over a million rows) are not student records.
        for row in wb[sheet].iter_rows(min_row=start, max_row=250, values_only=True):
            a, b = row[mock-1], row[actual-1]
            if numeric(a) and numeric(b):
                if not (0 <= a <= maximum and 0 <= b <= maximum):
                    raise ValueError(f'{sheet}: unexpected score scale')
                pairs.append((a/maximum*100, b/maximum*100))
        mapping = f'{openpyxl.utils.get_column_letter(mock)} mock, {openpyxl.utils.get_column_letter(actual)} external; weighted marks out of {maximum}; rows {start}–250 inspected'
        subjects[name] = build(name, pairs, maximum, Path(args.workbook).name, sheet, mapping,
                               'Not labelled (workbook cohort mostly 2022)' if sheet == 'Spec' else '2022 (completion-year column; filename says 2023)')
    wb.close()
    subjects['Engineering'] = build('Engineering', engineering_pairs(args.engineering), 25,
        Path(args.engineering).name, 'Sheet1', 'B2:C11, mock percentage → real external percentage', 'Not supplied')
    output = dict(schemaVersion=1, method='100 / (1 + A × exp(−k × mockPercentage)); fixed 0–100 asymptotes, k ≥ 0, least squares',
        validation='Leave-one-out cross-validation, refitting for every omitted pair. Errors are percentage points, not prediction intervals. No independent future cohort validation.',
        sourceNotes='Separate subjects; duplicate scaling-check sheets excluded. Only aggregate coefficients and metrics are published. These are school mock conversions, independent of the selected QTAC scaling year.',
        subjects=subjects)
    Path('dist/mock-models.json').write_text(json.dumps(output, indent=2, ensure_ascii=False, allow_nan=False)+'\n', encoding='utf-8')
    for name, s in subjects.items():
        print(name, s['n'], s['status'], round(s.get('cvMAE', 0), 2))

if __name__ == '__main__':
    main()

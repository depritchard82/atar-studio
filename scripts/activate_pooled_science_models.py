"""Activate aggregate-only pooled science models from the three source workbooks."""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from openpyxl import load_workbook
from evaluate_all_science_cohorts import original_pairs, SHEETS
from evaluate_science_cohorts import fit
from validate_science_cohorts import extract

ROOT = Path(__file__).resolve().parent.parent


def predict(x, parameters):
    _, a, k = parameters
    return 100 / (1 + a * np.exp(-k * x))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('original')
    parser.add_argument('results_2024')
    parser.add_argument('results_2025')
    args = parser.parse_args()
    model_path = ROOT / 'dist/mock-models.json'
    catalog = json.loads(model_path.read_text())
    comparison = json.loads((ROOT / 'dist/science-all-cohorts.json').read_text())
    workbook = load_workbook(args.original, read_only=True, data_only=True)
    try:
        for subject in SHEETS:
            older = original_pairs(workbook, subject)
            year24 = extract(args.results_2024, 2024, subject)
            year25 = extract(args.results_2025, 2025, subject)
            pairs = older + year24 + year25
            values = np.asarray(pairs, dtype=float)
            x, y = values[:, 0], values[:, 1]
            model = catalog['subjects'][subject]
            if len(older) != comparison['subjects'][subject]['counts']['earlier']:
                raise ValueError(f'{subject}: original cohort count changed')
            parameters = fit(pairs)
            expected = comparison['subjects'][subject]['pooledParameters']
            if not np.allclose(parameters, expected, rtol=1e-6):
                raise ValueError(f'{subject}: pooled coefficients differ from reviewed candidate')
            residual = predict(x, parameters) - y
            cv_errors = []
            baseline_errors = []
            for i in range(len(pairs)):
                keep = np.arange(len(pairs)) != i
                cv_errors.append(float(predict(x[i], fit(values[keep])) - y[i]))
                baseline_errors.append(float(y[keep].mean() - y[i]))
            recent_errors = np.abs(predict(np.asarray(year24 + year25)[:, 0], parameters) - np.asarray(year24 + year25)[:, 1])
            model.update(
                n=len(pairs), parameters=parameters,
                mockRange=[float(x.min()), float(x.max())],
                source='scaling comparisons - 2023.xlsx; 12 Science Results 2024.xlsx; 12 Science Results 2025.xlsx',
                sheet='Biology / Chem / Physics source sheets',
                mapping='Paired mock and real external weighted marks out of 50, converted to percentages',
                cohort='Earlier workbook (mostly completion year 2022), 2024 and 2025',
                status='Provisional',
                cvMAE=float(np.mean(np.abs(cv_errors))),
                cvRMSE=float(np.sqrt(np.mean(np.square(cv_errors)))),
                baselineRMSE=float(np.sqrt(np.mean(np.square(baseline_errors)))),
                r2=float(1 - np.sum(residual ** 2) / np.sum((y-y.mean()) ** 2)),
                pooledTraining={
                    'earlier': comparison['subjects'][subject]['pooledInSample']['earlier'],
                    '2024': comparison['subjects'][subject]['pooledInSample']['2024'],
                    '2025': comparison['subjects'][subject]['pooledInSample']['2025'],
                },
                historicalError80={
                    'n': len(year24) + len(year25),
                    'absoluteErrorPP': round(float(np.quantile(recent_errors, .8, method='higher')), 2),
                    'mockRange': [round(float(np.asarray(year24 + year25)[:, 0].min()), 2), round(float(np.asarray(year24 + year25)[:, 0].max()), 2)],
                    'cohorts': ['2024', '2025'],
                    'basis': 'in-sample training results',
                },
                warnings=['Both later cohorts are included in this fit. Errors calculated on those results may understate future exam error.',
                          'Year-held-out comparisons did not consistently beat the previous curve; Chemistry varies substantially by cohort.'],
            )
            model.pop('independentValidation', None)
            model.pop('validationNote', None)
    finally:
        workbook.close()
    catalog['validation'] = 'Pooled science curves use the earlier, 2024 and 2025 paired results. Leave-one-student-out errors refit per omission, but share the cohort and are not future-year validation. Other subjects retain their original validation.'
    catalog['sourceNotes'] = 'Separate subjects; duplicate scaling-check sheets excluded. Biology, Chemistry and Physics combine earlier, 2024 and 2025 pairs once each. Only aggregate coefficients and metrics are published. These school mock conversions are independent of the selected QTAC scaling year.'
    model_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    for subject in SHEETS:
        model = catalog['subjects'][subject]
        print(subject, model['n'], 'LOO RMSE', round(model['cvRMSE'], 2))


if __name__ == '__main__':
    main()

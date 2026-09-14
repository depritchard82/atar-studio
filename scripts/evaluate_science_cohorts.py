"""Compare science mock curves across cohorts without exporting student records.

Run with the 2024 and 2025 science results workbooks. Produces only summary
statistics and candidate coefficients; it does not update the live models.
"""
import argparse
import json
from pathlib import Path

import numpy as np

from validate_science_cohorts import extract


ROOT = Path(__file__).resolve().parent.parent


def predict(x, parameters):
    L, A, k = parameters
    return L / (1 + A * np.exp(-k * x))


def fit(pairs):
    """Damped Gauss-Newton for the established fixed-asymptote logistic form."""
    x, y = np.asarray(pairs, dtype=float).T
    best = None
    for q0 in (-2.0, 0.0, 1.0, 2.0, 4.0):
        for k0 in (0.005, 0.02, 0.04, 0.08):
            q, k, damping = q0, k0, 0.001
            for _ in range(250):
                value = 100 / (1 + np.exp(q - k * x))
                residual = value - y
                derivative = value * (1 - value / 100)
                jacobian = np.column_stack((-derivative, derivative * x))
                step = np.linalg.solve(jacobian.T @ jacobian + damping * np.eye(2), -jacobian.T @ residual)
                next_q = np.clip(q + step[0], -15, 15)
                next_k = np.clip(k + step[1], 0, 1)
                next_value = 100 / (1 + np.exp(next_q - next_k * x))
                if np.sum((next_value - y) ** 2) < np.sum(residual ** 2):
                    if max(abs(next_q - q), abs(next_k - k)) < 1e-10:
                        break
                    q, k = next_q, next_k
                    damping = max(1e-8, damping / 2)
                else:
                    damping = min(1e8, damping * 10)
            candidate = (float(np.sum((100 / (1 + np.exp(q - k * x)) - y) ** 2)), [100, float(np.exp(q)), float(k)])
            if best is None or candidate[0] < best[0]:
                best = candidate
    return best[1]


def measure(pairs, parameters):
    x, y = np.asarray(pairs, dtype=float).T
    errors = predict(x, parameters) - y
    return {
        'n': len(errors),
        'mae': round(float(np.mean(np.abs(errors))), 2),
        'rmse': round(float(np.sqrt(np.mean(errors ** 2))), 2),
        'bias': round(float(np.mean(errors)), 2),
    }


def mean_baseline(training_pairs, test_pairs):
    """Predict every later external result from the earlier cohort's mean."""
    expected = float(np.mean(np.asarray(training_pairs, dtype=float)[:, 1]))
    actual = np.asarray(test_pairs, dtype=float)[:, 1]
    errors = expected - actual
    return {
        'n': len(errors),
        'mae': round(float(np.mean(np.abs(errors))), 2),
        'rmse': round(float(np.sqrt(np.mean(errors ** 2))), 2),
        'bias': round(float(np.mean(errors)), 2),
    }


def bias_shift_interval(pairs_2024, pairs_2025, parameters):
    first = np.asarray(pairs_2024, dtype=float)
    second = np.asarray(pairs_2025, dtype=float)
    e24 = predict(first[:, 0], parameters) - first[:, 1]
    e25 = predict(second[:, 0], parameters) - second[:, 1]
    generator = np.random.default_rng(20260914)
    shifts = generator.choice(e25, (10000, len(e25)), replace=True).mean(axis=1) - generator.choice(e24, (10000, len(e24)), replace=True).mean(axis=1)
    return [round(float(v), 2) for v in np.quantile(shifts, [0.025, 0.975])]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('results_2024')
    parser.add_argument('results_2025')
    args = parser.parse_args()
    catalog = json.loads((ROOT / 'dist/mock-models.json').read_text())['subjects']
    result = {'purpose': 'Cross-cohort model comparison; no student records or pairs included', 'subjects': {}}
    for name in ('Biology', 'Chemistry', 'Physics'):
        pairs24 = extract(args.results_2024, 2024, name)
        pairs25 = extract(args.results_2025, 2025, name)
        old = catalog[name]['parameters']
        fitted24 = fit(pairs24)
        fitted25 = fit(pairs25)
        combined = fit(pairs24 + pairs25)
        result['subjects'][name] = {
            'n2024': len(pairs24), 'n2025': len(pairs25),
            'existing': {'parameters': old, 'test2024': measure(pairs24, old), 'test2025': measure(pairs25, old)},
            'fit2024_test2025': measure(pairs25, fitted24),
            'mean2024_test2025': mean_baseline(pairs24, pairs25),
            'fit2025_test2024': measure(pairs24, fitted25),
            'combined_candidate': {'parameters': combined, 'training2024': measure(pairs24, combined), 'training2025': measure(pairs25, combined)},
            'existing_bias_shift_2025_minus_2024': round(measure(pairs25, old)['bias'] - measure(pairs24, old)['bias'], 2),
            'bias_shift_bootstrap_95pct': bias_shift_interval(pairs24, pairs25, old),
        }
    output = ROOT / 'analysis/science-cohorts-2024-2025.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n')
    comparison = {
        'description': 'Aggregate-only 2025 test results; no student records or score pairs',
        'subjects': {
            name: {
                'n2024': item['n2024'],
                'n2025': item['n2025'],
                'current': item['existing']['test2025'],
                'fit2024': item['fit2024_test2025'],
                'mean2024': item['mean2024_test2025'],
                'current2024Bias': item['existing']['test2024']['bias'],
                'current2025Bias': item['existing']['test2025']['bias'],
            }
            for name, item in result['subjects'].items()
        },
    }
    (ROOT / 'dist/science-comparison.json').write_text(json.dumps(comparison, indent=2) + '\n')
    print(output)


if __name__ == '__main__':
    main()

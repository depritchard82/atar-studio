# Science mock-to-external cohort comparison

This analysis uses paired mock and actual external results from the supplied 2024 and 2025 Biology, Chemistry and Physics workbooks. The 2025 mock workbook and ZIP repeat those records and were not added again. No student identifiers or individual score pairs are stored here. Scores are normalised to percentages before comparison. For 2025 Biology, the unrounded mock total out of 84 is used instead of the rounded displayed Mock/50 column. Percentage normalisation handles different mark maxima; it does **not** make different mock papers equally difficult.

The existing live curves were fitted to earlier data and did not use either of these cohorts. Error is predicted external percentage minus actual external percentage. MAE and RMSE are in percentage points.

| Subject | 2024 pairs | 2025 pairs | Existing curve 2024 MAE / RMSE | Existing curve 2025 MAE / RMSE | Curve fitted on 2024, tested on 2025 MAE / RMSE |
|---|---:|---:|---:|---:|---:|
| Biology | 20 | 24 | 6.03 / 7.91 | 2.76 / 3.64 | 2.79 / 3.69 |
| Chemistry | 38 | 48 | 6.43 / 8.36 | 5.86 / 7.26 | 7.21 / 8.92 |
| Physics | 32 | 35 | 4.84 / 5.80 | 3.12 / 3.80 | 3.15 / 4.06 |

A simple benchmark predicts every 2025 student's external percentage from the 2024 cohort's mean external percentage, ignoring their mock score. Its 2025 MAE / RMSE is **10.59 / 12.68** for Biology, **7.59 / 9.45** for Chemistry, and **6.73 / 7.76** for Physics. The live curve beats that benchmark in all three subjects. The site shows this comparison using aggregate metrics only, generated in `dist/science-comparison.json`.

The existing curve is as good as or slightly better than the 2024-fitted curve on the independent 2025 cohort for all three subjects. The 2025-fitted curves also do not improve on the existing curves when tested on 2024. Pooling 2024 and 2025 slightly lowers error on those same records, but that is training performance, not evidence of better future predictions. The existing live coefficients therefore remain unchanged.

Chemistry needs particular caution. The existing curve's average signed error was **−5.28 points in 2024** and **+4.18 points in 2025**, a **9.46-point difference**. A cohort bootstrap gives an approximate 95% interval of **6.85 to 12.17 points** for that difference. The direction change remains in the overlapping 30–80% mock range: mean errors were −2.99 points on 18 records in 2024 and +5.43 points on 32 records in 2025. The two mock exams and external exams may differ in difficulty or marking; these files alone cannot identify the cause. Combining the years into one Chemistry curve would hide a material cohort difference.

Biology and Physics show smaller changes in average signed error across years (−0.28 and −0.47 points, respectively). Their combined candidates are plausible for future evaluation, but these two years provide no untouched cohort on which to test a model fitted to both. A new cohort should be reserved before replacing the live coefficients.

Assessment structure matters. The 2024 Chemistry workbook records mock and actual external contributions out of 50. The 2025 workbook calculates Mock/50 from a mock total out of 95 and records actual external out of 50. The original model source describes weighted mock and external columns out of 50 for a likely 2022 cohort, but its raw source workbook is unavailable here. QCAA's [2024 Chemistry subject report](https://www.qcaa.qld.edu.au/downloads/senior-qce/sciences/snr_chemistry_24_subj_rpt.pdf) and [2025 report](https://www.qcaa.qld.edu.au/downloads/senior-qce/sciences/snr_chemistry_25_subj_rpt.pdf) both assign 50% to the external examination. The published 2024 examination sections carried 20, 38 and 52 raw marks; 2025 carried 20, 35 and 55. QCAA says its [Chemistry 2025 syllabus](https://www.qcaa.qld.edu.au/senior/senior-subjects/syllabuses/sciences/chemistry) is for students completing in 2026 or later. Those facts do not establish that the school mock papers were comparable across cohorts or explain the observed Chemistry shift.

The original training pairs are not stored in this repository, so this analysis cannot literally append the 2024–2025 records to the original fitting dataset. `scripts/evaluate_science_cohorts.py` reproduces the aggregate comparison from the locally held workbooks. The adjacent JSON contains only summary metrics and candidate coefficients.

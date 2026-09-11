# ATAR Studio

Subject Rankings computes unweighted means of fitted scaled scores at integer raw scores: subscore 0–99, topscore 90–99, ascore 80–99, bscore 60–79 and cscore 40–59. Raw 100 is excluded. Every column is sortable and the current order exports to CSV with the selected year and full numeric precision. Fitted values are not clipped; bands containing values outside 0–100 are flagged. Rankings are curve summaries, not observed student averages or ATAR predictions. Run `node scripts/validate_rankings.mjs` to verify band calculations for all datasets.

[Open the website](https://depritchard82.github.io/atar-studio/)

Changes pushed to main are validated and published by the GitHub Pages workflow. Only the dist folder is served; student source workbooks are excluded.

Browser-only replacement for the original ATAR app. Serve `dist` with any static host. Student files stay in memory on the user's device; there is no upload endpoint, database, analytics or persistence. SheetJS 0.20.3 is vendored locally: https://docs.sheetjs.com/docs/getting-started/installation/standalone/

## Model provenance

The four CSVs in `data` were retrieved from `/home/Dpr/` in PythonAnywhere. Labels follow `atar_gui_app6.py`: test.csv=2020, test2.csv=2021, 2023scaling.csv=2023, 2024scaling.csv=2024. These labels have not been independently verified. No student records or credentials are included.

`scripts/fit_models.py` reproduces desktop curve fitting with NumPy and SciPy, seed 3, identical initial bounds and maxfev 20000. `dist/models.json` stores coefficients, source points, fit error and CSV SHA256. Python is used only to prepare datasets, never to serve predictions.

The original fixed piecewise aggregate formula is retained for all years. This is not an official ATAR or eligibility model. The browser requires at least five distinct subjects and uses the best five. It rejects invalid raw scores and fitted results outside 0–100 instead of clipping them. Year changes invalidate displayed results.

## 2025 update

The 2025 dataset contains all 49 numeric datasets published in QTAC ATAR Report 2025 tables 6 and 7 (report pages 8–12): 46 General/General Extension and three Senior External Examination subjects. Extracted with `scripts/extract_2025.py PDF_PATH`, with page/code metadata and PDF hash in `data/2025-source.json`. The actual report is linked in the site. Chinese (Senior External Examination) is kept distinct from General Chinese. Korean and Vietnamese retain their existing names and are identified as Senior External Examination in the source note. Withheld subjects are omitted rather than substituted with an older year. Applied and VET data are outside this model's existing scope.

The 2025 dataset is now selected by default. Only subject scaling has been updated; the original aggregate-to-ATAR approximation is retained. The 2025 pairs were checked against rendered report pages and extraction boundaries, including repeated percentile raw scores. Earlier datasets remain unchanged.

## Excel processing

Data needs Name, Subject, IA1/IA2/IA3/MEA or FIA1/FIA2/FIA3/FEA fallbacks. Names group students, so use distinct identifiers where names repeat. Optional mock adjustment requires MEAConversions with Subject,m,c, and retains the original 50-point cap. Subjects without conversions are reported and unchanged. Exports contain predictions, breakdown and model notes. Limits: 10 MB and 10,000 subject rows.

Run `python scripts/preview.py` for local serving with correct JavaScript MIME types on Windows. Run `node scripts/validate.mjs` for maths, invalid input, and Excel roundtrip checks. Optional WebMCP tool predict_individual_atar is feature-detected.

## Mock to external models

The Mock → External tab contains ten enabled subject-specific logistic conversions and two unavailable subjects. They use 221 pairs across twelve subjects (211 in the comparison workbook, ten Engineering pairs). English and Drama are experimental: their leave-one-out RMSE did not improve on the cohort-mean baseline. Accounting has only two pairs; English and Literature Extension fits an effectively flat curve, so neither is enabled. All other models remain provisional, with sample size, observed range, error and source assumptions visible.

Inputs are mock percentages. Outputs are predicted percentages and weighted external contributions out of 25 or 50. Optional internal assessment totals yield raw subject totals that can be copied into Individual prediction. Whole-percentage rounding defaults on to reproduce the Engineering spreadsheet convention; external contributions retain decimals. Predictions outside the observed range carry an extrapolation warning. The spreadsheet prediction tab retains its separate legacy linear MEAConversions method; the new logistic models are not automatically applied there.

`python scripts/fit_mock_models.py COMPARISON_XLSX ENGINEERING_ODS` regenerates `dist/mock-models.json` using NumPy, SciPy and openpyxl. Keep raw files outside the checkout. The script reads the known populated cohort tables within rows 1–250, excludes duplicate scaling-check sheets, fits separate monotone two-parameter logistic curves with fixed 0–100 asymptotes and refits each leave-one-out fold. Only aggregate parameters and metrics are exported; no names or individual pairs. Column mappings, normalisation and cohort-year caveats are recorded per subject. Unlabelled column interpretations remain provisional. These school models are independent of the chosen QTAC dataset year and are not yet validated against a new cohort.

Run `node scripts/validate_mock.mjs` for conversion, boundary, assessment-weight, rounding and regression checks. For new source layouts or cohorts, revise the extraction mapping rather than silently reusing the current row window. Keep a future cohort held out when evaluating upgrades.

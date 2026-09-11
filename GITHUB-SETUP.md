# GitHub setup

This package contains ATAR Studio and a GitHub Pages deployment workflow.
Create a repository named atar-studio and upload the extracted contents,
preserving the dist, scripts, data and .github folders, to its main branch.
Set Settings > Pages > Build and deployment > Source to GitHub Actions.
Run the Deploy ATAR Studio to GitHub Pages workflow after enabling Pages.

The workflow validates the calculations and publishes only dist. It does not
upload student spreadsheets. Source workbooks with student records are not
included. Do not add them to the repository.

GitHub Free supports Pages from public repositories; private repositories need
a qualifying paid plan. Repository visibility and website visibility are
separate. The Pages website will normally be publicly accessible.

Reference: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

Repository: https://github.com/depritchard82/atar-studio

# Walkthrough - GitHub Pages Migration (Zero-Redundancy Edition)

We have successfully migrated the OncoPredict AI Breast Cancer Diagnostic Assistant from a Python/Flask-based web application to a pure client-side static website. In this latest refinement, we removed all duplicate assets from the repository root. The static site is now compiled and packaged dynamically inside the GitHub Actions runner.

---

## Clean Architecture (Zero-Redundancy)

We removed the redundant static copies from the repository root. The single source of truth for the project resides inside the [BreastCancerPrediction](file:///d:/Web%20designs/BreastCancerPrediction/BreastCancerPrediction) subdirectory:
- [templates/index.html](file:///d:/Web%20designs/BreastCancerPrediction/BreastCancerPrediction/templates/index.html) - Main dashboard structure (uses relative assets).
- [static/css/style.css](file:///d:/Web%20designs/BreastCancerPrediction/BreastCancerPrediction/static/css/style.css) - Styling stylesheet.
- [static/js/main.js](file:///d:/Web%20designs/BreastCancerPrediction/BreastCancerPrediction/static/js/main.js) - Complete script loaded with the recursive prediction engine and UI updates.
- [static/metadata.json](file:///d:/Web%20designs/BreastCancerPrediction/BreastCancerPrediction/static/metadata.json) - Dataset statistics generated during training.
- [static/data/model_data.json](file:///d:/Web%20designs/BreastCancerPrediction/BreastCancerPrediction/static/data/model_data.json) - Exported decision tree weights and structures.

---

## Automated CI/CD Pipeline

The GitHub Actions workflow in [.github/workflows/deploy.yml](file:///d:/Web%20designs/BreastCancerPrediction/.github/workflows/deploy.yml) automatically compiles the site on push:
1. **Model Regeneration (CI)**: Runs `train_model.py` and `export_model.py` to compile the newest metadata and decision tree JSON objects.
2. **Parity Check**: Runs validation test checks. If there is a prediction discrepancy, the deployment is aborted.
3. **Bundle Compilation (CD)**:
   - Creates a temporary `build/` workspace directory in the runner.
   - Copies `templates/index.html` to `build/index.html`.
   - Copies the entire `static/` directory (containing JS, CSS, and models) to `build/static/`.
4. **Deploy**: Uploads and deploys the compiled `build/` folder directly to GitHub Pages.

---

## Verification Results

We verified that the updated model paths (`static/metadata.json` and `static/data/model_data.json`) resolve correctly:
* **Benign Default Case**: Passed (discrepancy `0.00e+00` compared to scikit-learn probability).
* **Malignant Skewed Case**: Passed (discrepancy `0.00e+00` compared to scikit-learn probability).

---

## How to Deploy with CI/CD

Follow these steps to deploy and activate the pipeline:

1. **Commit and Push to GitHub**:
   Add and commit files, and push to your remote repository branch:
   ```bash
   git add .
   git commit -m "Migrate to static Pages deployment via compiled build folder in CI/CD"
   git push origin main # Change branch name if different
   ```

2. **Enable GitHub Pages via Actions**:
   - Go to your repository page on GitHub.
   - Click on the **Settings** tab.
   - In the left sidebar, click on **Pages** (under the "Code and automation" section).
   - Under **Build and deployment** -> **Source**, select **GitHub Actions** from the dropdown menu.

3. **Check Deployments**:
   - Go to the **Actions** tab in your repository.
   - Once the workflow completes, the live link will be printed directly in the job summary details!

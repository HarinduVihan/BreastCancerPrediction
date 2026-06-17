# Host Breast Cancer Prediction App on GitHub Pages

This plan outlines how to host the OncoPredict AI Breast Cancer Diagnostic Assistant on GitHub Pages. Since GitHub Pages only hosts static files, we will convert the Flask backend to run entirely client-side. We will write a Python script to export the trained Random Forest model's decision trees into a JSON format, and write a client-side tree traversal engine in JavaScript to make real-time predictions directly in the browser.

---

## User Review Required

> [!IMPORTANT]
> - **Pure Client-Side Inference**: The prediction model (Random Forest Classifier) will run directly in the user's browser in JavaScript. This eliminates the need for any Python server (like Flask) to be running on the hosting platform, allowing free hosting on GitHub Pages.
> - **Repository Restructuring**: We will copy the frontend assets (`index.html`, `style.css`, `main.js`) and metadata files (`metadata.json`) to the root of the repository. This allows GitHub Pages to serve the site directly from the repository's root.
> - **Inference Fidelity**: The Javascript implementation will exactly replicate the prediction logic of the scikit-learn Random Forest model (140 estimators) and the feature contribution calculations. We will verify that predictions match the python model.

---

## Proposed Changes

We will perform the following steps:
1. **Model Parameter Extraction**: Write a Python script to deserialize the Random Forest model and save the trees and feature importances to JSON.
2. **Move Frontend Assets to Root**: Establish a static directory structure at the root of the repository (`/index.html`, `/css/`, `/js/`, `/data/`).
3. **Rewrite JavaScript Engine**: Update the JavaScript code to fetch local JSON configuration files and run the model prediction locally.

---

### Component-Level Walkthrough

#### [NEW] [export_model.py](file:///d:/Web%20designs/BreastCancerPrediction/BreastCancerPrediction/export_model.py)
A python utility script that will:
- Load `breast_cancer_model.joblib`.
- Extract each of the 140 estimators (Decision Trees) from the Random Forest.
- Recursively extract tree nodes (splits, thresholds, features, and leaf probabilities).
- Save the structured model (trees and feature importances) to `model_data.json`.

#### [NEW] [index.html](file:///d:/Web%20designs/BreastCancerPrediction/index.html)
The static entry point at the repository root. This is a copy of `templates/index.html` with updated paths:
- CSS reference: `css/style.css`
- JS reference: `js/main.js`

#### [NEW] [css/style.css](file:///d:/Web%20designs/BreastCancerPrediction/css/style.css)
The stylesheet copied from `static/css/style.css` to the repository root.

#### [NEW] [metadata.json](file:///d:/Web%20designs/BreastCancerPrediction/metadata.json)
The feature statistical metadata copied to the root for client-side loading.

#### [NEW] [data/model_data.json](file:///d:/Web%20designs/BreastCancerPrediction/data/model_data.json)
The exported model trees and feature importances.

#### [NEW] [js/main.js](file:///d:/Web%20designs/BreastCancerPrediction/js/main.js)
The rewritten Javascript controller that will:
- Fetch `metadata.json` and `data/model_data.json` locally.
- Implement `predictForest(forest, features)` traversing each decision tree.
- Compute the top contributing features and classification confidence (reproducing `app.py` logic).
- Render results dynamically without server requests.

---

## Verification Plan

### Automated Verification
- Write a test function inside `export_model.py` to compare predictions made by the Python sklearn pipeline with predictions made by a mock Python implementation using the exported JSON structure. This ensures perfect prediction parity.

### Manual Verification
1. Open the local `index.html` using a simple web server (like python's `http.server` or VS Code Live Server) to verify features load correctly.
2. Input low values (benign indicators) and verify the dashboard identifies it as "Benign" with appropriate confidence.
3. Input high values (malignant indicators) and verify it identifies it as "Malignant" with high confidence.
4. Verify the "Print Clinical Summary" still functions correctly.
5. Deploy to GitHub Pages and confirm all assets load correctly and prediction logic is functional.

# Implementation Plan - OncoPredict: Advanced Breast Cancer Diagnostic Assistant

This plan outlines the design and implementation of a professional web application for predicting breast cancer diagnosis (benign vs. malignant) from digitized cell nuclei features. We will study the models trained in the `BreastCancerPrediction` directory, choose the optimal one, train it, and package it with a sleek, modern, glassmorphic web dashboard powered by a Flask backend.

---

## Model Selection & Data Study

Our analysis of the notebooks inside the `BreastCancerPrediction` directory yields the following findings:

1. **Model Choices**: The notebooks explore Logistic Regression, XGBoost, and Random Forest models.
2. **Chosen Model**: As documented in `README.md`, the **Random Forest Classifier with 7-fold Cross-Validation** (with `n_estimators=140` and a `SimpleImputer`) was selected as the optimal final model. It achieves an outstanding **97.37% accuracy** and the lowest Mean Absolute Error (MAE = **0.02628**), showing superior generalizability and robustness against overfitting compared to the default models.
3. **Features Used**: The model drops 7 columns: `['diagnosis', 'id', 'concavity_se', 'fractal_dimension_se', 'smoothness_se', 'texture_se', 'Unnamed: 32']`, leaving **26 active nuclear features** divided into Mean values, Standard Errors (SE), and Worst (Maximum) values.
4. **Diagnosis Target**: benign (`B`) is mapped to `0` and malignant (`M`) is mapped to `1`.

---

## User Review Required

> [!IMPORTANT]
>
> - **Dependency Installation**: We need to install `Flask` and `Flask-CORS` (optional, for developer flexibility) in the virtual environment to serve the web application and run the inference API.
> - **Model Pre-training**: We will write a lightweight training script (`train_model.py`) that uses the existing virtual environment to train the pipeline and serialize it as a `.joblib` file alongside key statistical metadata (means, min/max values) extracted from `Cancer_Data.csv`.
> - **Feature Layout**: We will group the 26 feature inputs into 3 tabbed categories in the UI ("Mean Features", "Standard Error Features", and "Worst Features") to maintain an organized, premium user experience.

---

## Proposed Changes

We will group our modifications into three main areas:

1. **Model Training & Serialization** (Python script & joblib output)
2. **Backend API Development** (Python Flask server)
3. **Frontend Dashboard Development** (HTML, CSS, and JS static assets)

---

### 1. Model Training & Serialization Component

#### [NEW] [train_model.py](file:///d:/HNDSE/ML/CW/ML_Course_Work/BreastCancerPrediction/train_model.py)

This script will:

- Load `Cancer_Data.csv`.
- Prepare features `X` and label `y` exactly matching the cross-validation notebook logic.
- Compute dataset-wide statistics (mean, min, max, std) for each feature and save them as a JSON file (`metadata.json`). This dynamically drives the UI default values, limits, and interactive comparisons.
- Train the `Pipeline` combining a `SimpleImputer(strategy='constant', fill_value=0, keep_empty_features=True)` and a `RandomForestClassifier(n_estimators=140, random_state=0)`.
- Save the trained pipeline as `breast_cancer_model.joblib` in the workspace.

---

### 2. Backend API Component

#### [NEW] [app.py](file:///d:/HNDSE/ML/CW/ML_Course_Work/BreastCancerPrediction/app.py)

A lightweight Flask application serving:

- **`GET /`**: Renders the frontend web dashboard.
- **`GET /api/features`**: Returns the list of 26 features along with their statistics (means, ranges) loaded from `metadata.json`.
- **`POST /api/predict`**: Accepts a JSON body of 26 input values, runs them through the serialized pipeline, and returns:
  - Diagnosis label (`Benign` or `Malignant`)
  - Prediction probability (confidence percentage)
  - Key contributing factors (comparison against average benign/malignant cells).

---

### 3. Frontend Web Dashboard Component

We will create a stunning, responsive clinical analytics panel with a sleek glassmorphic theme.

#### [NEW] [templates/index.html](file:///d:/HNDSE/ML/CW/ML_Course_Work/BreastCancerPrediction/templates/index.html)

Provides the structure for OncoPredict AI:

- A prominent header displaying clinical assistant credentials.
- A card layout splitting inputs and diagnostic reports.
- Three feature categories organized as interactive navigation tabs.
- Form inputs dynamically populated based on standard features.
- Result indicators (outcome cards, progress confidence ring, radar/bar comparison charts, clinical recommendation alerts).
- Button to download analysis report.

#### [NEW] [static/css/style.css](file:///d:/HNDSE/ML/CW/ML_Course_Work/BreastCancerPrediction/static/css/style.css)

Provides premium modern styling:

- Dark slate/navy luxury color system with neon-teal and warm rose-pink gradients representing Benign and Malignant statuses.
- Glassmorphic panels with delicate translucent white borders, frosted-glass backdrops (`backdrop-filter`), and elegant box shadows.
- Inter Font family with clean readable typography.
- Smooth transitions, active slider tracks, custom progress circles, hover scale states, and focus glowing highlights.

#### [NEW] [static/js/main.js](file:///d:/HNDSE/ML/CW/ML_Course_Work/BreastCancerPrediction/static/js/main.js)

Provides frontend interactive behavior:

- Dynamically loads feature properties from the backend API.
- Synchronizes slider drag values and numerical text inputs in real-time.
- Submits form parameters via `fetch` to `/api/predict` with a clean loading overlay.
- Computes relative comparisons against average datasets and renders responsive charts or gauges.
- Renders final predictions with appropriate colors and formatted texts.
- Generates clean clinical reports as printable pages or direct PDF downloads.

---

## Verification Plan

### Automated/Unit Verification

1. **Python Training**: Execute `train_model.py` and verify `breast_cancer_model.joblib` and `metadata.json` are created successfully.
2. **Model Accuracy Check**: Write a short test in `train_model.py` to output training validation score and verify it meets the expected 97%+ accuracy.
3. **API Integrity**: Run a test request against Flask's `/api/predict` endpoint using mock inputs and verify the JSON response contains the diagnosis and probabilities.

### Manual & UI Verification

1. **Web Launch**: Boot Flask server on `localhost:5000` (or another port) and visit it in the browser.
2. **Interactive Elements**: Verify tab switching is smooth, sliders and text boxes synchronise perfectly, and inputs validate to stay within valid min/max ranges.
3. **Mock Diagnostics**:
   - Input benign-skewed features (low radius, low concavity) and verify the output is a teal-colored card showing "Benign (Low Risk)" with high confidence.
   - Input malignant-skewed features (high radius, high perimeter, high area, high concavity, high concave points) and verify the output changes to a glowing magenta card showing "Malignant (High Risk)" with its respective clinical recommendations.
4. **Report Download**: Press the report download button and verify it generates a printable diagnostic slip.

## How to Run the Project Manually

### 1. Navigate to the project directory

```powershell
cd "d:\HNDSE\ML\CW\ML_Course_Work\BreastCancerPrediction"
```

### 2. Activate the local virtual environment

- On PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

- On CMD:

```powershell
.\.venv\Scripts\activate.bat
```

### 3. Run the Flask server

```powershell
python app.py
```

## How to Stop the Project

- Standard way: Go to the terminal window where the server is running and press Ctrl + C.
- Forced cleanup (if the terminal is closed but the port is still locked in the background on Windows): Run this command in PowerShell to instantly locate and kill the process using port 5000:

```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -Force
```

## To run this project on another computer after doing a git pull, follow these steps:

## 1. Requirements & Setup

Make sure Python is installed on the target machine, then run these commands in the terminal inside the project directory:

### 1. Navigate to the project directory

```powershell
cd "BreastCancerPrediction"
```

### 2. Create a clean virtual environment

```powershell
python -m venv .venv
```

### 3. Activate the virtual environment

- On Windows (PowerShell):

```powershell
.\.venv\Scripts\Activate.ps1
```

- On Windows (CMD):

```powershell
.\.venv\Scripts\activate.bat
```

- On macOS / Linux:

```powershell
source .venv/bin/activate
```

### 4. Install dependencies using the new requirements.txt file

```powershell
pip install -r requirements.txt
```

## 2. Train the Model & Generate Metadata

Because model binaries (.joblib) and statistical tables (metadata.json) are generated from the dataset, run the training script to build the model files on the new computer:

```powershell
python train_model.py
```

This will train the Random Forest ensemble and generate
breast_cancer_model.joblib and metadata.json.

## 3. Run the App

With the virtual environment active and the model generated, boot up the Flask server:

```powershell
python app.py
```

You can now open http://127.0.0.1:5000 in your web browser.

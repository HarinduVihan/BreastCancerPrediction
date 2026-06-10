import os
import json
import numpy as np
import pandas as pd
import joblib
from flask import Flask, request, jsonify, render_template

app = Flask(__name__, template_folder='templates', static_folder='static', static_url_path='/static')

# Load the model and metadata on startup
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(CURRENT_DIR, 'breast_cancer_model.joblib')
METADATA_PATH = os.path.join(CURRENT_DIR, 'metadata.json')

model_pipeline = None
metadata = None
feature_importances = {}

if os.path.exists(MODEL_PATH) and os.path.exists(METADATA_PATH):
    try:
        model_pipeline = joblib.load(MODEL_PATH)
        with open(METADATA_PATH, 'r') as f:
            metadata = json.load(f)
        
        # Extract feature importances if available in RandomForest
        clf = model_pipeline.named_steps['model']
        feature_names = [f['name'] for f in metadata['features']]
        importances = clf.feature_importances_
        feature_importances = dict(zip(feature_names, importances))
        print("Model and metadata loaded successfully.")
    except Exception as e:
        print(f"Error loading model artifacts: {e}")
else:
    print("Warning: Model artifacts not found yet. Run train_model.py first.")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/features', methods=['GET'])
def get_features():
    if not metadata:
        return jsonify({"success": False, "error": "Metadata not loaded"}), 500
    return jsonify({"success": True, "data": metadata})

@app.route('/api/predict', methods=['POST'])
def predict():
    if not model_pipeline or not metadata:
        return jsonify({"success": False, "error": "Model or metadata not loaded on server"}), 500
        
    try:
        input_data = request.get_json()
        if not input_data:
            return jsonify({"success": False, "error": "No JSON payload provided"}), 400
            
        feature_names = [f['name'] for f in metadata['features']]
        
        # Verify all features are provided
        missing_features = [f for f in feature_names if f not in input_data]
        if missing_features:
            return jsonify({
                "success": False, 
                "error": f"Missing feature parameters: {missing_features}"
            }), 400
            
        # Parse inputs into a pandas DataFrame representing a single row
        # (Using DataFrame preserves column names so the Pipeline works properly)
        row_dict = {feat: [float(input_data[feat])] for feat in feature_names}
        input_df = pd.DataFrame(row_dict)
        
        # Run prediction and get probabilities
        prediction = int(model_pipeline.predict(input_df)[0])
        probabilities = model_pipeline.predict_proba(input_df)[0]
        
        # Probability for the predicted class
        confidence = float(probabilities[prediction] * 100)
        
        # Class names mapping
        class_name = "Malignant" if prediction == 1 else "Benign"
        
        # Clinical recommendation
        if prediction == 1:
            recommendation = (
                "Critical Alert: The morphological analysis indicates a high probability of malignancy (Malignant tumor). "
                "Immediate histopathological correlation (biopsy) and clinical consultation are strongly advised."
            )
        else:
            recommendation = (
                "Normal/Low Risk: The morphological characteristics indicate a benign cellular state. "
                "Continue routine preventative screenings as standard caution."
            )
            
        # Compute top contributing features for this specific prediction
        contributions = []
        for feat in metadata['features']:
            name = feat['name']
            val = float(input_data[name])
            b_mean = feat['benign_mean']
            m_mean = feat['malignant_mean']
            importance = feature_importances.get(name, 0.0)
            
            # Simple contribution metric: 
            # How close is the input value to the malignant average relative to the benign average,
            # weighted by the feature's general model importance.
            denom = abs(m_mean - b_mean) if m_mean != b_mean else 1.0
            mal_proximity = 1.0 - (abs(val - m_mean) / (abs(val - m_mean) + abs(val - b_mean) + 1e-5))
            weighted_contrib = mal_proximity * importance
            
            contributions.append({
                "name": name,
                "display_name": feat['display_name'],
                "input_value": val,
                "benign_mean": b_mean,
                "malignant_mean": m_mean,
                "importance": float(importance),
                "contribution_score": float(weighted_contrib)
            })
            
        # Sort contributions: 
        # If Malignant, sort by features most similar to Malignant averages.
        # If Benign, sort by features most similar to Benign averages.
        if prediction == 1:
            contributions.sort(key=lambda x: x['contribution_score'], reverse=True)
        else:
            contributions.sort(key=lambda x: x['contribution_score'], reverse=False)
            
        top_factors = contributions[:4] # Top 4 explanatory features
        
        return jsonify({
            "success": True,
            "prediction": class_name,
            "prediction_code": prediction,
            "confidence": round(confidence, 2),
            "recommendation": recommendation,
            "top_factors": top_factors,
            "all_features_comparison": contributions
        })
        
    except ValueError as val_err:
        return jsonify({"success": False, "error": f"Invalid numerical inputs: {str(val_err)}"}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Internal server prediction error: {str(e)}"}), 500

if __name__ == '__main__':
    # Try to load the model again if not loaded on startup
    if not model_pipeline:
        try:
            model_pipeline = joblib.load(MODEL_PATH)
            with open(METADATA_PATH, 'r') as f:
                metadata = json.load(f)
            clf = model_pipeline.named_steps['model']
            feature_names = [f['name'] for f in metadata['features']]
            feature_importances = dict(zip(feature_names, clf.feature_importances_))
            print("Model and metadata loaded successfully on route run.")
        except Exception as e:
            print(f"Error loading model artifacts on main: {e}")
            
    print("Launching Flask server on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)

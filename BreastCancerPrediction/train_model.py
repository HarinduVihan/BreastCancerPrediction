import os
import json
import pandas as pd
import joblib
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier

def train_and_serialize():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(current_dir, 'sourceFiles\Cancer_Data.csv')
    
    print(f"Loading dataset from: {csv_path}")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}")
        
    df = pd.read_csv(csv_path)
    
    # 1. Map diagnosis label to binary
    df['diagnosis_numeric'] = df['diagnosis'].map({'M': 1, 'B': 0})
    
    # 2. Separate features X and target y
    y = df['diagnosis_numeric']
    
    # Columns to drop as per the cross-validation notebook
    cols_to_drop = ['diagnosis', 'diagnosis_numeric', 'id', 'concavity_se', 
                    'fractal_dimension_se', 'smoothness_se', 'texture_se', 'Unnamed: 32']
    
    # Filter the features that actually exist in df
    existing_cols_to_drop = [col for col in cols_to_drop if col in df.columns]
    
    X = df.drop(columns=existing_cols_to_drop)
    feature_names = list(X.columns)
    
    print(f"Features selected ({len(feature_names)} features): {feature_names}")
    
    # 3. Compute statistics for the dynamic features UI and interactive charts
    metadata = {
        "features": [],
        "benign_count": int((y == 0).sum()),
        "malignant_count": int((y == 1).sum())
    }
    
    for col in feature_names:
        feature_stats = {
            "name": col,
            "display_name": col.replace('_', ' ').title(),
            "mean": float(df[col].mean()),
            "std": float(df[col].std()),
            "min": float(df[col].min()),
            "max": float(df[col].max()),
            "benign_mean": float(df[df['diagnosis_numeric'] == 0][col].mean()),
            "malignant_mean": float(df[df['diagnosis_numeric'] == 1][col].mean())
        }
        metadata["features"].append(feature_stats)
        
    # Save the statistical metadata to JSON
    metadata_path = os.path.join(current_dir, 'static/metadata.json')
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=4)
    print(f"Saved dataset metadata and statistics to: {metadata_path}")
    
    # 4. Create and train the Scikit-learn Pipeline
    numerical_transformer = SimpleImputer(strategy='constant', fill_value=0, keep_empty_features=True)
    model = RandomForestClassifier(n_estimators=140, random_state=0)
    
    pipeline = Pipeline(steps=[
        ('preprocessor', numerical_transformer),
        ('model', model)
    ])
    
    print("Fitting Random Forest Classifier Pipeline (n_estimators=140)...")
    pipeline.fit(X, y)
    
    # Check self-accuracy to verify pipeline integrity
    train_acc = pipeline.score(X, y)
    print(f"Pipeline self-accuracy on training set: {train_acc:.4f} (expected: ~1.0000)")
    
    # 5. Serialize the pipeline to disk
    model_path = os.path.join(current_dir, 'models/breast_cancer_model.joblib')
    joblib.dump(pipeline, model_path)
    print(f"Serialized model saved successfully to: {model_path}")

if __name__ == "__main__":
    train_and_serialize()

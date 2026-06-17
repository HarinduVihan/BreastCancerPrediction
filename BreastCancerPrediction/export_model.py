import os
import json
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

def serialize_tree(tree, node_id=0):
    left_child = int(tree.children_left[node_id])
    right_child = int(tree.children_right[node_id])
    
    if left_child == -1 and right_child == -1:
        val = tree.value[node_id][0]
        total = sum(val)
        probs = [float(v) / total for v in val]
        return {
            "leaf": True,
            "value": probs
        }
    else:
        return {
            "leaf": False,
            "feature_idx": int(tree.feature[node_id]),
            "threshold": float(tree.threshold[node_id]),
            "left": serialize_tree(tree, left_child),
            "right": serialize_tree(tree, right_child)
        }

def export():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(current_dir, 'models/breast_cancer_model.joblib')
    metadata_path = os.path.join(current_dir, 'metadata.json')
    
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at {model_path}")
    if not os.path.exists(metadata_path):
        raise FileNotFoundError(f"Metadata not found at {metadata_path}")
        
    print("Loading model and metadata...")
    model_pipeline = joblib.load(model_path)
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
        
    clf = model_pipeline.named_steps['model']
    
    if not isinstance(clf, RandomForestClassifier):
        raise TypeError(f"Expected RandomForestClassifier, got {type(clf)}")
        
    feature_names = [f['name'] for f in metadata['features']]
    importances = clf.feature_importances_
    feature_importances = dict(zip(feature_names, importances))
    
    print(f"Serializing {len(clf.estimators_)} trees...")
    serialized_trees = []
    for i, estimator in enumerate(clf.estimators_):
        serialized_trees.append(serialize_tree(estimator.tree_))
        
    model_data = {
        "feature_names": feature_names,
        "feature_importances": feature_importances,
        "trees": serialized_trees
    }
    
    out_dir = os.path.join(current_dir, 'data')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'model_data.json')
    
    with open(out_path, 'w') as f:
        json.dump(model_data, f, indent=2)
        
    print(f"Model successfully exported to {out_path}")
    
    print("Running validation sanity check...")
    dummy_input = np.array([[float(f['mean']) for f in metadata['features']]])
    
    sk_probs = model_pipeline.predict_proba(dummy_input)[0]
    
    def predict_tree(node, features):
        if node['leaf']:
            return node['value']
        val = features[node['feature_idx']]
        if val <= node['threshold']:
            return predict_tree(node['left'], features)
        else:
            return predict_tree(node['right'], features)
            
    def predict_forest(forest, features):
        sum_probs = [0.0, 0.0]
        for tree in forest:
            probs = predict_tree(tree, features)
            sum_probs[0] += probs[0]
            sum_probs[1] += probs[1]
        sum_probs[0] /= len(forest)
        sum_probs[1] /= len(forest)
        return sum_probs
        
    reconstructed_probs = predict_forest(serialized_trees, dummy_input[0])
    
    print(f"Sklearn probabilities: {sk_probs}")
    print(f"Reconstructed probabilities: {reconstructed_probs}")
    
    diff = np.abs(np.array(sk_probs) - np.array(reconstructed_probs)).max()
    print(f"Maximum prediction discrepancy: {diff:.6e}")
    if diff < 1e-7:
        print("SANITY CHECK PASSED: Predictions match exactly!")
    else:
        print("SANITY CHECK FAILED: Predictions do not match!")

if __name__ == "__main__":
    export()

const fs = require('fs');
const path = require('path');

// Absolute paths to configurations on the D: drive
const metadataPath = 'D:/Web designs/BreastCancerPrediction/metadata.json';
const modelPath = 'D:/Web designs/BreastCancerPrediction/data/model_data.json';

console.log("Loading metadata from:", metadataPath);
console.log("Loading model from:", modelPath);

const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));

const featuresData = metadata.features;
const modelData = model;

function predictTree(node, features) {
    if (node.leaf) {
        return node.value;
    }
    const val = features[node.feature_idx];
    if (val <= node.threshold) {
        return predictTree(node.left, features);
    } else {
        return predictTree(node.right, features);
    }
}

function predictForest(forest, features) {
    let sumProbs = [0, 0];
    for (let i = 0; i < forest.length; i++) {
        const probs = predictTree(forest[i], features);
        sumProbs[0] += probs[0];
        sumProbs[1] += probs[1];
    }
    sumProbs[0] /= forest.length;
    sumProbs[1] /= forest.length;
    return sumProbs;
}

function runPrediction(inputs) {
    const probs = predictForest(modelData.trees, inputs);
    const predictionCode = probs[1] >= 0.5 ? 1 : 0;
    const className = predictionCode === 1 ? "Malignant" : "Benign";
    const confidence = probs[predictionCode] * 100;
    
    // Feature contributions
    const contributions = featuresData.map((feat, idx) => {
        const name = feat.name;
        const val = inputs[idx];
        const b_mean = feat.benign_mean;
        const m_mean = feat.malignant_mean;
        const importance = modelData.feature_importances[name] || 0.0;
        
        const mal_proximity = 1.0 - (Math.abs(val - m_mean) / (Math.abs(val - m_mean) + Math.abs(val - b_mean) + 1e-5));
        const weighted_contrib = mal_proximity * importance;
        
        return {
            name: name,
            display_name: feat.display_name,
            input_value: val,
            contribution_score: weighted_contrib
        };
    });
    
    const contributionsCopy = [...contributions];
    if (predictionCode === 1) {
        contributionsCopy.sort((a, b) => b.contribution_score - a.contribution_score);
    } else {
        contributionsCopy.sort((a, b) => a.contribution_score - b.contribution_score);
    }
    
    return {
        prediction: className,
        confidence: confidence,
        top_factors: contributionsCopy.slice(0, 4)
    };
}

console.log("\n--- TEST CASE 1: Default dataset averages (expected Benign) ---");
const benignInputs = modelData.feature_names.map(name => {
    const feat = featuresData.find(f => f.name === name);
    return feat.mean; // Starting average
});
const resultBenign = runPrediction(benignInputs);
console.log("Prediction outcome:", resultBenign.prediction);
console.log("Prediction confidence:", resultBenign.confidence.toFixed(4) + "%");
console.log("Top Factors:", resultBenign.top_factors);

console.log("\n--- TEST CASE 2: High malignant-skewed values (expected Malignant) ---");
const malignantInputs = modelData.feature_names.map(name => {
    const feat = featuresData.find(f => f.name === name);
    return feat.malignant_mean;
});
const resultMalignant = runPrediction(malignantInputs);
console.log("Prediction outcome:", resultMalignant.prediction);
console.log("Prediction confidence:", resultMalignant.confidence.toFixed(4) + "%");
console.log("Top Factors:", resultMalignant.top_factors);

if (resultBenign.prediction === "Benign" && resultMalignant.prediction === "Malignant") {
    console.log("\nSUCCESS: Both test cases passed predictions correctly client-side!");
    process.exit(0);
} else {
    console.error("\nFAILURE: Predictions did not match expected classifications!");
    process.exit(1);
}

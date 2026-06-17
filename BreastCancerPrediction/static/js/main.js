/* ==========================================================================
   OncoPredict AI JavaScript - Pure Client-Side Interactive Engine
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Feature and Model Data Storage
    let featuresData = [];
    let modelData = null;
    
    // UI Elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const predictForm = document.getElementById('predict-form');
    const resetBtn = document.getElementById('reset-btn');
    
    const stateIdle = document.getElementById('state-idle');
    const stateLoading = document.getElementById('state-loading');
    const stateActive = document.getElementById('state-active');
    const resultsPanel = document.getElementById('results-panel');
    
    const gridMeans = document.getElementById('grid-means');
    const gridSe = document.getElementById('grid-se');
    const gridWorst = document.getElementById('grid-worst');
    
    const confidenceCircle = document.getElementById('confidence-circle');
    
    // Circle progress properties
    const radius = confidenceCircle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    confidenceCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    confidenceCircle.style.strokeDashoffset = circumference;

    // Load metadata and model files from the static subdirectory
    Promise.all([
        fetch('static/metadata.json').then(res => {
            if (!res.ok) throw new Error("Failed to load static/metadata.json");
            return res.json();
        }),
        fetch('static/data/model_data.json').then(res => {
            if (!res.ok) throw new Error("Failed to load static/data/model_data.json");
            return res.json();
        })
    ])
    .then(([metadata, model]) => {
        featuresData = metadata.features;
        modelData = model;
        generateInputs();
    })
    .catch(err => {
        console.error("Error loading application configuration:", err);
        alert("Configuration Error: Failed to load model parameters. If running locally, please ensure you serve the site from a local HTTP server rather than opening index.html directly from file:// (due to browser CORS security restrictions).");
    });

    // Tab Switching Logic
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = btn.getAttribute('data-tab');
            
            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active classes
            btn.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });

    // Reset button logic
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        resetToAverages();
    });

    // Handle Form Submit
    predictForm.addEventListener('submit', (e) => {
        e.preventDefault();
        runMorphologyPrediction();
    });

    // Print summary button
    document.getElementById('print-report-btn').addEventListener('click', () => {
        window.print();
    });

    // --- Dynamic UI Methods ---

    function generateInputs() {
        // Clear templates
        gridMeans.innerHTML = '';
        gridSe.innerHTML = '';
        gridWorst.innerHTML = '';
        
        featuresData.forEach(feat => {
            const name = feat.name;
            const displayName = feat.display_name;
            const meanVal = feat.mean;
            const minVal = feat.min;
            const maxVal = feat.max;
            
            // Determine custom step size for precision
            let step = 0.1;
            const range = maxVal - minVal;
            if (range < 0.2) step = 0.0001;
            else if (range < 2.0) step = 0.001;
            else if (range < 15.0) step = 0.01;
            else if (range > 500.0) step = 1.0;
            
            // Create controls
            const controlCard = document.createElement('div');
            controlCard.className = 'feature-control';
            controlCard.innerHTML = `
                <div class="feature-label-row">
                    <label for="input-${name}">${displayName}</label>
                    <input type="number" 
                           id="box-${name}" 
                           class="feature-val-box" 
                           value="${meanVal.toFixed(step < 0.01 ? 4 : 2)}" 
                           min="${minVal}" 
                           max="${maxVal}" 
                           step="any">
                </div>
                <div class="slider-container">
                    <input type="range" 
                           id="slider-${name}" 
                           name="${name}" 
                           min="${minVal}" 
                           max="${maxVal}" 
                           step="${step}" 
                           value="${meanVal}">
                </div>
                <div class="range-limits">
                    <span>Min: ${minVal.toFixed(step < 0.01 ? 3 : 1)}</span>
                    <span>Max: ${maxVal.toFixed(step < 0.01 ? 3 : 1)}</span>
                </div>
            `;
            
            // Append to appropriate grid category
            if (name.endsWith('_mean')) {
                gridMeans.appendChild(controlCard);
            } else if (name.endsWith('_se')) {
                gridSe.appendChild(controlCard);
            } else if (name.endsWith('_worst')) {
                gridWorst.appendChild(controlCard);
            }
            
            // Synchronize Slider and Box
            const slider = controlCard.querySelector(`[id="slider-${name}"]`);
            const box = controlCard.querySelector(`[id="box-${name}"]`);
            
            slider.addEventListener('input', () => {
                box.value = parseFloat(slider.value).toFixed(step < 0.01 ? 4 : 2);
            });
            
            box.addEventListener('change', () => {
                let val = parseFloat(box.value);
                if (isNaN(val)) val = meanVal;
                
                // Enforce boundaries
                if (val < minVal) val = minVal;
                if (val > maxVal) val = maxVal;
                
                box.value = val.toFixed(step < 0.01 ? 4 : 2);
                slider.value = val;
            });
        });
    }

    function resetToAverages() {
        if (!featuresData.length) return;
        
        featuresData.forEach(feat => {
            const name = feat.name;
            const meanVal = feat.mean;
            
            const slider = document.getElementById(`slider-${name}`);
            const box = document.getElementById(`box-${name}`);
            
            if (slider && box) {
                slider.value = meanVal;
                
                let step = 0.1;
                const range = feat.max - feat.min;
                if (range < 0.2) step = 0.0001;
                else if (range < 2.0) step = 0.001;
                else if (range < 15.0) step = 0.01;
                else if (range > 500.0) step = 1.0;
                
                box.value = meanVal.toFixed(step < 0.01 ? 4 : 2);
            }
        });
    }

    function setConfidence(percent) {
        const offset = circumference - (percent / 100) * circumference;
        confidenceCircle.style.strokeDashoffset = offset;
        document.getElementById('confidence-percent').textContent = `${Math.round(percent)}%`;
    }

    // --- Decision Tree Inference Engine ---

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

    // --- Prediction Processing & UI Rendering ---

    function runMorphologyPrediction() {
        if (!modelData || !featuresData.length) {
            alert("Prediction failed: Model parameters are not loaded yet.");
            return;
        }

        // Toggle view states
        stateIdle.classList.add('d-none');
        stateActive.classList.add('d-none');
        stateLoading.classList.remove('d-none');
        
        // Use a tiny timeout to let the loading screen draw
        setTimeout(() => {
            try {
                // Construct inputs array matching modelData.feature_names order
                const inputs = modelData.feature_names.map(name => {
                    const inputVal = document.getElementById(`box-${name}`).value;
                    const num = parseFloat(inputVal);
                    if (isNaN(num)) throw new Error(`Invalid numerical value for feature: ${name}`);
                    return num;
                });

                // 1. Run client-side Random Forest prediction
                const probs = predictForest(modelData.trees, inputs); // [prob_benign, prob_malignant]
                const predictionCode = probs[1] >= 0.5 ? 1 : 0;
                const className = predictionCode === 1 ? "Malignant" : "Benign";
                const confidence = probs[predictionCode] * 100;

                // 2. Compute recommendations
                let recommendation = "";
                if (predictionCode === 1) {
                    recommendation = "Critical Alert: The morphological analysis indicates a high probability of malignancy (Malignant tumor). Immediate histopathological correlation (biopsy) and clinical consultation are strongly advised.";
                } else {
                    recommendation = "Normal/Low Risk: The morphological characteristics indicate a benign cellular state. Continue routine preventative screenings as standard caution.";
                }

                // 3. Compute explanation contribution scores (exact match with app.py logic)
                const contributions = featuresData.map(feat => {
                    const name = feat.name;
                    const val = parseFloat(document.getElementById(`box-${name}`).value);
                    const b_mean = feat.benign_mean;
                    const m_mean = feat.malignant_mean;
                    const importance = modelData.feature_importances[name] || 0.0;

                    // Compute proximity to malignant average weighted by feature importance
                    const mal_proximity = 1.0 - (Math.abs(val - m_mean) / (Math.abs(val - m_mean) + Math.abs(val - b_mean) + 1e-5));
                    const weighted_contrib = mal_proximity * importance;

                    return {
                        name: name,
                        display_name: feat.display_name,
                        input_value: val,
                        benign_mean: b_mean,
                        malignant_mean: m_mean,
                        importance: importance,
                        contribution_score: weighted_contrib
                    };
                });

                // Sort features based on their contribution to the predicted class
                const contributionsCopy = [...contributions];
                if (predictionCode === 1) {
                    contributionsCopy.sort((a, b) => b.contribution_score - a.contribution_score);
                } else {
                    contributionsCopy.sort((a, b) => a.contribution_score - b.contribution_score);
                }
                const topFactors = contributionsCopy.slice(0, 4);

                const predictionResult = {
                    success: true,
                    prediction: className,
                    prediction_code: predictionCode,
                    confidence: Math.round(confidence * 100) / 100,
                    recommendation: recommendation,
                    top_factors: topFactors,
                    all_features_comparison: contributions
                };

                stateLoading.classList.add('d-none');
                stateActive.classList.remove('d-none');
                renderResults(predictionResult);

            } catch (err) {
                console.error("Client side prediction failed:", err);
                stateLoading.classList.add('d-none');
                stateIdle.classList.remove('d-none');
                alert("Error during client-side prediction: " + err.message);
            }
        }, 300);
    }

    function renderResults(data) {
        const outcome = data.prediction; // "Benign" or "Malignant"
        const confidence = data.confidence;
        const recommendation = data.recommendation;
        const topFactors = data.top_factors;
        const comparisons = data.all_features_comparison;
        
        // 1. Prediction outcomes theme card
        const card = document.getElementById('prediction-card');
        const outcomeTitle = document.getElementById('prediction-outcome');
        const outcomeVerdict = document.getElementById('prediction-verdict');
        const outcomeIcon = document.getElementById('prediction-icon');
        
        card.className = 'prediction-card';
        if (outcome === "Malignant") {
            card.classList.add('is-malignant');
            outcomeTitle.textContent = "Malignant tumor detected";
            outcomeVerdict.textContent = "Nuclei features indicate highly high malignant probability.";
            outcomeIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            confidenceCircle.style.stroke = '#ff2a85'; // Magenta meter
        } else {
            card.classList.add('is-benign');
            outcomeTitle.textContent = "Benign structure detected";
            outcomeVerdict.textContent = "Morphology indicators indicate standard benign cells.";
            outcomeIcon.innerHTML = '<i class="fa-solid fa-shield-halved"></i>';
            confidenceCircle.style.stroke = '#00e5ff'; // Teal meter
        }
        
        // 2. Animate Confidence Meter
        setConfidence(confidence);
        
        // 3. Render Top Explanatory Factors
        const factorsList = document.getElementById('factors-list');
        factorsList.innerHTML = '';
        
        topFactors.forEach(factor => {
            const li = document.createElement('li');
            
            let valClass = '';
            // Determine if input is closer to Malignant or Benign average
            if (Math.abs(factor.input_value - factor.malignant_mean) < Math.abs(factor.input_value - factor.benign_mean)) {
                valClass = 'factor-high';
            } else {
                valClass = 'factor-low';
            }
            
            li.className = valClass;
            li.innerHTML = `
                <span class="factor-name">${factor.display_name}</span>
                <span class="factor-value">${factor.input_value.toFixed(2)}</span>
            `;
            factorsList.appendChild(li);
        });
        
        // 4. Render Benchmarks Comparative Charts (Limit to 4 high importance ones to keep panel clean)
        const compContainer = document.getElementById('comparison-bars');
        compContainer.innerHTML = '';
        
        // Filter out 4 most important features to render
        const displayComparisons = comparisons
            .sort((a, b) => b.importance - a.importance)
            .slice(0, 4);
            
        displayComparisons.forEach(comp => {
            const val = comp.input_value;
            
            // Map the value onto the relative scale between benign mean and malignant mean
            let position = ((val - comp.benign_mean) / (comp.malignant_mean - comp.benign_mean)) * 100;
            
            // Clamp position between 0 and 100 for safety
            if (position < 0) position = 0;
            if (position > 100) position = 100;
            
            const row = document.createElement('div');
            row.className = 'comp-row';
            
            row.innerHTML = `
                <div class="comp-header">
                    <span>${comp.display_name}</span>
                    <span>${val.toFixed(2)}</span>
                </div>
                <div class="comp-bar-container">
                    <!-- Benign zone left side -->
                    <div class="comp-bar-benchmark benign" style="width: 50%;"></div>
                    <!-- Malignant zone right side -->
                    <div class="comp-bar-benchmark malignant" style="width: 50%; right: 0;"></div>
                    <!-- Indicator dot -->
                    <div class="comp-bar-indicator" style="left: calc(${position}% - 5px);"></div>
                </div>
                <div class="comp-labels-row">
                    <span>${comp.benign_mean.toFixed(2)} (Benign)</span>
                    <span>${comp.malignant_mean.toFixed(2)} (Malignant)</span>
                </div>
            `;
            compContainer.appendChild(row);
        });
        
        // 5. Render Recommendations
        const recCard = document.getElementById('recommendation-card');
        const recText = document.getElementById('recommendation-text');
        
        recCard.className = 'result-subcard recommendation-card';
        if (outcome === "Malignant") {
            recCard.style.borderLeftColor = 'var(--color-malignant)';
        } else {
            recCard.style.borderLeftColor = 'var(--color-benign)';
        }
        recText.textContent = recommendation;
        
        // 6. Set timestamp
        const now = new Date();
        document.getElementById('diagnostic-timestamp').textContent = `Report ID: OP-${Math.floor(1000 + Math.random() * 9000)} | Generated: ${now.toLocaleTimeString()}`;
    }
});

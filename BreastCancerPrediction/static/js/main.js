/* ==========================================================================
   OncoPredict AI JavaScript - Client-Side Interactive Engine
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Feature Storage & Statistics
    let featuresData = [];
    
    // UI Elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const predictForm = document.getElementById('predict-form');
    const resetBtn = document.getElementById('reset-btn');
    const submitBtn = document.getElementById('submit-btn');
    
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

    // Initialize: Fetch features from API
    fetchFeatures();

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

    function fetchFeatures() {
        fetch('/api/features')
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    featuresData = res.data.features;
                    generateInputs();
                } else {
                    console.error("API error loading features:", res.error);
                }
            })
            .catch(err => {
                console.error("Network error loading features:", err);
            });
    }

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

    // --- API & Prediction Processing ---

    function runMorphologyPrediction() {
        // Toggle view states
        stateIdle.classList.add('d-none');
        stateActive.classList.add('d-none');
        stateLoading.classList.remove('d-none');
        
        // Construct prediction JSON body
        const payload = {};
        featuresData.forEach(feat => {
            const name = feat.name;
            const inputVal = document.getElementById(`box-${name}`).value;
            payload[name] = parseFloat(inputVal);
        });
        
        // POST to Flask Prediction Endpoint
        fetch('/api/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(res => {
            stateLoading.classList.add('d-none');
            
            if (res.success) {
                stateActive.classList.remove('d-none');
                renderResults(res);
            } else {
                stateIdle.classList.remove('d-none');
                alert("Prediction failed: " + res.error);
            }
        })
        .catch(err => {
            stateLoading.classList.add('d-none');
            stateIdle.classList.remove('d-none');
            console.error("Inference server request failed:", err);
            alert("Error: Inference API is currently unreachable. Make sure python app.py is running!");
        });
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
            const min = comp.malignant_mean < comp.benign_mean ? comp.malignant_mean : comp.benign_mean;
            const max = comp.malignant_mean > comp.benign_mean ? comp.malignant_mean : comp.benign_mean;
            
            // Calculate slider dot percentage
            const span = comp.malignant_mean !== comp.benign_mean ? Math.abs(comp.malignant_mean - comp.benign_mean) : 1.0;
            // Map the value onto the relative scale between benign mean and malignant mean
            let position = ((val - comp.benign_mean) / (comp.malignant_mean - comp.benign_mean)) * 100;
            
            // Clamp position between 0 and 100 for safety
            if (position < 0) position = 0;
            if (position > 100) position = 100;
            
            const row = document.createElement('div');
            row.className = 'comp-row';
            
            // Arrange label highlights
            const leftLabel = comp.benign_mean < comp.malignant_mean ? "Benign Average" : "Malignant Average";
            const rightLabel = comp.benign_mean < comp.malignant_mean ? "Malignant Average" : "Benign Average";
            
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

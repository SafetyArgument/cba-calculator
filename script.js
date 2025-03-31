const weightings = {
    fatality: 1,
    majorInjury: 0.1,
    class1Minor: 0.005,
    class2Minor: 0.001,
    class1Shock: 0.005,
    class2Shock: 0.001
};

document.getElementById('frequency').addEventListener('input', function() {
    const freq = parseFloat(this.value);
    document.getElementById('onceInXYears').textContent = freq > 0 ? `Once in ${(1 / freq).toFixed(2)} years` : '';
});

function calculate() {
    // Get inputs
    const riskDesc = document.getElementById('riskDesc').value;
    const frequency = parseFloat(document.getElementById('frequency').value);
    const freqDev = parseFloat(document.getElementById('freqDev').value) / 100;
    const fatality = parseFloat(document.getElementById('fatality').value) || 0;
    const majorInjury = parseFloat(document.getElementById('majorInjury').value) || 0;
    const class1Minor = parseFloat(document.getElementById('class1Minor').value) || 0;
    const class2Minor = parseFloat(document.getElementById('class2Minor').value) || 0;
    const class1Shock = parseFloat(document.getElementById('class1Shock').value) || 0;
    const class2Shock = parseFloat(document.getElementById('class2Shock').value) || 0;
    const severityDev = parseFloat(document.getElementById('severityDev').value) / 100;
    const riskX = parseInt(document.getElementById('riskX').value);
    const riskY = parseInt(document.getElementById('riskY').value);
    const designLife = parseInt(document.getElementById('designLife').value);
    const designLifeDev = parseFloat(document.getElementById('designLifeDev').value) / 100;
    const capex = parseFloat(document.getElementById('capex').value) || 0;
    const opex = parseFloat(document.getElementById('opex').value) || 0;

    // Input validation
    if (!frequency || !riskX || !riskY || !designLife || isNaN(frequency) || isNaN(riskX) || isNaN(riskY) || isNaN(designLife)) {
        alert('Please fill in all required fields with valid numbers.');
        return;
    }
    if (riskX > riskY) {
        alert('Risk Rating X cannot exceed Y.');
        return;
    }

    // Step 1: Total number of risk events
    const Events_number = designLife * frequency;

    // Step 2: Total consequences in equivalent fatalities
    const Consequence_tot = fatality * weightings.fatality +
                            majorInjury * weightings.majorInjury +
                            class1Minor * weightings.class1Minor +
                            class2Minor * weightings.class2Minor +
                            class1Shock * weightings.class1Shock +
                            class2Shock * weightings.class2Shock;

    // Step 3: Safety benefit
    const VFP = 5700000; // 2024 terms
    const VFP_tot = VFP * Consequence_tot * Events_number;

    // Step 4: Cost Benefit Ratio
    const total_cost = capex + opex * designLife;
    const CBR = VFP_tot === 0 ? Infinity : total_cost / VFP_tot;

    // Step 5: Gross Disproportionality Factor and Recommendation
    const GDF = Math.max((riskX / riskY) * 10, 2);
    const recommendation = CBR < GDF ? 'ADOPT' : 'REJECT';

    // Step 6: Sensitivity Analysis
    const scenarios = [
        { name: 'Frequency +%dev', frequency: frequency * (1 + freqDev), Consequence_tot, designLife },
        { name: 'Frequency -%dev', frequency: Math.max(frequency * (1 - freqDev), 0.001), Consequence_tot, designLife },
        { name: 'Severity +%dev', frequency, Consequence_tot: Consequence_tot * (1 + severityDev), designLife },
        { name: 'Severity -%dev', frequency, Consequence_tot: Math.max(Consequence_tot * (1 - severityDev), 0), designLife },
        { name: 'Design Life +%dev', frequency, Consequence_tot, designLife: designLife * (1 + designLifeDev) },
        { name: 'Design Life -%dev', frequency, Consequence_tot, designLife: Math.max(designLife * (1 - designLifeDev), 1) }
    ];

    let closestScenario = null;
    let minDiff = Infinity;
    const baselineDecision = recommendation === 'ADOPT';

    scenarios.forEach(scenario => {
        const scen_Events_number = scenario.frequency * scenario.designLife;
        const scen_VFP_tot = VFP * scenario.Consequence_tot * scen_Events_number;
        const scen_total_cost = capex + opex * scenario.designLife;
        const scen_CBR = scen_VFP_tot === 0 ? Infinity : scen_total_cost / scen_VFP_tot;
        const scen_recommendation = scen_CBR < GDF ? 'ADOPT' : 'REJECT';
        const diff = Math.abs(scen_CBR - GDF);
        if ((baselineDecision && scen_recommendation === 'REJECT') || (!baselineDecision && scen_recommendation === 'ADOPT')) {
            if (diff < minDiff) {
                minDiff = diff;
                closestScenario = { ...scenario, CBR: scen_CBR, recommendation: scen_recommendation };
            }
        }
    });

    // If no flip, check combinations of two parameters
    let comboScenario = null;
    if (!closestScenario) {
        const comboScenarios = [
            { name: 'Freq +%dev & Severity +%dev', 
              frequency: frequency * (1 + freqDev), 
              Consequence_tot: Consequence_tot * (1 + severityDev), 
              designLife },
            { name: 'Freq -%dev & Severity -%dev', 
              frequency: Math.max(frequency * (1 - freqDev), 0.001), 
              Consequence_tot: Math.max(Consequence_tot * (1 - severityDev), 0), 
              designLife },
            { name: 'Freq +%dev & Design +%dev', 
              frequency: frequency * (1 + freqDev), 
              Consequence_tot, 
              designLife: designLife * (1 + designLifeDev) },
            { name: 'Freq -%dev & Design -%dev', 
              frequency: Math.max(frequency * (1 - freqDev), 0.001), 
              Consequence_tot, 
              designLife: Math.max(designLife * (1 - designLifeDev), 1) }
        ];
        comboScenarios.forEach(scenario => {
            const scen_Events_number = scenario.frequency * scenario.designLife;
            const scen_VFP_tot = VFP * scenario.Consequence_tot * scen_Events_number;
            const scen_total_cost = capex + opex * scenario.designLife;
            const scen_CBR = scen_VFP_tot === 0 ? Infinity : scen_total_cost / scen_VFP_tot;
            const scen_recommendation = scen_CBR < GDF ? 'ADOPT' : 'REJECT';
            if ((baselineDecision && scen_recommendation === 'REJECT') || (!baselineDecision && scen_recommendation === 'ADOPT')) {
                if (!comboScenario || Math.abs(scen_CBR - GDF) < Math.abs(comboScenario.CBR - GDF)) {
                    comboScenario = { ...scenario, CBR: scen_CBR, recommendation: scen_recommendation };
                }
            }
        });
    }

    // Display results
    let resultsHTML = `
        <h2>Baseline Results</h2>
        <p><strong>Risk Description:</strong> ${riskDesc}</p>
        <p><strong>Total Risk Events in Design Life:</strong> ${Events_number.toFixed(2)}</p>
        <p><strong>Total Consequences (equiv. fatalities):</strong> ${Consequence_tot.toFixed(2)}</p>
        <p><strong>Total Safety Benefit (VFP_tot):</strong> $${VFP_tot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <p><strong>Total Cost:</strong> $${total_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <p><strong>Cost Benefit Ratio (CBR):</strong> ${CBR.toFixed(2)}</p>
        <p><strong>Gross Disproportionality Factor (GDF):</strong> ${GDF.toFixed(2)}</p>
        <p><strong>Recommendation:</strong> ${recommendation}</p>
    `;

    resultsHTML += '<h2>Sensitivity Analysis</h2>';
    if (closestScenario) {
        resultsHTML += `
            <p><strong>Most Critical Scenario:</strong> ${closestScenario.name}</p>
            <p><strong>CBR in this scenario:</strong> ${closestScenario.CBR.toFixed(2)}</p>
            <p><strong>Recommendation:</strong> ${closestScenario.recommendation}</p>
        `;
    } else if (comboScenario) {
        resultsHTML += `
            <p><strong>Most Critical Combination Scenario:</strong> ${comboScenario.name}</p>
            <p><strong>CBR in this scenario:</strong> ${comboScenario.CBR.toFixed(2)}</p>
            <p><strong>Recommendation:</strong> ${comboScenario.recommendation}</p>
            <p>This indicates the boundary where the decision might flip with combined parameter changes.</p>
        `;
    } else {
        resultsHTML += `
            <p>No single-parameter deviation flipped the decision. The recommendation is robust to the specified deviations.</p>
        `;
    }

    document.getElementById('results').innerHTML = resultsHTML;

    // Print button
    const printButton = document.createElement('button');
    printButton.textContent = 'Print Report';
    printButton.onclick = () => {
        const reportHTML = `
            <html>
            <head><title>CBA Report</title></head>
            <body style="font-family: Arial, sans-serif;">
                <h1>Cost Benefit Analysis Report</h1>
                <h2>Input Parameters</h2>
                <p><strong>Risk Description:</strong> ${riskDesc}</p>
                <p><strong>Probability/Frequency:</strong> ${frequency} year⁻¹ (Once in ${(1/frequency).toFixed(2)} years)</p>
                <p><strong>Frequency Deviation:</strong> ${freqDev * 100}%</p>
                <p><strong>Severity (per event):</strong></p>
                <ul>
                    <li>Fatality: ${fatality}</li>
                    <li>Major Injury: ${majorInjury}</li>
                    <li>Class 1 Minor Injury: ${class1Minor}</li>
                    <li>Class 2 Minor Injury: ${class2Minor}</li>
                    <li>Class 1 Shock/Trauma: ${class1Shock}</li>
                    <li>Class 2 Shock/Trauma: ${class2Shock}</li>
                </ul>
                <p><strong>Severity Deviation:</strong> ${severityDev * 100}%</p>
                <p><strong>Risk Rating:</strong> ${riskX} out of ${riskY}</p>
                <p><strong>Design Life:</strong> ${designLife} years</p>
                <p><strong>Design Life Deviation:</strong> ${designLifeDev * 100}%</p>
                <p><strong>CAPEX:</strong> $${capex.toLocaleString()}</p>
                <p><strong>OPEX:</strong> $${opex.toLocaleString()} per year</p>
                <h2>Baseline Results</h2>
                ${resultsHTML}
                <p><strong>Disclaimer:</strong> This is a simplified model and does not account for discounting or inflation.</p>
                <p><strong>Developed by:</strong> Safety Argument Pty Ltd</p>
            </body>
            </html>
        `;
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write(reportHTML);
        printWindow.document.close();
        printWindow.print();
    };
    document.getElementById('results').appendChild(printButton);
}
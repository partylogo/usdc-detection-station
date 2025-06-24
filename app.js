// USDC Detection Station - JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize data and charts
    initializeApp();

    // Update button click handler
    document.getElementById('updateBtn').addEventListener('click', function() {
        updateData();
    });
});

// Global chart instances
let monthlyChart;
let yearlyChart;
let chainChart;

// Chart colors
const chartColors = ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B'];

// Chain colors mapping
const chainColors = {
    'Ethereum': '#1FB8CD',
    'Solana': '#FFC185',
    'Base': '#B4413C',
    'Arbitrum': '#ECEBD5',
    'Polygon': '#5D878F',
    'Avalanche': '#DB4545',
    'Others': '#13343B'
};

// Application data
const appData = {
    current: {
        total_supply: 61690,
        market_cap: 61690,
        last_updated: "2025-06-24",
        growth_q1_2025: 16119,
        growth_percentage: "36.8%"
    },
    monthly: [
        {"date": "2022-12", "supply": 44554, "year": 2022, "month": 12},
        {"date": "2023-03", "supply": 35000, "year": 2023, "month": 3},
        {"date": "2023-06", "supply": 30000, "year": 2023, "month": 6},
        {"date": "2023-09", "supply": 27000, "year": 2023, "month": 9},
        {"date": "2023-12", "supply": 24412, "year": 2023, "month": 12},
        {"date": "2024-03", "supply": 32419, "year": 2024, "month": 3},
        {"date": "2024-06", "supply": 35000, "year": 2024, "month": 6},
        {"date": "2024-09", "supply": 39000, "year": 2024, "month": 9},
        {"date": "2024-12", "supply": 43857, "year": 2024, "month": 12},
        {"date": "2025-03", "supply": 59976, "year": 2025, "month": 3},
        {"date": "2025-06", "supply": 61690, "year": 2025, "month": 6}
    ],
    yearly: [
        {"year": 2022, "supply": 44554, "change": 2138},
        {"year": 2023, "supply": 24412, "change": -20142},
        {"year": 2024, "supply": 43857, "change": 19445},
        {"year": 2025, "supply": 59976, "change": 16119}
    ],
    chains: [
        {"chain": "Ethereum", "amount": 39880, "percentage": 61},
        {"chain": "Solana", "amount": 9730, "percentage": 16},
        {"chain": "Base", "amount": 3750, "percentage": 6},
        {"chain": "Arbitrum", "amount": 3740, "percentage": 6},
        {"chain": "Polygon", "amount": 2000, "percentage": 3},
        {"chain": "Avalanche", "amount": 1500, "percentage": 2},
        {"chain": "Others", "amount": 1090, "percentage": 2}
    ]
};

// Initialize the application
function initializeApp() {
    // Update the system time
    updateSystemTime();
    setInterval(updateSystemTime, 1000);

    // Set last updated timestamp
    document.getElementById('lastUpdated').textContent = formatTimestamp(new Date());

    // Initialize the dashboard data
    updateDashboardData(appData);

    // Create charts
    createMonthlyChart(appData.monthly);
    createYearlyChart(appData.yearly);
    createChainChart(appData.chains);

    // Populate chain distribution table
    populateChainTable(appData.chains);
}

// Format a number with commas
function formatNumber(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Format timestamp
function formatTimestamp(date) {
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleString('zh-TW', options);
}

// Update system time display
function updateSystemTime() {
    const now = new Date();
    document.getElementById('systemTime').textContent = formatTimestamp(now);
}

// Update dashboard data
function updateDashboardData(data) {
    // Update current supply
    document.getElementById('totalSupply').textContent = formatNumber(data.current.total_supply);
    document.getElementById('marketCap').textContent = `$${formatNumber(data.current.market_cap)}M`;
}

// Create the monthly supply chart
function createMonthlyChart(data) {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    
    // Prepare data
    const labels = data.map(item => item.date);
    const supplyData = data.map(item => item.supply);
    
    // Create chart
    if (monthlyChart) {
        monthlyChart.destroy();
    }
    
    monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'USDC 供應量（百萬美元） | USDC Supply (Million USD)',
                data: supplyData,
                borderColor: '#2775CA',
                backgroundColor: 'rgba(39, 117, 202, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#2775CA',
                pointRadius: 4,
                tension: 0.2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `USDC: $${formatNumber(context.raw)}M`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + formatNumber(value) + 'M';
                        }
                    }
                }
            }
        }
    });
}

// Create the yearly supply chart
function createYearlyChart(data) {
    const ctx = document.getElementById('yearlyChart').getContext('2d');
    
    // Prepare data
    const labels = data.map(item => item.year.toString());
    const supplyData = data.map(item => item.supply);
    const changeData = data.map(item => item.change);
    
    // Create background colors based on change value
    const backgroundColors = changeData.map(change => 
        change >= 0 ? 'rgba(39, 117, 202, 0.7)' : 'rgba(239, 68, 68, 0.7)'
    );
    
    // Create chart
    if (yearlyChart) {
        yearlyChart.destroy();
    }
    
    yearlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'USDC 年度供應量（百萬美元） | USDC Annual Supply (Million USD)',
                data: supplyData,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const change = changeData[index];
                            const sign = change >= 0 ? '+' : '';
                            return [
                                `供應量 | Supply: $${formatNumber(context.raw)}M`,
                                `年度變化 | Change: ${sign}$${formatNumber(change)}M`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + formatNumber(value) + 'M';
                        }
                    }
                }
            }
        }
    });
}

// Create the chain distribution chart
function createChainChart(data) {
    const ctx = document.getElementById('chainChart').getContext('2d');
    
    // Prepare data
    const labels = data.map(item => item.chain);
    const supplyData = data.map(item => item.amount);
    const backgroundColors = data.map(item => chainColors[item.chain] || chartColors[Math.floor(Math.random() * chartColors.length)]);
    
    // Create chart
    if (chainChart) {
        chainChart.destroy();
    }
    
    chainChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: supplyData,
                backgroundColor: backgroundColors,
                borderColor: 'rgba(255, 255, 255, 0.8)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        font: {
                            size: 12
                        },
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map(function(label, i) {
                                    const meta = chart.getDatasetMeta(0);
                                    const ds = data.datasets[0];
                                    const arc = meta.data[i];
                                    const custom = (arc && arc.custom) || {};
                                    const arcOpts = chart.options.elements.arc;
                                    const fill = custom.backgroundColor ? custom.backgroundColor : ds.backgroundColor[i];
                                    const stroke = custom.borderColor ? custom.borderColor : ds.borderColor[i];
                                    const percentage = data.datasets[0].data[i] / data.datasets[0].data.reduce((a, b) => a + b, 0) * 100;
                                    
                                    return {
                                        text: `${label} (${Math.round(percentage)}%)`,
                                        fillStyle: fill,
                                        strokeStyle: stroke,
                                        lineWidth: arcOpts.borderWidth,
                                        hidden: isNaN(ds.data[i]) || meta.data[i].hidden,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label;
                            const value = context.raw;
                            const percentage = context.chart.data.datasets[0].data[context.dataIndex] / context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0) * 100;
                            return `${label}: $${formatNumber(value)}M (${percentage.toFixed(1)}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
}

// Populate chain statistics table
function populateChainTable(data) {
    const tableElement = document.getElementById('chainStatsTable');
    tableElement.innerHTML = '';
    
    data.forEach(item => {
        const rowElement = document.createElement('div');
        rowElement.className = 'chain-row';
        
        const chainColor = chainColors[item.chain] || chartColors[Math.floor(Math.random() * chartColors.length)];
        
        rowElement.innerHTML = `
            <div class="chain-info">
                <div class="chain-indicator" style="background-color: ${chainColor};"></div>
                <div class="chain-name">${item.chain}</div>
            </div>
            <div class="chain-stats">
                <div class="chain-amount">$${formatNumber(item.amount)}M</div>
                <div class="chain-percentage">${item.percentage}%</div>
            </div>
        `;
        
        tableElement.appendChild(rowElement);
    });
}

// Simulate data update
function updateData() {
    // Show loading overlay
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('active');
    
    // Add updating animation to key elements
    document.getElementById('totalSupply').classList.add('updating');
    
    // Simulate server delay
    setTimeout(() => {
        // Generate slight variations in the data to simulate updates
        const updatedData = simulateDataUpdate(appData);
        
        // Update the dashboard with new data
        updateDashboardData(updatedData);
        
        // Update charts
        createMonthlyChart(updatedData.monthly);
        createYearlyChart(updatedData.yearly);
        createChainChart(updatedData.chains);
        
        // Update chain table
        populateChainTable(updatedData.chains);
        
        // Update last updated timestamp
        document.getElementById('lastUpdated').textContent = formatTimestamp(new Date());
        
        // Remove updating animation
        document.getElementById('totalSupply').classList.remove('updating');
        
        // Hide loading overlay
        loadingOverlay.classList.remove('active');
    }, 1500);
}

// Simulate data updates with small variations
function simulateDataUpdate(originalData) {
    const clone = JSON.parse(JSON.stringify(originalData));
    
    // Small random variation function
    const variation = (base, percent = 2) => {
        const change = base * (Math.random() * percent / 100) * (Math.random() > 0.5 ? 1 : -1);
        return Math.round(base + change);
    };
    
    // Update current supply with a small variation
    clone.current.total_supply = variation(clone.current.total_supply, 1);
    clone.current.market_cap = clone.current.total_supply;
    
    // Update last month's supply
    if (clone.monthly.length > 0) {
        const lastIndex = clone.monthly.length - 1;
        clone.monthly[lastIndex].supply = clone.current.total_supply;
    }
    
    // Update current year's supply
    if (clone.yearly.length > 0) {
        const lastIndex = clone.yearly.length - 1;
        clone.yearly[lastIndex].supply = clone.current.total_supply;
        
        // Recalculate change
        if (lastIndex > 0) {
            clone.yearly[lastIndex].change = clone.yearly[lastIndex].supply - clone.yearly[lastIndex - 1].supply;
        }
    }
    
    // Update chain distributions proportionally
    const totalSupply = clone.current.total_supply;
    let remainingPercentage = 100;
    let remainingAmount = totalSupply;
    
    // Update all chains except the last one
    for (let i = 0; i < clone.chains.length - 1; i++) {
        // Slight variation in percentage
        let newPercentage = Math.max(1, Math.round(clone.chains[i].percentage + (Math.random() > 0.5 ? 1 : -1) * (Math.random() < 0.7 ? 0 : 1)));
        
        // Ensure we don't exceed the total
        if (newPercentage > remainingPercentage - (clone.chains.length - i - 1)) {
            newPercentage = remainingPercentage - (clone.chains.length - i - 1);
        }
        
        clone.chains[i].percentage = newPercentage;
        clone.chains[i].amount = Math.round(totalSupply * newPercentage / 100);
        
        remainingPercentage -= newPercentage;
        remainingAmount -= clone.chains[i].amount;
    }
    
    // Last chain gets the remainder
    const lastIndex = clone.chains.length - 1;
    clone.chains[lastIndex].percentage = remainingPercentage;
    clone.chains[lastIndex].amount = Math.max(0, remainingAmount);
    
    return clone;
}
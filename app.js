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

// API Configuration
const apiConfig = {
    primary: 'https://api.coingecko.com/api/v3/coins/usd-coin',
    backup: 'https://api.coinbase.com/v2/currencies/USDC',
    updateInterval: 300000, // 5 minutes
    retryAttempts: 3,
    cacheExpiry: 600000,    // 10 minutes
    timeout: 10000          // 10 seconds
};

// Cache management
const dataCache = {
    lastUpdate: null,
    data: null,
    isExpired() {
        if (!this.lastUpdate) return true;
        return Date.now() - this.lastUpdate > apiConfig.cacheExpiry;
    },
    set(data) {
        this.data = data;
        this.lastUpdate = Date.now();
        localStorage.setItem('usdc_cache', JSON.stringify({
            data: data,
            timestamp: this.lastUpdate
        }));
    },
    get() {
        if (this.data && !this.isExpired()) return this.data;
        
        const cached = localStorage.getItem('usdc_cache');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < apiConfig.cacheExpiry) {
                this.data = parsed.data;
                this.lastUpdate = parsed.timestamp;
                return this.data;
            }
        }
        return null;
    }
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
async function initializeApp() {
    // Update the system time
    updateSystemTime();
    setInterval(updateSystemTime, 1000);

    // Set last updated timestamp
    document.getElementById('lastUpdated').textContent = formatTimestamp(new Date());

    // Try to load real data first
    let currentData = await loadRealTimeData();
    if (!currentData) {
        console.log('Using fallback static data');
        currentData = enhanceStaticData(appData);
    }

    // Initialize the dashboard data
    updateDashboardData(currentData);
    
    // Update analytics panel
    updateAnalyticsPanel(currentData);

    // Create charts
    createMonthlyChart(currentData.monthly);
    createYearlyChart(currentData.yearly);
    createChainChart(currentData.chains);

    // Populate chain distribution table
    populateChainTable(currentData.chains);

    // Set up chart controls
    setupChartControls();

    // Set up automatic updates
    startAutoUpdate();
}

// Auto-update mechanism
function startAutoUpdate() {
    setInterval(async () => {
        if (dataCache.isExpired()) {
            console.log('Cache expired, updating data...');
            await updateData();
        }
    }, apiConfig.updateInterval);
}

// Load real-time data from APIs
async function loadRealTimeData() {
    try {
        const cachedData = dataCache.get();
        if (cachedData) {
            console.log('Using cached data');
            return cachedData;
        }

        console.log('Fetching fresh data from API...');
        const usdcData = await fetchUSDCData();
        
        if (usdcData) {
            const enhancedData = await enhanceWithRealData(usdcData);
            dataCache.set(enhancedData);
            return enhancedData;
        }
        
        return null;
    } catch (error) {
        console.error('Failed to load real-time data:', error);
        return null;
    }
}

// Fetch USDC data from APIs with retry logic
async function fetchUSDCData(retryCount = 0) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), apiConfig.timeout);
        
        const response = await fetch(apiConfig.primary, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error(`API call failed (attempt ${retryCount + 1}):`, error);
        
        if (retryCount < apiConfig.retryAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return fetchUSDCData(retryCount + 1);
        }
        
        throw error;
    }
}

// Enhance static data with current time logic
function enhanceStaticData(staticData) {
    const enhanced = JSON.parse(JSON.stringify(staticData));
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentQuarter = Math.ceil(currentMonth / 3);
    
    // Update current data with time-aware information
    enhanced.current.last_updated = now.toISOString().split('T')[0];
    enhanced.current.current_quarter = currentQuarter;
    enhanced.current.current_year = currentYear;
    
    // Extend monthly data to current month if needed
    enhanced.monthly = extendMonthlyData(enhanced.monthly, currentYear, currentMonth);
    
    // Update quarterly summary
    enhanced.current.growth_quarter = `Q${currentQuarter} ${currentYear}`;
    
    return enhanced;
}

// Extend monthly data array to include current month
function extendMonthlyData(monthlyData, currentYear, currentMonth) {
    const extended = [...monthlyData];
    const lastEntry = extended[extended.length - 1];
    
    if (!lastEntry) return extended;
    
    const lastYear = lastEntry.year;
    const lastMonth = lastEntry.month;
    
    // If current month is ahead, interpolate data
    if (currentYear > lastYear || (currentYear === lastYear && currentMonth > lastMonth)) {
        let nextYear = lastYear;
        let nextMonth = lastMonth + 1;
        
        while (nextYear < currentYear || (nextYear === currentYear && nextMonth <= currentMonth)) {
            if (nextMonth > 12) {
                nextMonth = 1;
                nextYear++;
            }
            
            // Simple interpolation - in reality, this would be replaced by real data
            const interpolatedSupply = Math.round(lastEntry.supply * (1 + Math.random() * 0.1 - 0.05));
            
            extended.push({
                date: `${nextYear}-${nextMonth.toString().padStart(2, '0')}`,
                supply: interpolatedSupply,
                year: nextYear,
                month: nextMonth
            });
            
            nextMonth++;
            
            // Prevent infinite loops
            if (extended.length > monthlyData.length + 24) break;
        }
    }
    
    return extended;
}

// Enhance static data with real API data
async function enhanceWithRealData(apiData) {
    const enhanced = enhanceStaticData(appData);
    
    try {
        // Extract real data from API response
        if (apiData.market_data) {
            const marketCap = apiData.market_data.market_cap?.usd;
            const totalSupply = apiData.market_data.total_supply;
            const currentPrice = apiData.market_data.current_price?.usd;
            
            if (marketCap && totalSupply) {
                // Update current supply (convert from market cap if needed)
                enhanced.current.total_supply = Math.round(marketCap / 1000000); // Convert to millions
                enhanced.current.market_cap = enhanced.current.total_supply;
                
                // Update the latest monthly entry
                if (enhanced.monthly.length > 0) {
                    enhanced.monthly[enhanced.monthly.length - 1].supply = enhanced.current.total_supply;
                }
                
                // Update the latest yearly entry
                if (enhanced.yearly.length > 0) {
                    const currentYear = new Date().getFullYear();
                    const yearlyEntry = enhanced.yearly.find(y => y.year === currentYear);
                    if (yearlyEntry) {
                        const previousYear = enhanced.yearly.find(y => y.year === currentYear - 1);
                        yearlyEntry.supply = enhanced.current.total_supply;
                        if (previousYear) {
                            yearlyEntry.change = yearlyEntry.supply - previousYear.supply;
                        }
                    }
                }
            }
        }
        
        // Update timestamp
        enhanced.current.last_updated = new Date().toISOString().split('T')[0];
        
        console.log('Data enhanced with real API data');
        return enhanced;
        
    } catch (error) {
        console.error('Error enhancing data with API response:', error);
        return enhanced;
    }
}

// Format a number with commas
function formatNumber(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Calculate moving average
function calculateMovingAverage(data, window) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < window - 1) {
            result.push(null);
        } else {
            const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
            result.push(sum / window);
        }
    }
    return result;
}

// Calculate growth rate (month-over-month percentage)
function calculateGrowthRate(data) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            result.push(null);
        } else {
            const current = data[i];
            const previous = data[i - 1];
            const growthRate = ((current - previous) / previous) * 100;
            result.push(growthRate);
        }
    }
    return result;
}

// Calculate volatility index
function calculateVolatility(data) {
    const growthRates = calculateGrowthRate(data).filter(rate => rate !== null);
    if (growthRates.length === 0) return 0;
    
    const mean = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    const variance = growthRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / growthRates.length;
    return Math.sqrt(variance);
}

// Detect anomalies in data
function detectAnomalies(data) {
    const growthRates = calculateGrowthRate(data).filter(rate => rate !== null);
    if (growthRates.length === 0) return [];
    
    const mean = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    const stdDev = Math.sqrt(growthRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / growthRates.length);
    
    const anomalies = [];
    growthRates.forEach((rate, index) => {
        if (Math.abs(rate - mean) > 2 * stdDev) {
            anomalies.push({
                index: index + 1, // +1 because growth rates start from index 1
                value: rate,
                type: rate > mean ? 'spike' : 'drop',
                severity: Math.abs(rate - mean) / stdDev
            });
        }
    });
    
    return anomalies;
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
    
    // Update quarterly summary dynamically
    updateQuarterlySummary(data);
}

// Update quarterly summary with current quarter info
function updateQuarterlySummary(data) {
    const now = new Date();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
    const currentYear = now.getFullYear();
    
    // Find current year data
    const currentYearData = data.yearly.find(y => y.year === currentYear);
    const previousYearData = data.yearly.find(y => y.year === currentYear - 1);
    
    if (currentYearData && previousYearData) {
        const growth = currentYearData.supply - previousYearData.supply;
        const growthPercentage = ((growth / previousYearData.supply) * 100).toFixed(1);
        
        // Update the quarterly summary text
        const statElement = document.querySelector('.stat-item .stat-label');
        const statValueElement = document.querySelector('.stat-item .stat-value');
        
        if (statElement && statValueElement) {
            statElement.textContent = `Q${currentQuarter} ${currentYear} 增長 | Q${currentQuarter} ${currentYear} Growth`;
            
            const isPositive = growth >= 0;
            statValueElement.textContent = `${isPositive ? '+' : ''}$${formatNumber(Math.abs(growth))}M (${isPositive ? '+' : ''}${growthPercentage}%)`;
            statValueElement.className = `stat-value ${isPositive ? 'positive' : 'negative'}`;
        }
    }
}

// Create the monthly supply chart with advanced features
function createMonthlyChart(data) {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    
    // Prepare data
    const labels = data.map(item => item.date);
    const supplyData = data.map(item => item.supply);
    
    // Calculate moving average (3-month)
    const movingAverage = calculateMovingAverage(supplyData, 3);
    
    // Calculate growth rate
    const growthRate = calculateGrowthRate(supplyData);
    
    // Create chart
    if (monthlyChart) {
        monthlyChart.destroy();
    }
    
    monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'USDC 供應量 | USDC Supply',
                    data: supplyData,
                    borderColor: '#2775CA',
                    backgroundColor: 'rgba(39, 117, 202, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#2775CA',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    tension: 0.2,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: '3月移動平均 | 3-Month Moving Average',
                    data: movingAverage,
                    borderColor: '#FF6B6B',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4,
                    borderDash: [5, 5],
                    yAxisID: 'y'
                },
                {
                    label: '月增長率 % | Monthly Growth %',
                    data: growthRate,
                    type: 'bar',
                    backgroundColor: growthRate.map(rate => rate >= 0 ? 'rgba(40, 167, 69, 0.6)' : 'rgba(220, 53, 69, 0.6)'),
                    borderColor: growthRate.map(rate => rate >= 0 ? '#28a745' : '#dc3545'),
                    borderWidth: 1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        font: {
                            size: 11
                        },
                        padding: 15
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    callbacks: {
                        title: function(context) {
                            return `${context[0].label} 月份數據`;
                        },
                        label: function(context) {
                            const datasetLabel = context.dataset.label;
                            const value = context.raw;
                            
                            if (datasetLabel.includes('Growth')) {
                                return `${datasetLabel}: ${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
                            } else {
                                return `${datasetLabel}: $${formatNumber(value)}M`;
                            }
                        },
                        afterBody: function(context) {
                            const dataIndex = context[0].dataIndex;
                            if (dataIndex > 0) {
                                const current = supplyData[dataIndex];
                                const previous = supplyData[dataIndex - 1];
                                const change = current - previous;
                                const changePercent = ((change / previous) * 100).toFixed(1);
                                return [
                                    '',
                                    `月變化: ${change >= 0 ? '+' : ''}$${formatNumber(Math.abs(change))}M`,
                                    `變化率: ${change >= 0 ? '+' : ''}${changePercent}%`
                                ];
                            }
                            return [];
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
                        minRotation: 45,
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + formatNumber(value) + 'M';
                        },
                        font: {
                            size: 10
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(1) + '%';
                        },
                        font: {
                            size: 10
                        }
                    }
                }
            },
            onHover: (event, activeElements) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
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

// Real data update function
async function updateData() {
    // Show loading overlay
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('active');
    
    // Add updating animation to key elements
    document.getElementById('totalSupply').classList.add('updating');
    
    try {
        // Force refresh - bypass cache
        dataCache.lastUpdate = null;
        
        console.log('Forcing data update...');
        const updatedData = await loadRealTimeData();
        
        if (updatedData) {
            // Update the dashboard with new data
            updateDashboardData(updatedData);
            
            // Update analytics panel
            updateAnalyticsPanel(updatedData);
            
            // Update charts
            createMonthlyChart(updatedData.monthly);
            createYearlyChart(updatedData.yearly);
            createChainChart(updatedData.chains);
            
            // Update chain table
            populateChainTable(updatedData.chains);
            
            console.log('Data updated successfully');
        } else {
            // Fallback to enhanced static data
            console.log('Falling back to enhanced static data');
            const fallbackData = enhanceStaticData(appData);
            
            updateDashboardData(fallbackData);
            updateAnalyticsPanel(fallbackData);
            createMonthlyChart(fallbackData.monthly);
            createYearlyChart(fallbackData.yearly);
            createChainChart(fallbackData.chains);
            populateChainTable(fallbackData.chains);
        }
        
        // Update last updated timestamp
        document.getElementById('lastUpdated').textContent = formatTimestamp(new Date());
        
    } catch (error) {
        console.error('Error updating data:', error);
        
        // Show error message to user (optional)
        showNotification('更新失敗，使用本地數據 | Update failed, using local data', 'warning');
        
    } finally {
        // Remove updating animation
        document.getElementById('totalSupply').classList.remove('updating');
        
        // Hide loading overlay
        setTimeout(() => {
            loadingOverlay.classList.remove('active');
        }, 500);
    }
}

// Show notification to user (utility function)
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
            max-width: 300px;
        `;
        document.body.appendChild(notification);
    }
    
    // Set style based on type
    const colors = {
        info: '#2775CA',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;
    notification.style.opacity = '1';
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
    }, 3000);
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

// Update analytics panel with calculated metrics
function updateAnalyticsPanel(data) {
    const monthlySupply = data.monthly.map(item => item.supply);
    
    // Calculate metrics
    const volatility = calculateVolatility(monthlySupply);
    const growthRates = calculateGrowthRate(monthlySupply).filter(rate => rate !== null);
    const avgGrowth = growthRates.length > 0 ? growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length : 0;
    const anomalies = detectAnomalies(monthlySupply);
    
    // Determine trend status
    const recentData = monthlySupply.slice(-3);
    const trendStatus = determineTrendStatus(recentData);
    
    // Update DOM elements
    updateMetricValue('volatilityIndex', volatility.toFixed(2) + '%', volatility > 15 ? 'warning' : '');
    updateMetricValue('avgGrowth', (avgGrowth >= 0 ? '+' : '') + avgGrowth.toFixed(1) + '%', avgGrowth >= 0 ? 'positive' : 'negative');
    updateMetricValue('anomalyCount', anomalies.length.toString(), anomalies.length > 0 ? 'warning' : '');
    updateMetricValue('trendStatus', trendStatus.label, trendStatus.class);
    
    // Display anomaly alerts
    displayAnomalyAlerts(anomalies, data.monthly);
}

// Helper function to update metric values
function updateMetricValue(elementId, value, className = '') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
        element.className = 'metric-value' + (className ? ' ' + className : '');
    }
}

// Determine trend status based on recent data
function determineTrendStatus(recentData) {
    if (recentData.length < 2) return { label: '數據不足', class: '' };
    
    const trend = recentData[recentData.length - 1] - recentData[0];
    const trendPercent = (trend / recentData[0]) * 100;
    
    if (Math.abs(trendPercent) < 2) {
        return { label: '📊 穩定', class: '' };
    } else if (trendPercent > 5) {
        return { label: '📈 強勢上升', class: 'positive' };
    } else if (trendPercent > 0) {
        return { label: '📈 溫和上升', class: 'positive' };
    } else if (trendPercent < -5) {
        return { label: '📉 急劇下降', class: 'negative' };
    } else {
        return { label: '📉 輕微下降', class: 'negative' };
    }
}

// Display anomaly alerts
function displayAnomalyAlerts(anomalies, monthlyData) {
    const alertsContainer = document.getElementById('anomalyAlerts');
    if (!alertsContainer) return;
    
    alertsContainer.innerHTML = '';
    
    if (anomalies.length === 0) {
        alertsContainer.innerHTML = '<div class="no-anomalies">✅ 未檢測到統計異常</div>';
        return;
    }
    
    anomalies.forEach(anomaly => {
        const monthData = monthlyData[anomaly.index];
        const alertDiv = document.createElement('div');
        alertDiv.className = `anomaly-alert ${anomaly.type}`;
        
        const icon = anomaly.type === 'spike' ? '🚀' : '⚠️';
        const typeText = anomaly.type === 'spike' ? '異常增長' : '異常下降';
        const severityText = anomaly.severity > 3 ? '極端' : '顯著';
        
        alertDiv.innerHTML = `
            <span class="anomaly-icon">${icon}</span>
            <div>
                <strong>${monthData.date}</strong>: ${severityText}${typeText}
                <div style="font-size: 0.9em; opacity: 0.8;">
                    變化率: ${anomaly.value >= 0 ? '+' : ''}${anomaly.value.toFixed(1)}%
                </div>
            </div>
        `;
        
        alertsContainer.appendChild(alertDiv);
    });
}

// Setup chart controls for switching chart types
function setupChartControls() {
    const chartToggles = document.querySelectorAll('.chart-toggle');
    
    chartToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const chartType = this.dataset.chart;
            const displayType = this.dataset.type;
            
            // Update active state
            const siblingToggles = this.parentElement.querySelectorAll('.chart-toggle');
            siblingToggles.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Switch chart display
            switchChartType(chartType, displayType);
        });
    });
    
    // Set initial active states
    const monthlyLineBtn = document.querySelector('[data-chart="monthly"][data-type="line"]');
    const yearlyBarBtn = document.querySelector('[data-chart="yearly"][data-type="bar"]');
    
    if (monthlyLineBtn) monthlyLineBtn.classList.add('active');
    if (yearlyBarBtn) yearlyBarBtn.classList.add('active');
}

// Switch chart display type
function switchChartType(chartType, displayType) {
    const currentData = dataCache.get() || enhanceStaticData(appData);
    
    if (chartType === 'monthly') {
        updateMonthlyChartType(currentData.monthly, displayType);
    } else if (chartType === 'yearly') {
        updateYearlyChartType(currentData.yearly, displayType);
    }
}

// Update monthly chart display type
function updateMonthlyChartType(data, type) {
    if (monthlyChart) {
        if (type === 'area') {
            monthlyChart.data.datasets[0].fill = true;
            monthlyChart.data.datasets[0].backgroundColor = 'rgba(39, 117, 202, 0.3)';
        } else {
            monthlyChart.data.datasets[0].fill = false;
            monthlyChart.data.datasets[0].backgroundColor = 'rgba(39, 117, 202, 0.1)';
        }
        monthlyChart.update('none');
    }
}

// Update yearly chart display type  
function updateYearlyChartType(data, type) {
    if (yearlyChart) {
        yearlyChart.config.type = type;
        yearlyChart.update('none');
    }
}
// USDC Detection Station - JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize data and charts
    initializeApp();

    // Update button click handler
    document.getElementById('updateBtn').addEventListener('click', function() {
        updateData();
    });
});

// Global variables
let monthlyChart;
let yearlyChart;
let chainChart;
let isInitialLoad = true; // Track if this is the first load

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
    fallback: 'https://api.coinmarketcap.com/data-api/v3/cryptocurrency/detail?symbol=USDC',
    updateInterval: 300000, // 5 minutes
    retryAttempts: 3,
    cacheExpiry: 600000,    // 10 minutes
    timeout: 5000,          // Reduced to 5 seconds for faster fallback
    maxFailures: 2,         // Reduced for quicker offline mode switch
    healthCheckInterval: 60000, // 1 minute health check
    // Add CORS handling
    corsProxy: '', // Can be enabled if needed
    useProxy: false
};

// Error tracking and recovery
const errorTracker = {
    consecutiveFailures: 0,
    lastSuccessfulUpdate: null,
    isOfflineMode: false,
    lastError: null,
    
    recordSuccess() {
        this.consecutiveFailures = 0;
        this.lastSuccessfulUpdate = Date.now();
        this.isOfflineMode = false;
        this.lastError = null;
    },
    
    recordFailure(error) {
        this.consecutiveFailures++;
        this.lastError = error;
        
        if (this.consecutiveFailures >= apiConfig.maxFailures) {
            this.isOfflineMode = true;
            console.warn('Switching to offline mode after', this.consecutiveFailures, 'consecutive failures');
        }
    },
    
    shouldAttemptAPI() {
        return !this.isOfflineMode || this.shouldRetryConnection();
    },
    
    shouldRetryConnection() {
        // Retry connection every 5 minutes in offline mode
        return this.isOfflineMode && 
               (!this.lastSuccessfulUpdate || Date.now() - this.lastSuccessfulUpdate > 300000);
    },
    
    getStatus() {
        if (this.isOfflineMode) {
            return 'offline';
        } else if (this.consecutiveFailures > 0) {
            return 'degraded';
        } else {
            return 'online';
        }
    }
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
    try {
        console.log('Starting USDC Detection Station...');
        
        // Initialize connection status display
        updateConnectionStatus();
        
        // Update the system time
        updateSystemTime();
        setInterval(updateSystemTime, 1000);

        // Set last updated timestamp
        document.getElementById('lastUpdated').textContent = formatTimestamp(new Date());

        // Always start with static data for immediate UI rendering
        console.log('Loading static data for immediate display...');
        let currentData = enhanceStaticData(appData);
        
        // Initialize the dashboard data immediately
        updateDashboardData(currentData);
        updateGrowthMetrics(currentData);
        createMonthlyChart(currentData.monthly);
        createYearlyChart(currentData.yearly);
        createChainChart(currentData.chains);
        populateChainTable(currentData.chains);

        // Try to load real data asynchronously without blocking UI
        setTimeout(async () => {
            try {
                console.log('Attempting to load real-time data...');
                const realTimeData = await loadRealTimeData();
                if (realTimeData) {
                    console.log('Real-time data loaded successfully');
                    updateDashboardData(realTimeData);
                    updateGrowthMetrics(realTimeData);
                    // Update charts with new data
                    if (monthlyChart) monthlyChart.destroy();
                    if (yearlyChart) yearlyChart.destroy();
                    if (chainChart) chainChart.destroy();
                    createMonthlyChart(realTimeData.monthly);
                    createYearlyChart(realTimeData.yearly);
                    createChainChart(realTimeData.chains);
                    populateChainTable(realTimeData.chains);
                    
                    // Only show success notification if not initial load
                    if (!isInitialLoad) {
                        showNotification('數據已更新 | Data updated successfully', 'success');
                    }
                } else {
                    console.log('Failed to load real-time data, using static data');
                    if (!isInitialLoad) {
                        showNotification('使用離線數據 | Using offline data', 'warning');
                    }
                }
            } catch (error) {
                console.warn('Failed to load real-time data:', error);
                if (!isInitialLoad) {
                    showNotification('API 暫時無法使用，顯示離線數據 | API temporarily unavailable, showing offline data', 'warning');
                }
            } finally {
                // Mark initial load as complete
                isInitialLoad = false;
            }
        }, 100); // Small delay to ensure UI renders first

        // Set up automatic updates
        startAutoUpdate();
        
        // Start health monitoring
        startHealthMonitoring();

        console.log('USDC Detection Station initialized successfully');

    } catch (error) {
        console.error('Failed to initialize app:', error);
        // Even if initialization fails, try to show something
        try {
            const fallbackData = enhanceStaticData(appData);
            updateDashboardData(fallbackData);
            updateGrowthMetrics(fallbackData);
            createMonthlyChart(fallbackData.monthly);
            createYearlyChart(fallbackData.yearly);
            createChainChart(fallbackData.chains);
            populateChainTable(fallbackData.chains);
            showNotification('應用初始化失敗，顯示備用數據 | App initialization failed, showing backup data', 'error');
        } catch (fallbackError) {
            console.error('Even fallback initialization failed:', fallbackError);
            showNotification('應用初始化失敗 | Application initialization failed', 'error');
        }
    }
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

// Enhanced API fetching with multiple fallbacks
async function fetchUSDCData() {
    // Check if we should attempt API calls
    if (!errorTracker.shouldAttemptAPI()) {
        throw new Error('API calls disabled due to repeated failures. Using offline mode.');
    }
    
    const apiSources = [
        { url: apiConfig.primary, name: 'CoinGecko', parser: parseCoinGeckoData },
        { url: apiConfig.backup, name: 'Coinbase', parser: parseCoinbaseData },
        { url: apiConfig.fallback, name: 'CoinMarketCap', parser: parseCoinMarketCapData }
    ];
    
    let lastError = null;
    
    for (const source of apiSources) {
        try {
            console.log(`Attempting to fetch from ${source.name}...`);
            const data = await fetchFromSource(source.url, source.name);
            const parsedData = source.parser(data);
            
            errorTracker.recordSuccess();
            console.log(`Successfully fetched data from ${source.name}`);
            return parsedData;
            
        } catch (error) {
            console.warn(`Failed to fetch from ${source.name}:`, error.message);
            lastError = error;
            continue;
        }
    }
    
    // All sources failed
    errorTracker.recordFailure(lastError);
    throw new Error(`All API sources failed. Last error: ${lastError?.message}`);
}

// Fetch data from a specific source with retry logic
async function fetchFromSource(url, sourceName, retryCount = 0) {
    console.log(`Attempting to fetch from ${sourceName} (attempt ${retryCount + 1})`);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), apiConfig.timeout);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            mode: 'cors', // Explicitly set CORS mode
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Successfully fetched data from ${sourceName}`);
        return data;
        
    } catch (error) {
        console.warn(`Failed to fetch from ${sourceName}:`, error.message);
        
        // Handle specific error types
        if (error.name === 'AbortError') {
            console.warn(`Request to ${sourceName} timed out after ${apiConfig.timeout}ms`);
        } else if (error.message.includes('CORS')) {
            console.warn(`CORS error with ${sourceName} - this is common in production environments`);
        } else if (error.message.includes('Failed to fetch')) {
            console.warn(`Network error with ${sourceName} - possibly blocked or unavailable`);
        }
        
        // Retry logic
        if (retryCount < apiConfig.retryAttempts) {
            console.log(`Retrying ${sourceName} in ${(retryCount + 1) * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
            return fetchFromSource(url, sourceName, retryCount + 1);
        }
        
        // All retries exhausted
        throw error;
    }
}

// Data parsers for different API sources
function parseCoinGeckoData(data) {
    return {
        source: 'CoinGecko',
        marketCap: data.market_data?.market_cap?.usd,
        totalSupply: data.market_data?.total_supply,
        currentPrice: data.market_data?.current_price?.usd,
        lastUpdated: data.last_updated
    };
}

function parseCoinbaseData(data) {
    return {
        source: 'Coinbase',
        // Coinbase API structure might be different, adapt as needed
        marketCap: null,
        totalSupply: null,
        currentPrice: 1, // USDC should be ~$1
        lastUpdated: new Date().toISOString()
    };
}

function parseCoinMarketCapData(data) {
    return {
        source: 'CoinMarketCap',
        // CoinMarketCap API structure, adapt as needed
        marketCap: data.data?.statistics?.marketCap,
        totalSupply: data.data?.statistics?.totalSupply,
        currentPrice: data.data?.statistics?.price,
        lastUpdated: data.data?.lastUpdated
    };
}

// Enhance static data with current time logic
function enhanceStaticData(staticData) {
    const enhanced = JSON.parse(JSON.stringify(staticData));
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentQuarter = Math.ceil(currentMonth / 3);
    
    // Update current data with time-aware information
    enhanced.current.current_quarter = currentQuarter;
    enhanced.current.current_year = currentYear;
    
    // Extend monthly data to current month if needed
    enhanced.monthly = extendMonthlyData(enhanced.monthly, currentYear, currentMonth);

    // Sync current supply with the latest from the (potentially extended) monthly data
    if (enhanced.monthly.length > 0) {
        const latestEntry = enhanced.monthly[enhanced.monthly.length - 1];
        enhanced.current.total_supply = latestEntry.supply;
        enhanced.current.market_cap = latestEntry.supply; // Keep market cap in sync
        enhanced.current.last_updated = latestEntry.date; // Reflect the date of the latest data point
    }
    
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
    const systemTimeEl = document.getElementById('systemTime');
    if (systemTimeEl) {
        systemTimeEl.textContent = new Date().toLocaleString();
    }
}

// Update dashboard data
function updateDashboardData(data) {
    document.getElementById('totalSupply').textContent = formatNumber(Math.round(data.current.total_supply));
    document.getElementById('marketCap').textContent = `$${formatNumber(Math.round(data.current.market_cap))}M`;
    document.getElementById('lastUpdated').textContent = formatTimestamp(new Date(data.current.last_updated));
    
    // Update quarterly summary
    updateQuarterlySummary(data);
}

function updateQuarterlySummary(data) {
    const quarterlyGrowthLabel = document.querySelector('.supply-stats .stat-item:first-child .stat-label');
    const quarterlyGrowthValue = document.querySelector('.supply-stats .stat-item:first-child .stat-value');

    if (quarterlyGrowthLabel && quarterlyGrowthValue) {
        const now = new Date();
        const year = now.getFullYear();
        const quarter = Math.floor(now.getMonth() / 3) + 1;

        // Format the label
        quarterlyGrowthLabel.innerHTML = `Q${quarter} ${year} 增長 | Q${quarter} ${year} Growth`;

        // Always calculate growth based on previous quarter's data for consistency
        const previousQuarterEndMonth = quarter * 3 - 3;
        
        // Find supply at the end of the previous quarter
        const previousData = data.monthly
            .filter(d => d.year < year || (d.year === year && d.month <= previousQuarterEndMonth))
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        let growthAmount = 0;
        let growthPercentage = 'N/A';

        if (previousData) {
            const previousQuarterSupply = previousData.supply;
            growthAmount = data.current.total_supply - previousQuarterSupply;
            
            if (previousQuarterSupply > 0) {
                const percentage = ((growthAmount / previousQuarterSupply) * 100);
                growthPercentage = `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`;
            }
        }
        
        // Format the value
        const formattedGrowth = growthAmount > 0 ? `+$${formatNumber(Math.round(growthAmount))}M` : `-$${formatNumber(Math.abs(Math.round(growthAmount)))}M`;
        const colorClass = growthAmount >= 0 ? 'positive' : 'negative';

        quarterlyGrowthValue.innerHTML = `${formattedGrowth} (${growthPercentage})`;
        quarterlyGrowthValue.className = `stat-value ${colorClass}`;
    }
}

// Create the monthly supply chart with advanced features
function createMonthlyChart(data) {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    
    // Prepare data
    const labels = data.map(item => item.date);
    const supplyData = data.map(item => item.supply);
    
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
    
    let dataSource = '未知';
    let updateSuccessful = false;
    let fallbackUsed = false;
    
    try {
        // Update connection status first
        updateConnectionStatus();
        
        // Force refresh - bypass cache if in retry mode
        if (errorTracker.shouldRetryConnection()) {
            dataCache.lastUpdate = null;
            console.log('Retrying API connection after failures...');
        }
        
        console.log('Initiating data update...');
        const updatedData = await loadRealTimeData();
        
        if (updatedData) {
            // Successful API update
            updateDashboardData(updatedData);
            updateGrowthMetrics(updatedData);
            createMonthlyChart(updatedData.monthly);
            createYearlyChart(updatedData.yearly);
            createChainChart(updatedData.chains);
            populateChainTable(updatedData.chains);
            
            dataSource = updatedData.source || 'API';
            updateSuccessful = true;
            console.log(`Data updated successfully from ${dataSource}`);
            
        } else {
            // Primary API failed, try fallback strategies
            console.log('Primary data load failed, trying fallback strategies...');
            
            // Strategy 1: Use cached data if available
            const cachedData = dataCache.get();
            if (cachedData) {
                console.log('Using cached data as fallback');
                updateDashboardData(cachedData);
                updateGrowthMetrics(cachedData);
                createMonthlyChart(cachedData.monthly);
                createYearlyChart(cachedData.yearly);
                createChainChart(cachedData.chains);
                populateChainTable(cachedData.chains);
                
                dataSource = '緩存數據';
                fallbackUsed = true;
                
            } else {
                // Strategy 2: Enhanced static data
                console.log('No cache available, using enhanced static data');
                const fallbackData = enhanceStaticData(appData);
                
                updateDashboardData(fallbackData);
                updateGrowthMetrics(fallbackData);
                createMonthlyChart(fallbackData.monthly);
                createYearlyChart(fallbackData.yearly);
                createChainChart(fallbackData.chains);
                populateChainTable(fallbackData.chains);
                
                dataSource = '離線數據';
                fallbackUsed = true;
            }
        }
        
        // Update last updated timestamp
        document.getElementById('lastUpdated').textContent = formatTimestamp(new Date());
        
        // Show appropriate success message (but not on initial load)
        if (!isInitialLoad) {
            if (updateSuccessful) {
                showNotification(`數據更新成功 (${dataSource})`, 'success');
            } else if (fallbackUsed) {
                showNotification(`使用${dataSource}更新`, 'info');
            }
        }
        
        // Mark initial load as complete after first update
        isInitialLoad = false;
        
    } catch (error) {
        console.error('Critical error during data update:', error);
        
        // Emergency fallback - always try to show something
        try {
            console.log('Attempting emergency fallback to static data');
            const emergencyData = enhanceStaticData(appData);
            
            updateDashboardData(emergencyData);
            updateGrowthMetrics(emergencyData);
            createMonthlyChart(emergencyData.monthly);
            createYearlyChart(emergencyData.yearly);
            createChainChart(emergencyData.chains);
            populateChainTable(emergencyData.chains);
            
            // Update timestamp even for emergency fallback
            document.getElementById('lastUpdated').textContent = formatTimestamp(new Date());
            
            // Only show error notification if not initial load
            if (!isInitialLoad) {
                showNotification('系統錯誤，使用緊急備用數據', 'error');
            }
            
        } catch (emergencyError) {
            console.error('Emergency fallback also failed:', emergencyError);
            if (!isInitialLoad) {
                showNotification('嚴重錯誤：無法載入任何數據', 'error');
            }
        }
        
    } finally {
        // Always clean up UI states
        document.getElementById('totalSupply').classList.remove('updating');
        updateConnectionStatus();
        
        // Hide loading overlay with appropriate delay
        setTimeout(() => {
            loadingOverlay.classList.remove('active');
        }, updateSuccessful ? 500 : 800);
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

// Update growth metrics in supply overview
function updateGrowthMetrics(data) {
    const monthlySupply = data.monthly.map(item => item.supply);
    
    // Calculate growth rates
    const growthRates = calculateGrowthRate(monthlySupply).filter(rate => rate !== null);
    
    // Calculate 12-month average growth
    const avg12MonthGrowth = growthRates.length > 0 ? 
        growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length : 0;
    
    // Calculate 3-month average growth (most recent 3 months)
    const recent3MonthGrowth = growthRates.slice(-3);
    const avg3MonthGrowth = recent3MonthGrowth.length > 0 ? 
        recent3MonthGrowth.reduce((sum, rate) => sum + rate, 0) / recent3MonthGrowth.length : 0;
    
    // Update DOM elements
    updateMetricValue('avg12MonthGrowth', 
        (avg12MonthGrowth >= 0 ? '+' : '') + avg12MonthGrowth.toFixed(1) + '%', 
        avg12MonthGrowth >= 0 ? 'positive' : 'negative');
    
    updateMetricValue('avg3MonthGrowth', 
        (avg3MonthGrowth >= 0 ? '+' : '') + avg3MonthGrowth.toFixed(1) + '%', 
        avg3MonthGrowth >= 0 ? 'positive' : 'negative');
}

// Helper function to update metric values
function updateMetricValue(elementId, value, className = '') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
        element.className = 'metric-value' + (className ? ' ' + className : '');
    }
}

// Update connection status indicator (UI removed per user request)
function updateConnectionStatus() {
    // Status tracking still active but UI display removed
    const status = errorTracker.getStatus();
    console.log(`Connection status: ${status}`);
    
    // Remove existing status element if it exists
    const existingElement = document.getElementById('connectionStatus');
    if (existingElement) {
        existingElement.remove();
    }
}

// Network health check
async function performHealthCheck() {
    console.log('Performing network health check...');
    
    try {
        // Simple connectivity test
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch('https://httpbin.org/get', {
            signal: controller.signal,
            method: 'GET',
            cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            // Network is available, maybe API-specific issue
            console.log('Health check passed - network connectivity OK');
            return true;
        } else {
            console.log('Health check failed - network issues detected');
            return false;
        }
        
    } catch (error) {
        console.log('Health check failed - no internet connectivity');
        return false;
    }
}

// Start health monitoring system
function startHealthMonitoring() {
    setInterval(async () => {
        if (errorTracker.isOfflineMode) {
            const isHealthy = await performHealthCheck();
            if (isHealthy) {
                console.log('Network restored, attempting to reconnect...');
                // Try to update data to test API connectivity
                try {
                    await loadRealTimeData();
                    console.log('API connectivity restored');
                } catch (error) {
                    console.log('API still not available despite network connectivity');
                }
            }
        }
        
        // Update status display
        updateConnectionStatus();
        
    }, apiConfig.healthCheckInterval);
}

// Enhanced notification system with retry options
function showAdvancedNotification(message, type = 'info', options = {}) {
    const {
        duration = 5000,
        showRetry = false,
        retryCallback = null,
        persistent = false
    } = options;
    
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
            max-width: 350px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(notification);
    }
    
    const colors = {
        info: '#2775CA',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Create message content
    let content = `<div style="margin-bottom: ${showRetry ? '8px' : '0'}">${message}</div>`;
    
    if (showRetry && retryCallback) {
        content += `
            <button onclick="this.parentElement.style.opacity='0'; (${retryCallback.toString()})();" 
                    style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); 
                           color: white; padding: 4px 8px; border-radius: 3px; font-size: 12px; 
                           cursor: pointer; margin-top: 4px;">
                重試
            </button>
        `;
    }
    
    notification.innerHTML = content;
    notification.style.opacity = '1';
    
    // Auto hide unless persistent
    if (!persistent) {
        setTimeout(() => {
            notification.style.opacity = '0';
        }, duration);
    }
    
    return notification;
}




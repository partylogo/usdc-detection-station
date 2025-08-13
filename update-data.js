const fetch = require('node-fetch');
const fs = require('fs').promises; // Use the promise-based version of fs
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const csv = require('csv-parser');
const { format } = require('fast-csv');

// --- Configuration ---
const COINS = {
    usdc: {
        coingeckoId: 'usd-coin',
        llamaSymbol: 'USDC',
        monthlyHistoryFile: path.join(__dirname, 'usdc_monthly_supply.csv'),
        yearlyHistoryFile: path.join(__dirname, 'usdc_yearly_supply.csv')
    },
    usdt: {
        coingeckoId: 'tether',
        llamaSymbol: 'USDT',
        monthlyHistoryFile: path.join(__dirname, 'usdt_monthly_supply.csv'),
        yearlyHistoryFile: path.join(__dirname, 'usdt_yearly_supply.csv')
    }
};
const DATA_JSON_PATH = path.join(__dirname, 'data.json');


// --- Performance Monitoring ---

class PerformanceTracker {
    constructor() {
        this.metrics = new Map();
        this.startTimes = new Map();
    }
    
    start(operation) {
        this.startTimes.set(operation, process.hrtime.bigint());
    }
    
    end(operation) {
        const startTime = this.startTimes.get(operation);
        if (!startTime) {
            console.warn(`Warning: No start time found for operation: ${operation}`);
            return 0;
        }
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        this.metrics.set(operation, {
            duration,
            timestamp: new Date().toISOString(),
            memoryUsage: process.memoryUsage()
        });
        
        this.startTimes.delete(operation);
        return duration;
    }
    
    getMetrics() {
        return Object.fromEntries(this.metrics);
    }
    
    logSummary() {
        console.log('\n📊 Performance Summary:');
        const sortedMetrics = Array.from(this.metrics.entries())
            .sort(([,a], [,b]) => b.duration - a.duration);
            
        let totalDuration = 0;
        sortedMetrics.forEach(([operation, data]) => {
            console.log(`   ${operation}: ${data.duration.toFixed(2)}ms`);
            totalDuration += data.duration;
        });
        
        console.log(`   Total: ${totalDuration.toFixed(2)}ms`);
        
        // 記憶體使用情況
        const currentMemory = process.memoryUsage();
        console.log(`\n💾 Memory Usage:`);
        console.log(`   RSS: ${(currentMemory.rss / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Heap Used: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   External: ${(currentMemory.external / 1024 / 1024).toFixed(2)} MB`);
    }
    
    detectSlowOperations(thresholdMs = 5000) {
        const slowOps = [];
        this.metrics.forEach((data, operation) => {
            if (data.duration > thresholdMs) {
                slowOps.push({ operation, duration: data.duration });
            }
        });
        
        if (slowOps.length > 0) {
            console.warn('\n⚠️  Slow Operations Detected:');
            slowOps.forEach(({ operation, duration }) => {
                console.warn(`   ${operation}: ${duration.toFixed(2)}ms (> ${thresholdMs}ms threshold)`);
            });
        }
    }
}

const performanceTracker = new PerformanceTracker();

// --- Error Classification & Handling ---

class DataError extends Error {
    constructor(message, type = 'UNKNOWN', details = null) {
        super(message);
        this.name = 'DataError';
        this.type = type;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

class APIError extends Error {
    constructor(message, endpoint, statusCode = null, retryable = false) {
        super(message);
        this.name = 'APIError';
        this.endpoint = endpoint;
        this.statusCode = statusCode;
        this.retryable = retryable;
        this.timestamp = new Date().toISOString();
    }
}

function classifyError(error, context = '') {
    // 網絡相關錯誤 (可重試)
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
        return new APIError(`Network error: ${error.message}`, context, null, true);
    }
    
    // HTTP 狀態碼錯誤
    if (error.message.includes('HTTP')) {
        const statusMatch = error.message.match(/HTTP (\d+)/);
        const statusCode = statusMatch ? parseInt(statusMatch[1]) : null;
        const retryable = statusCode >= 500 || statusCode === 429; // Server errors and rate limiting
        return new APIError(error.message, context, statusCode, retryable);
    }
    
    // 數據驗證錯誤 (不可重試)
    if (error.message.includes('Invalid numeric value') || 
        error.message.includes('data not found') ||
        error.message.includes('Total supply') && error.message.includes('is zero')) {
        return new DataError(error.message, 'VALIDATION', context);
    }
    
    // 文件系統錯誤
    if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EPERM') {
        return new DataError(`File system error: ${error.message}`, 'FILE_SYSTEM', context);
    }
    
    // JSON 解析錯誤
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return new DataError(`JSON parsing error: ${error.message}`, 'PARSE', context);
    }
    
    // 未分類錯誤
    return error;
}

function logError(error, context = '') {
    const prefix = context ? `[${context}]` : '';
    
    if (error instanceof APIError) {
        console.error(`${prefix} API Error: ${error.message}`);
        if (error.endpoint) console.error(`  Endpoint: ${error.endpoint}`);
        if (error.statusCode) console.error(`  Status Code: ${error.statusCode}`);
        console.error(`  Retryable: ${error.retryable ? 'Yes' : 'No'}`);
    } else if (error instanceof DataError) {
        console.error(`${prefix} Data Error (${error.type}): ${error.message}`);
        if (error.details) console.error(`  Details: ${JSON.stringify(error.details)}`);
    } else {
        console.error(`${prefix} Unclassified Error: ${error.message}`);
    }
    
    console.error(`  Time: ${new Date().toISOString()}`);
}

// --- Utility Functions ---

function safeRound(value, divisor) {
    // 處理大數值精度問題
    const result = value / divisor;
    
    // 檢查是否會丟失精度
    const rounded = Math.round(result);
    const precision = Math.abs(result - rounded);
    
    if (precision < 0.0001) {
        return rounded;
    } else {
        // 對於可能丟失精度的情況，保留更多小數位
        return Math.round(result * 100) / 100;
    }
}

function validateNumericValue(value, context = '') {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new DataError(`Invalid numeric value in ${context}: ${value}`, 'VALIDATION', { value, context });
    }
    if (value < 0) {
        console.warn(`Negative value detected in ${context}: ${value}`);
    }
    return value;
}

function parseUTCDate(timestamp) {
    // 統一日期處理：確保所有日期都使用 UTC
    const date = new Date(timestamp);
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth(), // 0-11
        monthKey: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    };
}

function validateDataCompleteness(monthlyData, coinName) {
    console.log(`Validating data completeness for ${coinName}...`);
    
    if (monthlyData.length === 0) {
        console.warn(`⚠️  No monthly data found for ${coinName}`);
        return [];
    }
    
    // 排序數據以確保順序正確
    const sortedData = [...monthlyData].sort((a, b) => a.month.localeCompare(b.month));
    const missingPeriods = [];
    const anomalies = [];
    
    // 檢查連續性（統一使用 UTC 時間）
    for (let i = 1; i < sortedData.length; i++) {
        const prevDate = new Date(sortedData[i-1].month + '-01T00:00:00.000Z');
        const currDate = new Date(sortedData[i].month + '-01T00:00:00.000Z');
        
        const monthDiff = (currDate.getUTCFullYear() - prevDate.getUTCFullYear()) * 12 
                         + (currDate.getUTCMonth() - prevDate.getUTCMonth());
        
        if (monthDiff > 1) {
            const missingCount = monthDiff - 1;
            missingPeriods.push({
                from: sortedData[i-1].month,
                to: sortedData[i].month,
                count: missingCount
            });
        }
        
        // 檢查異常變化率
        const changeRate = Math.abs(sortedData[i].change);
        if (changeRate > 100) {
            anomalies.push({
                month: sortedData[i].month,
                change: sortedData[i].change,
                supply: sortedData[i].supply
            });
        }
    }
    
    // 報告發現的問題
    if (missingPeriods.length > 0) {
        console.warn(`⚠️  Data gaps found in ${coinName}:`);
        missingPeriods.forEach(gap => {
            console.warn(`   ${gap.from} -> ${gap.to} (missing ${gap.count} months)`);
        });
    }
    
    if (anomalies.length > 0) {
        console.warn(`⚠️  Anomalous changes detected in ${coinName}:`);
        anomalies.forEach(anomaly => {
            console.warn(`   ${anomaly.month}: ${anomaly.change}% change (supply: ${anomaly.supply})`);
        });
    }
    
    if (missingPeriods.length === 0 && anomalies.length === 0) {
        console.log(`✅ Data completeness check passed for ${coinName}`);
    }
    
    return { missingPeriods, anomalies };
}

async function fetchWithRetry(url, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempting to fetch ${url} (attempt ${attempt}/${maxRetries})`);
            const response = await fetch(url);
            
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                throw error;
            }
            
            return response;
        } catch (error) {
            const classifiedError = classifyError(error, url);
            lastError = classifiedError;
            
            logError(classifiedError, `Fetch Attempt ${attempt}`);
            
            // 如果錯誤不可重試，立即拋出
            if (classifiedError instanceof APIError && !classifiedError.retryable) {
                throw classifiedError;
            }
            
            if (attempt === maxRetries) {
                throw new APIError(
                    `All ${maxRetries} attempts failed. Last error: ${lastError.message}`, 
                    url, 
                    lastError.statusCode, 
                    false
                );
            }
            
            // 指數退避：每次重試間隔時間加倍
            const waitTime = delay * Math.pow(2, attempt - 1);
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

// --- Data Fetching & Processing Functions ---

async function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        // The 'fs' module for sync checks should be the original one, not the promises version.
        if (!require('fs').existsSync(filePath) || require('fs').statSync(filePath).size === 0) {
            console.log(`History file not found or empty, starting fresh: ${filePath}`);
            return resolve(results);
        }
        console.log(`Reading history from ${filePath}...`);
        require('fs').createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                // Enforce numeric types for specific columns right after parsing.
                const typedData = {};
                for (const key in data) {
                    if (key === 'supply' || key === 'change' || key === 'year') {
                        typedData[key] = Number(data[key]);
                    } else {
                        typedData[key] = data[key];
                    }
                }
                results.push(typedData);
            })
            .on('end', () => {
                console.log(`Successfully read ${results.length} records from ${filePath}.`);
                resolve(results);
            })
            .on('error', (error) => reject(error));
    });
}

async function writeCsv(filePath, data, headers) {
    return new Promise((resolve, reject) => {
        const csvStream = format({ headers });
        const fileStream = require('fs').createWriteStream(filePath);

        fileStream.on('finish', () => {
            console.log(`Successfully wrote ${data.length} records to ${filePath}`);
            resolve();
        });
        fileStream.on('error', reject);

        csvStream.pipe(fileStream);
        data.forEach(row => csvStream.write(row));
        csvStream.end();
    });
}


async function fetchMonthlyHistory(coinId) {
    performanceTracker.start(`Fetch-${coinId}-CoinGecko`);
    
    console.log(`Fetching 365-day historical data for ${coinId} from CoinGecko...`);
    // We only fetch 365 days, as we merge this with our persistent history.
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=365&interval=daily`;
    const response = await fetchWithRetry(url);
    
    performanceTracker.start(`Process-${coinId}-CoinGecko-Data`);
    const data = await response.json();
    const monthlyData = {};
    data.market_caps.forEach(([timestamp, marketCap]) => {
        const dateInfo = parseUTCDate(timestamp);
        
        // We take the last value for each month, as daily data can be noisy.
        monthlyData[dateInfo.monthKey] = {
            month: dateInfo.monthKey, // Use 'YYYY-MM' format as the unique key
            supply: safeRound(marketCap, 1000000), // in millions, using safe rounding
            change: 0 // Will be calculated later
        };
    });
    performanceTracker.end(`Process-${coinId}-CoinGecko-Data`);
    
    performanceTracker.end(`Fetch-${coinId}-CoinGecko`);
    console.log(`Successfully processed CoinGecko data for ${coinId}.`);
    return Object.values(monthlyData);
}

function mergeMonthlyHistory(historicalData, newData) {
    performanceTracker.start('Merge-Monthly-History');
    
    const dataMap = new Map();
    historicalData.forEach(row => dataMap.set(row.month, row));
    newData.forEach(row => dataMap.set(row.month, row));
    
    const merged = Array.from(dataMap.values());
    merged.sort((a, b) => a.month.localeCompare(b.month));

    // Recalculate 'change' percentage across the full, sorted dataset
    for (let i = 1; i < merged.length; i++) {
        const prevSupply = Number(merged[i - 1].supply);
        const currSupply = Number(merged[i].supply);
        if (prevSupply > 0) {
            const changePercent = ((currSupply - prevSupply) / prevSupply) * 100;
            merged[i].change = Math.round(changePercent);
        } else {
            merged[i].change = 0;
        }
    }

    performanceTracker.end('Merge-Monthly-History');
    console.log('Successfully merged and recalculated monthly history.');
    return merged;
}

async function fetchChainDistribution(symbol) {
    performanceTracker.start(`Fetch-${symbol}-DefiLlama`);
    
    console.log(`Fetching chain distribution for ${symbol} from DefiLlama...`);
    const response = await fetchWithRetry('https://stablecoins.llama.fi/stablecoins');
    
    performanceTracker.start(`Process-${symbol}-DefiLlama-Data`);
    const data = await response.json();
    const coinData = data.peggedAssets.find(asset => asset.symbol === symbol);
    if (!coinData || !coinData.chainCirculating) throw new DataError(`${symbol} data not found in DefiLlama response`, 'VALIDATION', symbol);

    const chainData = coinData.chainCirculating;
    const transformedChains = [];
    let totalChainSupply = Object.values(chainData).reduce((sum, chain) => sum + (chain.current?.peggedUSD || 0), 0);
    if (totalChainSupply === 0) throw new DataError(`Total supply for ${symbol} from DefiLlama is zero.`, 'VALIDATION', symbol);

    let othersAmount = 0;
    let othersCount = 0;
    const sortedChains = Object.entries(chainData).sort(([,a],[,b]) => (b.current?.peggedUSD || 0) - (a.current?.peggedUSD || 0));

    sortedChains.forEach(([chainName, chain]) => {
        const amount = chain.current?.peggedUSD || 0;
        if (amount > 0) {
            const amountInMillions = amount / 1000000;
            if (transformedChains.length >= 8 || (amount / totalChainSupply) < 0.005) {
                othersAmount += amountInMillions;
                othersCount++;
            } else {
                transformedChains.push({
                    chain: chainName,
                    amount: Math.round(amountInMillions),
                    percentage: parseFloat(((amount / totalChainSupply) * 100).toFixed(1))
                });
            }
        }
    });

    if (othersCount > 0) {
        transformedChains.push({
            chain: `Others (${othersCount})`,
            amount: Math.round(othersAmount),
            percentage: parseFloat(((othersAmount * 1000000 / totalChainSupply) * 100).toFixed(1))
        });
    }
    
    performanceTracker.end(`Process-${symbol}-DefiLlama-Data`);
    performanceTracker.end(`Fetch-${symbol}-DefiLlama`);
    console.log(`Successfully processed chain distribution data for ${symbol}.`);
    return transformedChains;
}

async function updateDataJson(coinKey, data) {
    console.log(`Updating ${DATA_JSON_PATH} for ${coinKey}...`);
    let existingData = {};
    try {
        const fileContent = await fs.readFile(DATA_JSON_PATH, 'utf-8');
        existingData = JSON.parse(fileContent);
    } catch (error) {
        if (error.code !== 'ENOENT') { // ENOENT means file doesn't exist, which is fine.
            console.warn('Could not read or parse existing data.json, will create a new one.', error);
        }
    }
    
    existingData[coinKey] = data;
    await fs.writeFile(DATA_JSON_PATH, JSON.stringify(existingData, null, 2), 'utf-8');
    console.log(`Successfully updated ${DATA_JSON_PATH}.`);
}


// --- Main Execution ---

async function main() {
    const coin = argv.coin;
    if (!coin || !COINS[coin]) {
        console.error('ERROR: Please specify a valid coin with --coin=usdc or --coin=usdt');
        process.exit(1);
    }
    
    console.log(`\n--- Running Data Updater for ${coin.toUpperCase()} ---`);
    const coinConfig = COINS[coin];

    try {
        // 1. Handle historical monthly data
        performanceTracker.start('Read-Monthly-CSV');
        const monthlyHistoricalData = await readCsv(coinConfig.monthlyHistoryFile);
        performanceTracker.end('Read-Monthly-CSV');
        
        const newMonthlyData = await fetchMonthlyHistory(coinConfig.coingeckoId);
        const fullMonthlyHistory = mergeMonthlyHistory(monthlyHistoricalData, newMonthlyData);
        
        // 驗證數據完整性
        performanceTracker.start('Validate-Data-Completeness');
        validateDataCompleteness(fullMonthlyHistory, coin.toUpperCase());
        performanceTracker.end('Validate-Data-Completeness');
        
        performanceTracker.start('Write-Monthly-CSV');
        await writeCsv(coinConfig.monthlyHistoryFile, fullMonthlyHistory, ['month', 'supply', 'change']);
        performanceTracker.end('Write-Monthly-CSV');

        // 2. Read and dynamically update yearly data
        performanceTracker.start('Read-Yearly-CSV');
        const yearlyData = await readCsv(coinConfig.yearlyHistoryFile);
        performanceTracker.end('Read-Yearly-CSV');
        
        // --- Logic to update yearly data from monthly data ---
        if (fullMonthlyHistory.length > 0) {
            // Group monthly data by year and find December data for each year
            const yearlySupplyMap = {};
            
            fullMonthlyHistory.forEach(record => {
                const date = new Date(record.month + '-01T00:00:00.000Z');
                const year = date.getUTCFullYear();
                const month = date.getUTCMonth(); // 0-11
                
                // Initialize year if not exists
                if (!yearlySupplyMap[year]) {
                    yearlySupplyMap[year] = { year, supply: record.supply, month: month, lastMonth: record.month };
                }
                
                // Update with December data (month 11) if available, otherwise keep latest month
                if (month === 11 || record.month > yearlySupplyMap[year].lastMonth) {
                    yearlySupplyMap[year].supply = record.supply;
                    yearlySupplyMap[year].month = month;
                    yearlySupplyMap[year].lastMonth = record.month;
                }
            });
            
            // Update yearly data based on monthly data
            Object.values(yearlySupplyMap).forEach(yearInfo => {
                let yearRecord = yearlyData.find(d => d.year === yearInfo.year);
                
                // Create new year record if doesn't exist
                if (!yearRecord) {
                    yearRecord = { year: yearInfo.year, supply: 0, change: 0 };
                    yearlyData.push(yearRecord);
                    console.log(`Added new record for year ${yearInfo.year}.`);
                }
                
                // Update supply for this year
                yearRecord.supply = yearInfo.supply;
                
                // Calculate change percentage
                const previousYearRecord = yearlyData.find(d => d.year === yearInfo.year - 1);
                if (previousYearRecord) {
                    const prevSupply = Number(previousYearRecord.supply);
                    if (prevSupply > 0) {
                        const changePercent = ((yearRecord.supply - prevSupply) / prevSupply) * 100;
                        yearRecord.change = Math.round(changePercent);
                    }
                }
                
                console.log(`Updated year ${yearInfo.year}: supply=${yearRecord.supply}, change=${yearRecord.change}%`);
            });
            
            // 驗證年度數據完整性並標記歷史記錄
            console.log(`Validating yearly data consistency for ${coin.toUpperCase()}...`);
            const validationIssues = [];
            
            yearlyData.forEach(yearRecord => {
                const monthlyRecordsForYear = fullMonthlyHistory.filter(m => 
                    m.month.startsWith(yearRecord.year.toString())
                );
                
                if (monthlyRecordsForYear.length === 0) {
                    validationIssues.push({
                        year: yearRecord.year,
                        issue: 'no_monthly_data',
                        message: `Year ${yearRecord.year} has no corresponding monthly data - likely historical record`
                    });
                } else {
                    // 檢查年度數據是否與最新月度數據一致
                    const latestMonthly = monthlyRecordsForYear[monthlyRecordsForYear.length - 1];
                    if (yearRecord.supply !== latestMonthly.supply) {
                        validationIssues.push({
                            year: yearRecord.year,
                            issue: 'data_mismatch',
                            message: `Year ${yearRecord.year}: yearly=${yearRecord.supply} vs monthly=${latestMonthly.supply}`
                        });
                    }
                }
            });
            
            // 報告驗證結果
            if (validationIssues.length > 0) {
                console.warn(`⚠️  Yearly data validation issues for ${coin.toUpperCase()}:`);
                validationIssues.forEach(issue => {
                    if (issue.issue === 'no_monthly_data') {
                        console.warn(`   📋 ${issue.message}`);
                    } else {
                        console.warn(`   ❌ ${issue.message}`);
                    }
                });
            } else {
                console.log(`✅ All yearly data validation passed for ${coin.toUpperCase()}`);
            }
            
            // Sort yearly data and persist
            yearlyData.sort((a, b) => a.year - b.year);
            performanceTracker.start('Write-Yearly-CSV');
            await writeCsv(coinConfig.yearlyHistoryFile, yearlyData, ['year', 'supply', 'change']);
            performanceTracker.end('Write-Yearly-CSV');
            console.log(`Updated and persisted yearly data based on monthly records.`);
        }
        
        // 3. Fetch latest chain distribution
        const chainData = await fetchChainDistribution(coinConfig.llamaSymbol);

        // 4. Consolidate and write to data.json
        performanceTracker.start('Update-Data-JSON');
        const finalData = {
            monthly: fullMonthlyHistory,
            yearly: yearlyData, // Use the dynamically updated yearly data
            chains: chainData,
            last_updated: new Date().toISOString()
        };
        await updateDataJson(coin, finalData);
        performanceTracker.end('Update-Data-JSON');

        console.log(`--- Update Complete for ${coin.toUpperCase()} ---`);

        // 輸出性能報告
        performanceTracker.logSummary();
        performanceTracker.detectSlowOperations();

    } catch (error) {
        const classifiedError = classifyError(error, `Main Process - ${coin.toUpperCase()}`);
        logError(classifiedError, 'FATAL ERROR');
        
        // 根據錯誤類型設置不同的退出碼
        let exitCode = 1;
        if (classifiedError instanceof APIError) {
            exitCode = classifiedError.retryable ? 2 : 3; // 2: retryable API error, 3: non-retryable
        } else if (classifiedError instanceof DataError) {
            exitCode = 4; // Data validation or processing error
        }
        
        process.exit(exitCode);
    }
}

main(); 
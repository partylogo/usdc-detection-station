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
    console.log(`Fetching 365-day historical data for ${coinId} from CoinGecko...`);
    // We only fetch 365 days, as we merge this with our persistent history.
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=365&interval=daily`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`CoinGecko API failed for ${coinId}: ${response.statusText}`);
    
    const data = await response.json();
    const monthlyData = {};
    data.market_caps.forEach(([timestamp, marketCap]) => {
        const date = new Date(timestamp);
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth(); // 0-11
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        // We take the last value for each month, as daily data can be noisy.
        monthlyData[key] = {
            month: key, // Use 'YYYY-MM' format as the unique key
            supply: Math.round(marketCap / 1000000), // in millions
            change: 0 // Will be calculated later
        };
    });
    
    console.log(`Successfully processed CoinGecko data for ${coinId}.`);
    return Object.values(monthlyData);
}

function mergeMonthlyHistory(historicalData, newData) {
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

    console.log('Successfully merged and recalculated monthly history.');
    return merged;
}

async function fetchChainDistribution(symbol) {
    console.log(`Fetching chain distribution for ${symbol} from DefiLlama...`);
    const response = await fetch('https://stablecoins.llama.fi/stablecoins');
    if (!response.ok) throw new Error(`DefiLlama API failed: ${response.statusText}`);
    
    const data = await response.json();
    const coinData = data.peggedAssets.find(asset => asset.symbol === symbol);
    if (!coinData || !coinData.chainCirculating) throw new Error(`${symbol} data not found in DefiLlama response`);

    const chainData = coinData.chainCirculating;
    const transformedChains = [];
    let totalChainSupply = Object.values(chainData).reduce((sum, chain) => sum + (chain.current?.peggedUSD || 0), 0);
    if (totalChainSupply === 0) throw new Error(`Total supply for ${symbol} from DefiLlama is zero.`);

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
        const monthlyHistoricalData = await readCsv(coinConfig.monthlyHistoryFile);
        const newMonthlyData = await fetchMonthlyHistory(coinConfig.coingeckoId);
        const fullMonthlyHistory = mergeMonthlyHistory(monthlyHistoricalData, newMonthlyData);
        await writeCsv(coinConfig.monthlyHistoryFile, fullMonthlyHistory, ['month', 'supply', 'change']);

        // 2. Read and dynamically update yearly data
        const yearlyData = await readCsv(coinConfig.yearlyHistoryFile);
        
        // --- Logic to update current year's supply ---
        if (fullMonthlyHistory.length > 0) {
            const latestMonthlyRecord = fullMonthlyHistory[fullMonthlyHistory.length - 1];
            const currentYear = new Date(latestMonthlyRecord.month).getFullYear();
            let currentYearRecord = yearlyData.find(d => d.year === currentYear);

            // If the current year doesn't exist in the yearly data, create it.
            if (!currentYearRecord) {
                currentYearRecord = { year: currentYear, supply: 0, change: 0 };
                yearlyData.push(currentYearRecord);
                yearlyData.sort((a, b) => a.year - b.year); // Keep it sorted
                console.log(`Added new record for year ${currentYear}.`);
            }

            // Update the supply for the current year
            currentYearRecord.supply = latestMonthlyRecord.supply;
            
            // Recalculate change percentage for the current year
            const previousYearRecord = yearlyData.find(d => d.year === currentYear - 1);
            if (previousYearRecord) {
                const prevSupply = Number(previousYearRecord.supply);
                if (prevSupply > 0) {
                    const changePercent = ((currentYearRecord.supply - prevSupply) / prevSupply) * 100;
                    currentYearRecord.change = Math.round(changePercent);
                }
            }
            
            // Persist the potentially updated yearly data back to its CSV
            await writeCsv(coinConfig.yearlyHistoryFile, yearlyData, ['year', 'supply', 'change']);
            console.log(`Dynamically updated and persisted yearly data for ${currentYear}.`);
        }
        
        // 3. Fetch latest chain distribution
        const chainData = await fetchChainDistribution(coinConfig.llamaSymbol);

        // 4. Consolidate and write to data.json
        const finalData = {
            monthly: fullMonthlyHistory,
            yearly: yearlyData, // Use the dynamically updated yearly data
            chains: chainData,
            last_updated: new Date().toISOString()
        };
        await updateDataJson(coin, finalData);

        console.log(`--- Update Complete for ${coin.toUpperCase()} ---`);

    } catch (error) {
        console.error(`\nFATAL ERROR during update for ${coin.toUpperCase()}:`, error.message);
        process.exit(1);
    }
}

main(); 
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const APP_JS_PATH = path.join(__dirname, 'app.js');
const MONTHLY_CSV_PATH = path.join(__dirname, 'usdc_monthly_supply.csv');
const YEARLY_CSV_PATH = path.join(__dirname, 'usdc_yearly_supply.csv');
const CHAIN_CSV_PATH = path.join(__dirname, 'usdc_chain_distribution.csv');

// --- API Fetching Functions ---

async function fetchMonthlyHistory() {
    console.log('Fetching 1-year historical data from CoinGecko...');
    try {
        const url = 'https://api.coingecko.com/api/v3/coins/usd-coin/market_chart?vs_currency=usd&days=365&interval=daily';
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`CoinGecko API failed: ${response.statusText}`);
        }
        const data = await response.json();
        
        // Process data to get one entry per month (last day of the month)
        const monthlyData = {};
        data.market_caps.forEach(([timestamp, marketCap]) => {
            const date = new Date(timestamp);
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth(); // 0-11
            // Always store the latest entry for that month
            monthlyData[`${year}-${month}`] = {
                date: `${year}-${String(month + 1).padStart(2, '0')}`,
                supply: Math.round(marketCap / 1000000), // in millions
                year,
                month: month + 1
            };
        });

        // Add last available day of the current month
         if(data.market_caps.length > 0){
            const lastEntry = data.market_caps[data.market_caps.length - 1];
            const lastDate = new Date(lastEntry[0]);
            const year = lastDate.getUTCFullYear();
            const month = lastDate.getUTCMonth();
            monthlyData[`${year}-${month}`] = {
                date: `${year}-${String(month + 1).padStart(2, '0')}`,
                supply: Math.round(lastEntry[1] / 1000000),
                year,
                month: month + 1
            };
        }

        console.log('Successfully processed monthly historical data.');
        return Object.values(monthlyData);
    } catch (error) {
        console.error('Failed to fetch or process monthly history:', error);
        return null;
    }
}


async function fetchChainDistribution() {
    console.log('Fetching chain distribution from DefiLlama...');
    try {
        const response = await fetch('https://stablecoins.llama.fi/stablecoins');
        if (!response.ok) {
            throw new Error(`DefiLlama API failed: ${response.statusText}`);
        }
        const data = await response.json();
        const usdcData = data.peggedAssets.find(asset => asset.id === "1");

        if (!usdcData || !usdcData.chainCirculating) {
            throw new Error('USDC data not found in DefiLlama response');
        }

        const chainData = usdcData.chainCirculating;
        const transformedChains = [];
        let totalChainSupply = 0;

        for (const chainName in chainData) {
            totalChainSupply += chainData[chainName]?.current?.peggedUSD || 0;
        }

        if (totalChainSupply === 0) throw new Error("Total supply from DefiLlama is zero.");

        let othersAmount = 0;
        let othersCount = 0;
        
        const sortedChains = Object.entries(chainData).sort(([,a],[,b]) => (b.current?.peggedUSD || 0) - (a.current?.peggedUSD || 0));

        sortedChains.forEach(([chainName, chain], index) => {
            const amount = chain.current?.peggedUSD || 0;
            if (amount > 0) {
                 const amountInMillions = amount / 1000000;
                if (index >= 8 || (amount / totalChainSupply) < 0.005) {
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
                percentage: parseFloat(((othersAmount*1000000 / totalChainSupply) * 100).toFixed(1))
            });
        }
        
        console.log('Successfully processed chain distribution data.');
        return transformedChains;

    } catch (error) {
        console.error('Failed to fetch or process chain distribution:', error);
        return null;
    }
}

// --- Data Processing and File Writing ---

function calculateYearlySummary(monthlyData) {
    const yearlySummary = {};
    monthlyData.forEach(item => {
        if (!yearlySummary[item.year]) {
            yearlySummary[item.year] = { year: item.year, lastSupply: 0 };
        }
        if (item.month === 12) {
             yearlySummary[item.year].lastSupply = item.supply;
        }
    });

     // For current year, use the latest available month's supply
    const currentYear = new Date().getFullYear();
    if(yearlySummary[currentYear]){
        const latestMonthForCurrentYear = monthlyData.filter(d => d.year === currentYear).sort((a,b) => b.month - a.month)[0];
        if(latestMonthForCurrentYear){
             yearlySummary[currentYear].lastSupply = latestMonthForCurrentYear.supply;
        }
    }


    const result = Object.values(yearlySummary).map((data, index, arr) => {
        const prevYearSupply = index > 0 ? arr[index - 1].lastSupply : data.lastSupply;
        return {
            year: data.year,
            supply: data.lastSupply,
            change: data.lastSupply - prevYearSupply,
        };
    });
    console.log('Successfully calculated yearly summary.');
    return result;
}

function toCsv(data, headers) {
    const headerRow = headers.join(',');
    const rows = data.map(row => headers.map(header => row[header]).join(','));
    return [headerRow, ...rows].join('\n');
}

async function updateStaticFiles(monthly, yearly, chains) {
    console.log('Starting to update static files...');

    // 1. Update CSV files
    fs.writeFileSync(MONTHLY_CSV_PATH, toCsv(monthly, ['date', 'supply', 'year', 'month']), 'utf-8');
    console.log(`Updated ${MONTHLY_CSV_PATH}`);
    
    fs.writeFileSync(YEARLY_CSV_PATH, toCsv(yearly, ['year', 'supply', 'change']), 'utf-8');
    console.log(`Updated ${YEARLY_CSV_PATH}`);

    fs.writeFileSync(CHAIN_CSV_PATH, toCsv(chains, ['chain', 'amount', 'percentage']), 'utf-8');
    console.log(`Updated ${CHAIN_CSV_PATH}`);
    
    // 2. Update app.js
    let appJsContent = fs.readFileSync(APP_JS_PATH, 'utf-8');

    const monthlyString = JSON.stringify(monthly, null, 4);
    appJsContent = appJsContent.replace(/monthly: \[\s*([\s\S]*?)\s*\],/m, `monthly: ${monthlyString},`);

    const yearlyString = JSON.stringify(yearly, null, 4);
    appJsContent = appJsContent.replace(/yearly: \[\s*([\s\S]*?)\s*\],/m, `yearly: ${yearlyString},`);

    const chainsString = JSON.stringify(chains, null, 4);
    appJsContent = appJsContent.replace(/chains: \[\s*([\s\S]*?)\s*\]/m, `chains: ${chainsString}`);
    
    // Update the current supply as well
    const latestSupply = monthly[monthly.length-1].supply;
    appJsContent = appJsContent.replace(/(current: \{\s*total_supply: )\d+,/m, `$1${latestSupply},`);
    appJsContent = appJsContent.replace(/(market_cap: )\d+,/m, `$1${latestSupply},`);
    appJsContent = appJsContent.replace(/(fdv: )\d+,/m, `$1${latestSupply},`);
    
    const lastUpdatedDate = new Date().toISOString().split('T')[0];
    appJsContent = appJsContent.replace(/(last_updated: )".*?",/m, `$1"${lastUpdatedDate}",`);


    fs.writeFileSync(APP_JS_PATH, appJsContent, 'utf-8');
    console.log(`Updated ${APP_JS_PATH}`);

    console.log('All static files updated successfully!');
}


// --- Main Execution ---

async function main() {
    console.log('--- Running USDC Data Updater ---');
    
    const monthlyData = await fetchMonthlyHistory();
    const chainData = await fetchChainDistribution();

    if (!monthlyData || !chainData) {
        console.error('Failed to fetch required data. Aborting update.');
        process.exit(1);
    }
    
    const yearlyData = calculateYearlySummary(monthlyData);
    
    await updateStaticFiles(monthlyData, yearlyData, chainData);
    
    console.log('--- Update Complete ---');
}

main(); 
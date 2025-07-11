/**
 * ===============================================================================================
 * Stablecoin Detection Station - Main Application Logic (v2.0 Refactored)
 * ===============================================================================================
 * This script implements a data-driven UI rendering engine. It fetches consolidated
 * data from data.json and dynamically populates a single HTML template based on
 * the application's state, primarily the currently active coin.
 */

// --- Application State ---
const state = {
    activeCoin: 'usdc', // Default active coin
    data: {},           // Cache for all fetched coin data
    charts: {           // Cache for chart instances to allow proper destruction
        monthly: null,
        yearly: null,
        chain: null,
    }
};

// --- DOM Element References ---
// We cache the DOM elements we'll be manipulating repeatedly.
const elements = {
    lastUpdated: document.getElementById('last-updated'),
    currentCoinTitle: document.getElementById('current-coin-title'),
    currentCoinSubtitle: document.getElementById('current-coin-subtitle'),
    totalSupply: document.getElementById('total-supply'),
    quarterlyGrowth: document.getElementById('quarterly-growth'),
    avg12mGrowth: document.getElementById('12m-growth'),
    avg3mGrowth: document.getElementById('3m-growth'),
    monthlyChartCanvas: document.getElementById('monthly-chart'),
    yearlyChartCanvas: document.getElementById('yearly-chart'),
    chainDistTitle: document.getElementById('chain-dist-title'),
    chainDistSubtitle: document.getElementById('chain-dist-subtitle'),
    chainChartCanvas: document.getElementById('chain-chart'),
    chainTableBody: document.getElementById('chain-table-body'),
    systemTime: document.getElementById('systemTime'),
};


// --- Core Rendering Engine ---

/**
 * Renders all UI components based on the data for the given coin.
 * This is the single source of truth for updating the view.
 * @param {string} coin - The key for the coin to render (e.g., 'usdc').
 */
function render(coin) {
    const coinData = state.data[coin];
    if (!coinData) {
        console.error(`No data available for ${coin}.`);
        // Optionally, render an error state in the UI
        document.querySelector('.dashboard').innerHTML = `<p style="color: red; text-align: center;">Data for ${coin.toUpperCase()} could not be loaded.</p>`;
        return;
    }
    
    const coinName = coin.toUpperCase();

    // Update metrics
    elements.lastUpdated.textContent = new Date(coinData.last_updated).toLocaleDateString();
    elements.currentCoinTitle.textContent = `目前 ${coinName} 總發行量`;
    elements.currentCoinSubtitle.textContent = `Current ${coinName} Total Supply`;
    
    const latestMonthly = coinData.monthly[coinData.monthly.length - 1];
    elements.totalSupply.textContent = (latestMonthly.supply / 100).toFixed(1);

    if (coinData.monthly.length >= 4) {
        const threeMonthsAgo = coinData.monthly[coinData.monthly.length - 4];
        const quarterlyGrowthValue = (latestMonthly.supply - threeMonthsAgo.supply) / 100; // in hundreds of millions (億)
        
        elements.quarterlyGrowth.textContent = `${quarterlyGrowthValue >= 0 ? '+' : ''}${quarterlyGrowthValue.toFixed(1)}億`;
        elements.quarterlyGrowth.style.color = quarterlyGrowthValue >= 0 ? 'var(--green-positive)' : 'var(--red-negative)';
            } else {
        elements.quarterlyGrowth.textContent = 'N/A';
    }
    
    // Note: Growth calculation can be further refined, simplified for this example.
    elements.avg12mGrowth.textContent = calculateAverageGrowth(coinData.monthly, 12) + '%';
    elements.avg3mGrowth.textContent = calculateAverageGrowth(coinData.monthly, 3) + '%';

    // Update charts
    createMonthlyChart(coinData.monthly, coinName);
    createYearlyChart(coinData.yearly, coinName);
    createChainChart(coinData.chains, coinName);

    // Update table
    elements.chainDistTitle.textContent = `${coinName} 在不同鏈的分布`;
    elements.chainDistSubtitle.textContent = `${coinName} Distribution Across Chains`;
    updateChainTable(coinData.chains);
}

// --- Helper & Charting Functions ---

function calculateAverageGrowth(monthlyData, months) {
    const periodData = monthlyData.slice(-(months + 1));
    if(periodData.length < 2) return 'N/A';
    let totalGrowth = 0;
    for (let i = 1; i < periodData.length; i++) {
        const prev = periodData[i-1].supply;
        const curr = periodData[i].supply;
        if(prev > 0) totalGrowth += (curr - prev) / prev;
    }
    return ((totalGrowth / (periodData.length - 1)) * 100).toFixed(1);
}

function createMonthlyChart(data, coinName) {
    if (state.charts.monthly) state.charts.monthly.destroy();
    
    const chartData = data.slice(-16);
    const growthData = [0];
    for (let i = 1; i < chartData.length; i++) {
        const prev = chartData[i-1].supply;
        const curr = chartData[i].supply;
        growthData.push(prev > 0 ? ((curr - prev) / prev) * 100 : 0);
    }

    const growthBarColors = growthData.map(g => g >= 0 ? 'rgba(75, 192, 192, 0.3)' : 'rgba(255, 99, 132, 0.3)');

    state.charts.monthly = new Chart(elements.monthlyChartCanvas, {
        type: 'bar',
        data: {
            labels: chartData.map(d => d.month), // Changed from d.date to d.month
            datasets: [{
                type: 'line',
                label: `${coinName} Supply (Billions)`,
                data: chartData.map(d => d.supply / 1000),
                yAxisID: 'y-supply',
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
            }, {
                    type: 'bar',
                label: 'Monthly Growth %',
                data: growthData,
                yAxisID: 'y-growth',
                backgroundColor: growthBarColors,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                'y-supply': {
                    position: 'left',
                    title: { display: true, text: 'Supply (Billions)' },
                    ticks: { callback: value => `$${value}B` }
                },
                'y-growth': {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Growth (%)' },
                    ticks: { callback: value => `${value.toFixed(1)}%` }
                }
            }
        }
    });
}

function createYearlyChart(data, coinName) {
    if (state.charts.yearly) state.charts.yearly.destroy();
    // const chartData = data.slice(-4); // No longer needed, backend provides the correct data.
    state.charts.yearly = new Chart(elements.yearlyChartCanvas, {
        type: 'bar',
        data: {
            labels: data.map(d => d.year),
            datasets: [{
                label: `E.O.Y. Supply (Billions)`,
                data: data.map(d => d.supply / 1000),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { ticks: { callback: value => `$${value}B` } } }
        }
    });
}

function createChainChart(data, coinName) {
    if (state.charts.chain) state.charts.chain.destroy();
    state.charts.chain = new Chart(elements.chainChartCanvas, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.chain),
            datasets: [{
                data: data.map(d => d.amount),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#E7E9ED'],
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });
}

function updateChainTable(data) {
    elements.chainTableBody.innerHTML = '';
    const totalAmount = data.reduce((sum, chain) => sum + chain.amount, 0);

    data.forEach(chain => {
        const row = elements.chainTableBody.insertRow();
        row.className = 'chain-row';

        // Cell 1: Chain Name
        const nameCell = row.insertCell();
        nameCell.className = 'chain-name-cell';
        nameCell.innerHTML = `
            <span class="chain-indicator" style="background-color: ${getChainColor(chain.chain, data)};"></span>
            <span>${chain.chain}</span>
        `;

        // Cell 2: Supply
        const amountCell = row.insertCell();
        amountCell.className = 'align-right';
        amountCell.textContent = `$${(chain.amount / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}B`;

        // Cell 3: Share
        const shareCell = row.insertCell();
        shareCell.className = 'align-right';
        const percentage = totalAmount > 0 ? (chain.amount / totalAmount) * 100 : 0;
        shareCell.textContent = `${percentage.toFixed(1)}%`;
    });
}

const chainColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#E7E9ED'];

function getChainColor(chainName, allChains) {
    const index = allChains.findIndex(c => c.chain === chainName);
    return chainColors[index % chainColors.length];
}


// --- Initialization ---

async function init() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        state.data = await response.json();
        
        // Initial render
        render(state.activeCoin);

        // Setup tab listeners
        document.querySelector('.header-tabs').addEventListener('click', (e) => {
            const tab = e.target.closest('.tab');
            if (tab && tab.dataset.coin !== state.activeCoin) {
                state.activeCoin = tab.dataset.coin;
                // Update active class
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                // Re-render with new coin
                render(state.activeCoin);
            }
        });

        // Update system time every second
        setInterval(() => {
            elements.systemTime.textContent = new Date().toLocaleString();
        }, 1000);
        
    } catch (error) {
        console.error("Failed to initialize the application:", error);
        document.querySelector('.dashboard').innerHTML = `<p style="color: red; text-align: center;">Could not load dashboard data. Please try again later.</p>`;
    }
}

document.addEventListener('DOMContentLoaded', init);




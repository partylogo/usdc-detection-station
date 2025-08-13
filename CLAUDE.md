# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Starting the Application
```bash
npm start              # Start local HTTP server using http-server
```

### Data Management
```bash
npm run update:usdc    # Update USDC data from APIs
npm run update:usdt    # Update USDT data from APIs  
npm run update:all     # Update all coin data (USDC + USDT)
```

### Local Development Setup
```bash
npm install            # Install dependencies
npm run update:all     # Fetch initial data
npm start              # Start local server (http-server on port 8080)
```

Alternative local server:
```bash
python3 -m http.server 8000    # Alternative HTTP server
```

## Architecture Overview

This is a **static web application** with automated data updates. The architecture follows a semi-decoupled pattern:

### Data Flow
```
External APIs → Node.js Script → CSV Storage → JSON Cache → Frontend Rendering
```

### Core Components

**1. Data Processing Layer (`update-data.js`)**
- Fetches data from CoinGecko API (365-day historical market cap as supply proxy)
- Fetches chain distribution from DefiLlama API
- Merges new data with persistent CSV history to maintain long-term records
- Automatically calculates monthly/yearly growth percentages
- **Enhanced Error Handling**: Structured error classification (APIError, DataError) with intelligent retry logic
- **Performance Monitoring**: Real-time tracking of operation performance and memory usage
- **Data Validation**: Comprehensive data completeness checks and anomaly detection
- **Precision Handling**: Safe rounding for large numbers to prevent precision loss
- Outputs consolidated data to `data.json`

**2. Data Persistence (`*_supply.csv` files)**
- `usdc_monthly_supply.csv` / `usdt_monthly_supply.csv` - Monthly historical data
- `usdc_yearly_supply.csv` / `usdt_yearly_supply.csv` - Yearly aggregated data
- CSV format: `month/year,supply,change` where supply is in millions USD

**3. Frontend Application**
- **Single-page application** using vanilla JavaScript (no framework)
- `index.html` - Unified template for all stablecoins
- `app.js` - Data-driven rendering engine with coin switching logic
- `style.css` - Complete styling with responsive design
- Uses Chart.js for data visualization

**4. Automation (`.github/workflows/update-data.yml`)**
- Runs daily at 02:00 UTC via GitHub Actions
- Executes `npm run update:all`
- Auto-commits data changes back to repository

### Key Architecture Patterns

**State Management**: Single `state` object in `app.js` tracks active coin and cached data
**Rendering**: Core `render(coin)` function updates entire UI based on selected coin
**Data Caching**: All API data is pre-processed and served as static `data.json`

## Adding New Stablecoins

To add a new stablecoin (e.g., DAI):

1. **Update Backend Config** in `update-data.js`:
```javascript
const COINS = {
    // existing coins...
    dai: {
        coingeckoId: 'dai',  // Must match CoinGecko API ID
        llamaSymbol: 'DAI',  // Must match DefiLlama symbol
        monthlyHistoryFile: path.join(__dirname, 'dai_monthly_supply.csv'),
        yearlyHistoryFile: path.join(__dirname, 'dai_yearly_supply.csv')
    }
};
```

2. **Create CSV History Files**:
- Create `dai_monthly_supply.csv` and `dai_yearly_supply.csv` with headers: `month,supply,change` / `year,supply,change`
- Pre-populate with some historical data to ensure proper chart rendering

3. **Add Frontend Tab** in `index.html`:
```html
<div class="header-tabs">
    <!-- existing tabs -->
    <div class="tab" data-coin="dai">DAI</div>
</div>
```

4. **Test Locally**:
```bash
node update-data.js --coin=dai    # Generate initial data
npm start                         # Test in browser
```

## Important Implementation Notes

- **API Dependencies**: CoinGecko (market cap), DefiLlama (chain distribution)
- **Data Units**: All supply values stored in millions USD, displayed as "億" (hundreds of millions)
- **Chart Library**: Chart.js with mixed chart types (line + bar for monthly trends)
- **Responsive Design**: Mobile-first CSS with desktop optimizations
- **Chinese Localization**: UI fully localized to Traditional Chinese
- **No Build Process**: Pure static files, no compilation required

## Advanced Features

### Error Handling & Monitoring
- **Smart Error Classification**: Automatic categorization of network, API, validation, and file system errors
- **Retry Strategy**: Exponential backoff with retryable/non-retryable error detection
- **Exit Codes**: Different exit codes for various error types (API: 2/3, Data: 4, General: 1)
- **Performance Tracking**: Detailed timing metrics for all operations with memory usage monitoring
- **Data Quality Assurance**: Gap detection, anomaly warnings, and historical data validation

### Data Processing Enhancements
- **Precision Management**: SafeRound function prevents large number precision loss
- **UTC Standardization**: All date/time operations use UTC timezone for consistency
- **Completeness Validation**: Identifies missing months and validates yearly data consistency
- **Historical Record Detection**: Automatically identifies records without corresponding monthly data
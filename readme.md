# 穩定幣檢測站 (Stablecoin Detection Station)

這是一個輕量級的穩定幣數據監控儀表板，旨在提供關鍵穩定幣（如 USDC, USDT）的供應量、歷史趨勢和鏈上分布的視覺化分析。專案採用了自動化的數據更新機制，並透過一個可擴展的前端架構來呈現數據。

## 程式架構總覽

本專案採用半分離式架構，由一個 Node.js 資料處理層和一個純粹的香草 JS (Vanilla JS) 前端渲染層組成，並透過 GitHub Actions 實現每日自動數據更新。

### 資料流 (Data Flow)

數據的完整生命週期如下：

`外部 API -> 後端腳本 -> CSV 持久化 -> JSON 快取 -> 前端渲染`

---

### 1. 資料處理層 (`update-data.js`)

這是專案的核心數據引擎。它並不是一個持續運行的後端服務，而是一個可以被手動或定時任務觸發的 Node.js 腳本。

- **數據來源**:
    - **CoinGecko API**: 用於獲取穩定幣過去一年的每日市值 (Market Cap)，此數據被用作供應量的代理。
    - **DefiLlama API**: 用於獲取穩定幣在不同區塊鏈上的實時分布數據。
- **核心邏輯**:
    1. 讀取本地的歷史數據 (`*.csv` 檔案)。
    2. 從 API 抓取最新的數據。
    3. 將新舊數據合併，用 API 的新數據覆蓋掉歷史數據中的重疊部分，確保數據的準確性。
    4. 重新計算完整的增長率等衍生指標。
    5. 將合併和處理後的數據，寫回下方的持久化層和快取層。

### 2. 資料持久化層 (`*_supply.csv`)

由於 CoinGecko 等免費 API 通常只提供最近 365 天的數據，為了能夠進行長期的年度趨勢分析，我們需要一個持久化機制來儲存超過一年的歷史數據。

- **檔案**: `usdc_monthly_supply.csv`, `usdc_yearly_supply.csv` 等。
- **作用**: 這些 CSV 檔案是我們的「長期記憶體」。`update-data.js` 每次運行時，都會先讀取它們，然後追加或更新最新的數據，再寫回去。這使得我們的歷史數據能夠不斷累積，不受 API 的時間窗口限制。

### 3. 資料快取層 (`data.json`)

這個檔案是後端腳本和前端應用之間的橋樑。

- **作用**: `update-data.js` 每次成功執行後，都會將所有需要呈現給用戶的、處理好的數據（包含月度、年度、鏈分布和更新時間戳）寫入這個單一的 JSON 檔案。
- **優點**: 前端不需要關心複雜的數據處理邏輯，只需要請求這一個簡單、乾淨的 `data.json` 即可獲取所有需要的資訊，極大地簡化了前端的複雜度。

### 4. 前端渲染層 (HTML/CSS/JS)

前端是一個純粹的靜態網站，不依賴任何複雜的框架（如 React, Vue）。

- **`index.html`**: 提供了一個通用的 UI 模板，所有的穩定幣都共用這一套 HTML 結構。
- **`style.css`**: 專案的所有樣式。
- **`app.js`**: 前端的核心邏輯。
    - **渲染引擎**: 包含一個核心的 `render(coin)` 函式。當用戶切換 Tab (如 USDC/USDT) 時，此函式會被觸發。
    - **數據驅動**: 它會從 `data.json` 中讀取對應幣種的數據，然後動態地將這些數據填充到 `index.html` 的 UI 模板中，並使用 Chart.js 來繪製圖表。

### 5. 自動化層 (`.github/workflows/update-data.yml`)

為了確保數據能被定期更新，我們使用 GitHub Actions 來自動化執行資料處理腳本。

- **觸發機制**:
    - **定時觸發**: 每天 UTC 時間凌晨 2 點（台北時間上午 10 點）會自動執行。
    - **手動觸發**: 可以隨時在 GitHub 的 "Actions" 頁面手動觸發此流程。
- **核心流程**:
    1. 設定 Node.js 環境並安裝依賴 (`npm install`)。
    2. 執行 `npm run update:all`，這個命令會依次更新所有在 `update-data.js` 中設定的幣種。
    3. **自動提交**: 腳本執行完畢後，如果 `data.json` 或任何 `.csv` 檔案有變更，Action 會自動將這些變更 `commit` 並 `push` 回 `main` 分支。

---

## 如何新增一個穩定幣 (例如：DAI)

這份指南將引導你如何為儀表板添加一個新的穩定幣。

### Step 1: 修改後端設定檔

打開 `update-data.js`，找到 `COINS` 這個設定物件。在裡面為 `dai` 新增一個條目。

```javascript
const COINS = {
    usdc: { /* ... */ },
    usdt: { /* ... */ },
    dai: {
        coingeckoId: 'dai', // **坑1**: 必須是 CoinGecko API URL 中的 ID
        llamaSymbol: 'DAI',  // **坑2**: 必須是 DefiLlama API 回傳的 symbol
        monthlyHistoryFile: path.join(__dirname, 'dai_monthly_supply.csv'),
        yearlyHistoryFile: path.join(__dirname, 'dai_yearly_supply.csv')
    }
};
```

- **坑1 & 2 (API ID)**: `coingeckoId` 和 `llamaSymbol` **至關重要**。你需要去對應的 API 文件或實際請求一次來確認正確的 ID。例如，DAI 在 CoinGecko 的 ID 是 `dai`，在 DefiLlama 的符號是 `DAI`。如果填錯，腳本會執行失敗。

### Step 2: 建立並填充歷史數據檔案

這是最容易出錯的一步。你需要手動在專案根目錄下建立兩個新的 CSV 檔案：

1.  `dai_monthly_supply.csv`
2.  `dai_yearly_supply.csv`

**坑3 (數據格式一致性)**:
這兩個檔案的內容格式**必須**和腳本生成（或現有的 `usdc_*.csv`）的格式完全一致。

**`dai_monthly_supply.csv` 範例:**
```csv
month,supply,change
2023-01,5234,0
2023-02,5111,-2
```
- `month`: 格式必須是 `YYYY-MM`。
- `supply`: 必須是純數字（單位：百萬），不要加引號或貨幣符號。
- `change`: 初始值可以是 `0`，腳本會在第一次运行时重新计算。

**`dai_yearly_supply.csv` 範例:**
```csv
year,supply,change
2022,5890,0
2023,5348,-9
```
- `year`: 必須是純數字。
- `supply` / `change`: 同上。

> **強烈建議**: 至少手動為新幣種填寫幾個月或一年的歷史數據。如果讓檔案保持空白，圖表可能會因為數據點不足而無法正確顯示。

### Step 3: 更新前端介面

打開 `index.html`，在 `<header>` 區塊找到 class 為 `header-tabs` 的 `div`，在裡面新增一個 DAI 的 Tab。

```html
<div class="header-tabs">
    <div class="tab active" data-coin="usdc">USDC</div>
    <div class="tab" data-coin="usdt">USDT</div>
    <!-- 在這裡新增 DAI -->
    <div class="tab" data-coin="dai">DAI</div>
</div>
```
- `data-coin` 屬性的值 (`dai`) 必須和你在 `update-data.js` 中設定的 key 完全一致。

### Step 4: 在本地執行初次數據更新

為了在 `data.json` 中生成 DAI 的數據，你需要在終端機中手動執行一次更新腳本。

```bash
node update-data.js --coin=dai
```

如果執行成功，你會看到 `data.json` 檔案被更新，裡面會出現一個新的 `dai` 物件。

### Step 5: 本地測試與提交

1.  執行 `npm start` 啟動本地伺服器。
2.  打開 `http://localhost:8080`，切換到 DAI 的 Tab，確認所有圖表和數據都顯示正常。
3.  確認無誤後，將所有變更和新檔案 (`update-data.js`, `index.html`, `dai_monthly_supply.csv`, `dai_yearly_supply.csv`) commit 並 push 到 GitHub。

### 額外需要注意的坑

- **坑4 (GitHub Action 同步衝突)**: 如果你 push 程式碼後，發現自動更新的 Action 執行失敗，且錯誤是 `non-fast-forward`，這代表在你 push 的同時，Action 也被觸發了。**解決方法**: 等你 push 完成後，去 "Actions" 分頁手動 "Re-run" 一次失敗的 workflow 即可。
- **坑5 (瀏覽器快取)**: 如果你確定後端數據已更新，但前端畫面還是舊的，請嘗試**強制重新整理 (Cmd+Shift+R 或 Ctrl+Shift+R)**，這通常是瀏覽器快取導致的。

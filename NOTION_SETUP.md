# Notion 集成設置說明

本項目支援使用 Notion 作為說明頁面的內容管理系統。如果不設置 Notion 集成，系統會使用預設的說明內容。

## 設置步驟

### 1. 創建 Notion Integration

1. 前往 [Notion Developers](https://www.notion.so/my-integrations)
2. 點擊 "New integration"
3. 填寫 Integration 名稱（例如："穩定幣觀察站"）
4. 選擇關聯的 workspace
5. 點擊 "Submit" 創建
6. 複製 "Internal Integration Token"（格式：`secret_xxxxx...`）

### 2. 準備 Notion 頁面

1. 在 Notion 中創建一個新頁面作為說明內容
2. 在頁面右上角點擊 "Share"
3. 點擊 "Invite" 並添加你剛創建的 Integration
4. 給予 Integration "Read" 權限
5. 從頁面 URL 中取得 Page ID
   - URL 格式：`https://notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Page ID 就是 URL 最後的 32 位字符串

### 3. 本地開發設置

創建 `.env` 文件在項目根目錄：

```bash
# .env
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_PAGE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

然後運行：
```bash
npm run update:guide
```

### 4. GitHub Actions 設置

在 GitHub repository 中設置 Secrets：

1. 前往 GitHub repository
2. 點擊 "Settings" → "Secrets and variables" → "Actions"
3. 點擊 "New repository secret"
4. 添加以下 secrets：
   - **Name**: `NOTION_TOKEN`  
     **Value**: `secret_xxxxx...`（你的 Integration Token）
   
   - **Name**: `NOTION_PAGE_ID`  
     **Value**: `xxxxxxxx...`（你的 Page ID）

### 5. 驗證設置

設置完成後，GitHub Actions 會自動每天更新說明內容，你也可以手動觸發更新。

## 支援的 Notion 格式

系統支援以下 Notion 格式轉換為 HTML：

- **標題**: Heading 1, 2, 3 → `<h2>`, `<h3>`, `<h4>`
- **段落**: Paragraph → `<p>`
- **列表**: Bulleted/Numbered List → `<ul>/<ol>` 和 `<li>`
- **粗體/斜體**: Bold/Italic → `<strong>/<em>`
- **程式碼**: Code → `<code>`, Code Block → `<pre><code>`
- **引用**: Quote → `<blockquote>`
- **連結**: Link → `<a>`
- **分隔線**: Divider → `<hr>`
- **圖片**: Image → `<img>`
- **提示框**: Callout → 特殊 CSS 樣式的 `<div>`

## 故障排除

### 常見問題

1. **Token 無效**: 確保 Integration Token 正確且有效
2. **頁面無法存取**: 確保頁面已分享給 Integration 且有讀取權限
3. **Page ID 錯誤**: 從 Notion 頁面 URL 正確取得 32 位字符 Page ID

### 檢查日誌

在 GitHub Actions 中查看 "Update Static Data" workflow 的日誌來診斷問題。

### 回退機制

如果 Notion 無法連接或出現錯誤，系統會自動使用預設說明內容，確保網站正常運行。
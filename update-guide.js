require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs').promises;
const path = require('path');

// 預設內容
function getDefaultContent() {
    return `<h2>歡迎使用穩定幣趨勢觀察站</h2>
<p>這是一個追蹤主要穩定幣供應量和鏈分布的數據平台。</p>

<h3>功能介紹</h3>
<ul>
<li><strong>USDC Tab</strong>：查看 USDC 的供應量趨勢和鏈分布</li>
<li><strong>USDT Tab</strong>：查看 USDT 的供應量趨勢和鏈分布</li>
<li><strong>CPP Tab</strong>：連結至 Commerce Payments Protocol 數據面板</li>
</ul>

<h3>數據說明</h3>
<ul>
<li><strong>總發行量</strong>：顯示當前穩定幣的總供應量（單位：億美元）</li>
<li><strong>增長率</strong>：包含最近一季、近12個月和近3個月的平均月增長率</li>
<li><strong>月度趨勢圖</strong>：展示每月供應量變化和增長率</li>
<li><strong>年度趨勢圖</strong>：展示年度供應量變化趨勢</li>
<li><strong>鏈分布</strong>：顯示穩定幣在不同區塊鏈上的分布情況</li>
</ul>

<h3>數據來源</h3>
<p>本站數據來自以下可靠來源：</p>
<ul>
<li><strong>CoinGecko</strong>：提供歷史市值數據作為供應量代理</li>
<li><strong>DefiLlama</strong>：提供鏈分布數據</li>
</ul>

<h3>更新頻率</h3>
<p>數據每日自動更新（UTC 02:00），確保您看到的是最新資訊。</p>

<div class="callout">
<span class="callout-icon">💡</span>
<div class="callout-content">提示：點擊不同的 Tab 可以切換查看不同穩定幣的數據。所有圖表都支援互動操作。</div>
</div>`;
}

// Notion 配置 - 使用環境變數
// 如果需要使用 Notion，請設置以下環境變數：
// NOTION_TOKEN: 你的 Notion Integration Token
// NOTION_PAGE_ID: 你的 Notion 頁面 ID
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PAGE_ID = process.env.NOTION_PAGE_ID;

// 檢查是否配置了 Notion
if (!NOTION_TOKEN || !PAGE_ID) {
    console.log('Notion integration not configured, using default content');
    console.log('To enable Notion integration, set NOTION_TOKEN and NOTION_PAGE_ID environment variables');
    
    // 創建預設內容
    const guideData = {
        title: '使用說明',
        content: getDefaultContent(),
        last_updated: new Date().toISOString(),
        source: 'default'
    };
    
    const outputPath = path.join(__dirname, 'guide.json');
    fs.writeFile(outputPath, JSON.stringify(guideData, null, 2))
        .then(() => {
            console.log('✅ Default guide content created at guide.json');
            process.exit(0);
        })
        .catch(err => {
            console.error('Error writing guide.json:', err);
            process.exit(1);
        });
    return;
}

// 如果配置了 Notion，初始化客戶端
const notion = new Client({
    auth: NOTION_TOKEN
});

// 將 Notion 內容轉換為 HTML
function notionToHtml(blocks) {
    let html = '';
    
    for (const block of blocks) {
        const type = block.type;
        
        switch (type) {
            case 'paragraph':
                const richText = block[type].rich_text;
                if (richText && richText.length > 0) {
                    html += `<p>${richTextToHtml(richText)}</p>\n`;
                }
                break;
                
            case 'heading_1':
                html += `<h2>${richTextToHtml(block[type].rich_text)}</h2>\n`;
                break;
                
            case 'heading_2':
                html += `<h3>${richTextToHtml(block[type].rich_text)}</h3>\n`;
                break;
                
            case 'heading_3':
                html += `<h4>${richTextToHtml(block[type].rich_text)}</h4>\n`;
                break;
                
            case 'bulleted_list_item':
                html += `<li>${richTextToHtml(block[type].rich_text)}</li>\n`;
                break;
                
            case 'numbered_list_item':
                html += `<li>${richTextToHtml(block[type].rich_text)}</li>\n`;
                break;
                
            case 'code':
                const codeText = block[type].rich_text.map(t => t.plain_text).join('');
                const language = block[type].language || '';
                html += `<pre><code class="language-${language}">${escapeHtml(codeText)}</code></pre>\n`;
                break;
                
            case 'quote':
                html += `<blockquote>${richTextToHtml(block[type].rich_text)}</blockquote>\n`;
                break;
                
            case 'divider':
                html += `<hr />\n`;
                break;
                
            case 'image':
                const imageUrl = block[type].type === 'external' 
                    ? block[type].external.url 
                    : block[type].file.url;
                html += `<img src="${imageUrl}" alt="" />\n`;
                break;
                
            case 'toggle':
                html += `<details><summary>${richTextToHtml(block[type].rich_text)}</summary>\n`;
                // 需要遞迴處理 children
                if (block.has_children) {
                    // 這裡簡化處理，實際需要遞迴獲取子區塊
                    html += `<p>...</p>`;
                }
                html += `</details>\n`;
                break;
                
            case 'callout':
                const icon = block[type].icon?.emoji || '💡';
                html += `<div class="callout">
                    <span class="callout-icon">${icon}</span>
                    <div class="callout-content">${richTextToHtml(block[type].rich_text)}</div>
                </div>\n`;
                break;
        }
    }
    
    // 將列表項目包裝在列表容器中
    html = html.replace(/(<li>.*?<\/li>\n)+/g, (match) => {
        return `<ul>\n${match}</ul>\n`;
    });
    
    return html;
}

// 轉換富文本為 HTML
function richTextToHtml(richTextArray) {
    if (!richTextArray) return '';
    
    return richTextArray.map(text => {
        let content = escapeHtml(text.plain_text);
        
        if (text.annotations) {
            if (text.annotations.bold) content = `<strong>${content}</strong>`;
            if (text.annotations.italic) content = `<em>${content}</em>`;
            if (text.annotations.strikethrough) content = `<del>${content}</del>`;
            if (text.annotations.underline) content = `<u>${content}</u>`;
            if (text.annotations.code) content = `<code>${content}</code>`;
            if (text.annotations.color !== 'default') {
                content = `<span style="color: ${text.annotations.color}">${content}</span>`;
            }
        }
        
        if (text.href) {
            content = `<a href="${text.href}" target="_blank" rel="noopener noreferrer">${content}</a>`;
        }
        
        return content;
    }).join('');
}

// HTML 轉義
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// 獲取頁面內容
async function fetchNotionPage() {
    let retries = 3;
    
    while (retries > 0) {
        try {
            console.log('Fetching Notion page content...');
            console.log('Page ID:', PAGE_ID);
            
            // 獲取頁面區塊
            const response = await notion.blocks.children.list({
                block_id: PAGE_ID,
                page_size: 100
            });
            
            console.log('Number of blocks:', response.results.length);
            
            // 轉換為 HTML
            const htmlContent = notionToHtml(response.results);
            
            // 獲取頁面屬性（標題等）
            let title = '使用說明';
            try {
                const pageResponse = await notion.pages.retrieve({ page_id: PAGE_ID });
                if (pageResponse.properties && pageResponse.properties.title) {
                    const titleProperty = pageResponse.properties.title;
                    if (titleProperty.type === 'title' && titleProperty.title.length > 0) {
                        title = titleProperty.title[0].plain_text;
                    }
                }
            } catch (titleError) {
                console.warn('Could not fetch page title, using default:', titleError.message);
            }
            
            // 檢查是否有實際內容，如果沒有使用預設內容
            const finalContent = htmlContent.trim() || getDefaultContent();
            
            // 保存為 JSON
            const guideData = {
                title: title,
                content: finalContent,
                last_updated: new Date().toISOString(),
                source: htmlContent.trim() ? 'notion' : 'default'
            };
            
            const outputPath = path.join(__dirname, 'guide.json');
            
            // 備份現有文件（如果存在）
            try {
                await fs.access(outputPath);
                const backupPath = outputPath + '.backup';
                await fs.copyFile(outputPath, backupPath);
                console.log(`Backup created at ${backupPath}`);
            } catch (e) {
                // 文件不存在，不需要備份
            }
            
            await fs.writeFile(outputPath, JSON.stringify(guideData, null, 2));
            
            console.log(`✅ Guide content saved to ${outputPath}`);
            console.log(`Title: ${title}`);
            console.log(`Content length: ${finalContent.length} characters`);
            console.log(`Source: ${guideData.source}`);
            
            return; // 成功，退出
            
        } catch (error) {
            retries--;
            console.error(`Error fetching Notion page (${3 - retries}/3):`, error.message);
            
            if (retries === 0) {
                console.error('Failed after 3 attempts');
                
                // 嘗試保留現有的 guide.json
                const outputPath = path.join(__dirname, 'guide.json');
                try {
                    await fs.access(outputPath);
                    console.log('⚠️  Keeping existing guide.json file');
                    process.exit(0); // 不算失敗，保留現有內容
                } catch (e) {
                    // 如果沒有現有文件，創建預設內容
                    console.log('Creating guide.json with default content...');
                    const guideData = {
                        title: '使用說明',
                        content: getDefaultContent(),
                        last_updated: new Date().toISOString(),
                        source: 'default',
                        error: 'Could not fetch from Notion, using default content'
                    };
                    await fs.writeFile(outputPath, JSON.stringify(guideData, null, 2));
                    console.log('✅ Default guide content created');
                    process.exit(0);
                }
            }
            
            // 等待後重試
            console.log(`Retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// 執行
fetchNotionPage();
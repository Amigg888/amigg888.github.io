import asyncio
from playwright.async_api import async_playwright
import json

async def extract_js_data(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(15) # 等待渲染完成
        
        # 尝试提取全局变量
        data = await page.evaluate("""
            () => {
                const results = {};
                if (window.clientVars) {
                    results.clientVars = {
                        collab_client_vars: window.clientVars.collab_client_vars,
                        // initialAttributedText 可能很大，我们只取文本部分或者摘要
                        hasInitialText: !!window.clientVars.initialAttributedText
                    };
                    if (window.clientVars.initialAttributedText && window.clientVars.initialAttributedText.text) {
                        // 提取前1000个字符看看
                        results.textSnippet = JSON.stringify(window.clientVars.initialAttributedText.text).substring(0, 1000);
                    }
                }
                return results;
            }
        """)
        
        print("Found JS variables:", list(data.keys()))
        
        with open("extracted_js_vars.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        # 尝试通过 DOM 提取（针对公开表格）
        # 有些表格会渲染成普通的 table 或 div 结构
        dom_data = await page.evaluate("""
            () => {
                const rows = [];
                // 尝试查找常见的表格行选择器
                const tableRows = document.querySelectorAll('.excel-canvas-container, .sheet-canvas, tr');
                if (tableRows.length > 0) {
                    return `Found ${tableRows.length} potential row elements`;
                }
                return "No common table elements found";
            }
        """)
        print(f"DOM check: {dom_data}")
        
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_js_data(url))

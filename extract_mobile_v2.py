import asyncio
from playwright.async_api import async_playwright
import json

async def extract_mobile(url):
    async with async_playwright() as p:
        # 模拟 iPhone 12
        device = p.devices['iPhone 12']
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(**device)
        page = await context.new_page()
        
        print(f"Opening mobile view: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(15)
        
        # 截个图看看样子
        await page.screenshot(path="mobile_view.png")
        
        # 提取 DOM 数据
        data = await page.evaluate("""
            () => {
                const results = [];
                // 腾讯文档移动版通常使用 div 模拟表格
                const cells = document.querySelectorAll('.sheet-cell-text, .cell-content');
                cells.forEach(c => results.push(c.innerText.trim()));
                return results;
            }
        """)
        
        print(f"Extracted {len(data)} items from mobile DOM")
        if data:
            print("Sample data:", data[:20])
            with open("mobile_data.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_mobile(url))

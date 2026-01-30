import asyncio
from playwright.async_api import async_playwright
import json

async def extract_mobile_v3(url):
    # 使用手机模拟器
    async with async_playwright() as p:
        iphone = p.devices['iPhone 13']
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(**iphone)
        page = await context.new_page()
        
        print(f"Opening mobile view: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        # 尝试查找包含数据的元素
        # 移动端通常是简单的 div 列表
        data = await page.evaluate("""
            () => {
                const results = [];
                // 查找所有可能的单元格或行
                const elements = document.querySelectorAll('div, span, td');
                elements.forEach(el => {
                    const text = el.innerText.trim();
                    if (text && text.length < 100) {
                        results.push(text);
                    }
                });
                return results;
            }
        """)
        
        print(f"Found {len(data)} text elements")
        with open("mobile_text_v3.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        # 寻找特定的关键词
        keywords = ["童昱楷", "续费", "1775", "桃子老师"]
        for k in keywords:
            found = any(k in str(item) for item in data)
            print(f"Keyword '{k}' found: {found}")
            
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_mobile_v3(url))

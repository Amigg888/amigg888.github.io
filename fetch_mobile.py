import asyncio
from playwright.async_api import async_playwright
import json

async def fetch_mobile_view(url):
    async with async_playwright() as p:
        # 使用 iPhone 模拟器
        device = p.devices['iPhone 12']
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(**device)
        page = await context.new_page()
        
        print(f"Opening mobile view: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(15)
        
        # 截个图看看
        await page.screenshot(path="mobile_view.png")
        
        # 尝试提取文本
        content = await page.content()
        with open("mobile_view.html", "w", encoding="utf-8") as f:
            f.write(content)
            
        # 查找所有的表格数据
        data = await page.evaluate("""
            () => {
                const results = [];
                // 手机版可能有不同的类名
                document.querySelectorAll('div, span, p').forEach(el => {
                    const text = el.innerText.trim();
                    if (text.length > 0 && text.length < 100) results.push(text);
                });
                return results;
            }
        """)
        
        await browser.close()
        return content

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(fetch_mobile_view(url))

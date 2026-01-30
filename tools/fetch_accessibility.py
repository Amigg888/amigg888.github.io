import asyncio
from playwright.async_api import async_playwright
import json

async def fetch_accessibility_data(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(20)
        
        # 腾讯文档的表格数据通常在一个隐藏的容器里，用于无障碍支持
        # 尝试寻找这个容器
        data = await page.evaluate("""
            () => {
                const results = [];
                // 尝试各种可能的选择器
                const selectors = [
                    '.grid-accessibility-container', 
                    '.grid-canvas-container',
                    '#grid-table-container',
                    '[role="grid"]'
                ];
                
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        results.push({
                            selector: sel,
                            text: el.innerText.substring(0, 1000),
                            html: el.innerHTML.substring(0, 1000)
                        });
                    }
                }
                
                // 遍历所有元素寻找包含大量短文本的容器
                const all = document.querySelectorAll('div');
                for (const div of all) {
                    if (div.innerText && div.innerText.length > 500 && div.children.length > 50) {
                        results.push({
                            selector: 'potential_container',
                            text: div.innerText.substring(0, 1000)
                        });
                        break;
                    }
                }
                
                return results;
            }
        """)
        
        await browser.close()
        return data

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    result = asyncio.run(fetch_accessibility_data(url))
    print(json.dumps(result, ensure_ascii=False, indent=2))

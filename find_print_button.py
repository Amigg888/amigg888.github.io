import asyncio
from playwright.async_api import async_playwright
import json

async def find_print_button(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(20)
        
        # 寻找打印按钮
        # 尝试通过 title 属性或者文本
        buttons = await page.evaluate("""
            () => {
                const results = [];
                const all = document.querySelectorAll('div, button, i, span');
                for (const el of all) {
                    const text = el.innerText || '';
                    const title = el.getAttribute('title') || '';
                    if (text.includes('打印') || title.includes('打印')) {
                        results.push({
                            tag: el.tagName,
                            text: text,
                            title: title,
                            rect: el.getBoundingClientRect()
                        });
                    }
                }
                return results;
            }
        """)
        
        print(f"Found {len(buttons)} potential print buttons.")
        for b in buttons:
            print(f"Button: {b['text']} / {b['title']} at {b['rect']}")
            
        await browser.close()
        return buttons

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(find_print_button(url))

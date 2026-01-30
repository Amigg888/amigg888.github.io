import asyncio
from playwright.async_api import async_playwright
import json

async def explore_window(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        # 探索 window 对象
        data = await page.evaluate("""
            () => {
                const keys = [];
                for (let key in window) {
                    if (key.startsWith('pad') || key.startsWith('sheet') || key.startsWith('spread')) {
                        keys.push(key);
                    }
                }
                return keys;
            }
        """)
        print(f"Found interesting keys: {data}")
        
        # 深度探索这些对象
        for key in data:
            try:
                details = await page.evaluate(f"""
                    () => {{
                        const obj = window['{key}'];
                        if (typeof obj === 'object' && obj !== null) {{
                            return Object.keys(obj).slice(0, 20);
                        }}
                        return typeof obj;
                    }}
                """)
                print(f"Details for {key}: {details}")
            except:
                pass
                
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(explore_window(url))

import asyncio
from playwright.async_api import async_playwright
import json
import base64
import zlib

async def capture_all_sheet_data(url):
    all_intercepts = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        async def handle_response(response):
            if "dop-api/get/sheet" in response.url:
                try:
                    text = await response.text()
                    all_intercepts.append({
                        "url": response.url,
                        "content": text
                    })
                    print(f"Captured: {response.url[:100]}...")
                except:
                    pass

        page.on("response", handle_response)
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(10)
        
        # 尝试切换不同的 Tab
        tabs = ["1月体验明细", "1月报课明细"]
        for tab in tabs:
            print(f"Switching to tab: {tab}")
            try:
                await page.click(f"text='{tab}'", timeout=5000)
                await asyncio.sleep(5)
                # 滚动以加载更多数据
                for _ in range(5):
                    await page.mouse.wheel(0, 2000)
                    await asyncio.sleep(2)
            except:
                print(f"Tab {tab} not found or click failed.")

        await browser.close()
    
    return all_intercepts

async def main():
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    intercepts = await capture_all_sheet_data(url)
    with open("all_sheet_intercepts.json", "w", encoding="utf-8") as f:
        json.dump(intercepts, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(intercepts)} intercepts to all_sheet_intercepts.json")

if __name__ == "__main__":
    asyncio.run(main())

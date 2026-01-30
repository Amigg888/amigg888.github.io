import asyncio
from playwright.async_api import async_playwright
import json
import os

async def intercept_all_data(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        captured_json = []

        async def handle_response(response):
            if "json" in response.headers.get("content-type", ""):
                try:
                    data = await response.json()
                    # 搜索是否有表格数据特征
                    data_str = json.dumps(data, ensure_ascii=False)
                    if any(k in data_str for k in ["rows", "cells", "sheet", "1月", "2026"]):
                        captured_json.append({
                            "url": response.url,
                            "data": data
                        })
                except:
                    pass
        
        page.on("response", handle_response)
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        
        # 模拟滚动以触发加载
        print("Scrolling...")
        for i in range(5):
            await page.mouse.wheel(0, 2000)
            await asyncio.sleep(2)
        
        # 尝试切换 Tab
        tabs = ["1月体验明细", "1月报课明细"]
        for tab in tabs:
            print(f"Trying to click tab: {tab}")
            try:
                await page.click(f"text='{tab}'", timeout=5000)
                await asyncio.sleep(5)
                await page.mouse.wheel(0, 2000)
                await asyncio.sleep(2)
            except:
                print(f"Tab {tab} not found or not clickable")

        await browser.close()
        return captured_json

async def main():
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    data = await intercept_all_data(url)
    with open("captured_intercepts.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Captured {len(data)} potential data responses to captured_intercepts.json")

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
from playwright.async_api import async_playwright
import json
import os

async def fetch_and_save_all_responses(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        # 创建一个目录存放响应
        os.makedirs("responses", exist_ok=True)
        
        async def handle_response(response):
            if "json" in response.headers.get("content-type", "") or "text" in response.headers.get("content-type", ""):
                try:
                    url_part = response.url.split("/")[-1].split("?")[0] or "root"
                    filename = f"responses/{url_part}_{len(os.listdir('responses'))}.json"
                    content = await response.text()
                    with open(filename, "w", encoding="utf-8") as f:
                        f.write(content)
                except:
                    pass
        
        page.on("response", handle_response)
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(20) # 足够时间加载所有分片数据
        
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(fetch_and_save_all_responses(url))
    print("Responses saved to responses/ directory")

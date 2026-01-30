import asyncio
from playwright.async_api import async_playwright
import json

async def fetch_publish_view(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        publish_url = url.replace("/sheet/", "/p/")
        print(f"Trying publish view: {publish_url}")
        await page.goto(publish_url, wait_until="load", timeout=60000)
        await asyncio.sleep(10)
        
        # 检查是否成功加载
        title = await page.title()
        print(f"Page title: {title}")
        
        # 在发布视图中，数据通常是 HTML 表格
        data = await page.evaluate("""
            () => {
                const rows = [];
                document.querySelectorAll('tr').forEach(tr => {
                    const cells = [];
                    tr.querySelectorAll('td').forEach(td => cells.push(td.innerText.trim()));
                    rows.push(cells);
                });
                return rows;
            }
        """)
        
        await browser.close()
        return data

async def main():
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    data = await fetch_publish_view(url)
    if data and len(data) > 0:
        with open("tencent_publish_data.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Successfully saved {len(data)} rows from publish view.")
    else:
        print("Publish view not available or empty.")

if __name__ == "__main__":
    asyncio.run(main())

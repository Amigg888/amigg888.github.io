import asyncio
from playwright.async_api import async_playwright
import json

async def inspect_app(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        data = await page.evaluate("""
            () => {
                const results = {};
                const workbook = window.SpreadsheetApp.workbook;
                results.workbookKeys = Object.keys(workbook);
                
                // 尝试查找 sheet 列表
                // 有时候是在 workbook._sheets 或 workbook.sheets
                results.workbook_sheets = !!workbook._sheets;
                results.workbook_sheets_keys = workbook._sheets ? Object.keys(workbook._sheets) : null;
                
                // 查找数据中心
                const dataCenter = window.SpreadsheetApp.dataCenterService;
                results.dataCenterKeys = dataCenter ? Object.keys(dataCenter) : null;
                
                return results;
            }
        """)
        
        print(json.dumps(data, indent=2))
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(inspect_app(url))

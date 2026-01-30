import asyncio
from playwright.async_api import async_playwright
import json

async def dump_kk(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        data = await page.evaluate("""
            () => {
                const wm = window.SpreadsheetApp.workbook.worksheetManager;
                const s = wm.getSheetBySheetId('tz0b9p');
                const grid = s.cellDataGrid;
                const kK = grid._kK;
                
                // 返回 kK 的结构描述
                const dump = {
                    type: typeof kK,
                    isArray: Array.isArray(kK),
                    keys: Object.keys(kK).slice(0, 10),
                    firstElement: kK[Object.keys(kK)[0]]
                };
                return dump;
            }
        """)
        
        print(json.dumps(data, indent=2))
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(dump_kk(url))

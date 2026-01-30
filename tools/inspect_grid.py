import asyncio
from playwright.async_api import async_playwright
import json

async def inspect_grid(url):
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
                return {
                    gridKeys: Object.keys(grid),
                    // 尝试查看内部数据结构
                    // 腾讯文档通常把数据存在 grid._data 或 grid.data
                    internalData: !!grid._data,
                    internalDataKeys: grid._data ? Object.keys(grid._data).slice(0, 10) : null,
                    rowCount: s.getRowCount(),
                    colCount: s.getColCount()
                };
            }
        """)
        
        print(json.dumps(data, indent=2))
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(inspect_grid(url))

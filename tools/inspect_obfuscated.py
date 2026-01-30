import asyncio
from playwright.async_api import async_playwright
import json

async def inspect_obfuscated(url):
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
                
                const info = {};
                // 尝试转储一部分数据
                for (let key in grid) {
                    if (key.startsWith('_')) {
                        const val = grid[key];
                        if (typeof val === 'object' && val !== null) {
                            info[key] = {
                                type: 'object',
                                keys: Object.keys(val).slice(0, 10),
                                sample: JSON.stringify(val).slice(0, 200)
                            };
                        } else {
                            info[key] = typeof val;
                        }
                    }
                }
                
                // 同时也试试 getStringRepresentation
                if (typeof s.getStringRepresentation === 'function') {
                    info.stringRep = s.getStringRepresentation().slice(0, 500);
                }
                
                return info;
            }
        """)
        
        print(json.dumps(data, indent=2))
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(inspect_obfuscated(url))

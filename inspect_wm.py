import asyncio
from playwright.async_api import async_playwright
import json

async def inspect_worksheet_manager(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        data = await page.evaluate("""
            () => {
                const results = {};
                const wm = window.SpreadsheetApp.workbook.worksheetManager;
                results.wmKeys = Object.keys(wm);
                
                // 尝试获取所有 sheet
                if (typeof wm.getWorksheets === 'function') {
                    const sheets = wm.getWorksheets();
                    results.sheets = sheets.map(s => ({
                        id: s.id,
                        name: s.name,
                        maxRow: s.maxRow,
                        maxCol: s.maxCol,
                        keys: Object.keys(s).slice(0, 50)
                    }));
                } else {
                    // 尝试查找包含 sheets 的属性
                    for (let key in wm) {
                        if (key.toLowerCase().includes('sheet')) {
                            results[key] = typeof wm[key];
                        }
                    }
                }
                
                return results;
            }
        """)
        
        print(json.dumps(data, indent=2))
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(inspect_worksheet_manager(url))

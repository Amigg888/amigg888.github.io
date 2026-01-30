import asyncio
from playwright.async_api import async_playwright
import json

async def inspect_sheet_obj(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        data = await page.evaluate("""
            () => {
                const wm = window.SpreadsheetApp.workbook.worksheetManager;
                const sheets = wm.getSheetList();
                if (sheets.length > 0) {
                    const s = sheets[0];
                    const info = {
                        keys: Object.keys(s),
                        protoKeys: Object.keys(Object.getPrototypeOf(s))
                    };
                    // 尝试调用一些常见的 getter
                    const getters = ['getName', 'getId', 'getMaxRow', 'getMaxCol', 'getSheetId', 'getSheetName'];
                    getters.forEach(g => {
                        if (typeof s[g] === 'function') {
                            info[g] = s[g]();
                        }
                    });
                    return info;
                }
                return "no sheets";
            }
        """)
        
        print(json.dumps(data, indent=2))
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(inspect_sheet_obj(url))

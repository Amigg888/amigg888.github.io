import asyncio
from playwright.async_api import async_playwright
import json

async def extract_robust(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        # 更加健壮的提取逻辑
        extract_js = """
            () => {
                const wm = window.SpreadsheetApp.workbook.worksheetManager;
                const s = wm.getSheetBySheetId('tz0b9p');
                const grid = s.cellDataGrid;
                const kK = grid._kK;
                const results = [];
                
                const processRow = (rowContainer) => {
                    let cellObjects = [];
                    if (rowContainer && rowContainer._Ao && Array.isArray(rowContainer._Ao)) {
                        rowContainer._Ao.forEach(innerArr => {
                            if (Array.isArray(innerArr)) cellObjects = cellObjects.concat(innerArr);
                        });
                    }
                    if (cellObjects.length > 0) {
                        const row = cellObjects.map(cell => (cell ? (cell.m || cell.v || cell.value || "") : ""));
                        if (row.some(v => v !== "")) results.push(row);
                    }
                };

                if (kK) {
                    Object.keys(kK).forEach(key => {
                        processRow(kK[key]);
                    });
                }
                return results;
            }
        """
        
        # 滚动并提取
        all_data = []
        for i in range(10):
            await page.mouse.wheel(0, 1000)
            await asyncio.sleep(2)
            current_data = await page.evaluate(extract_js)
            for row in current_data:
                if row not in all_data:
                    all_data.append(row)
            print(f"Total rows: {len(all_data)}")
            
        with open("enrollment_robust.json", "w", encoding="utf-8") as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
            
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_robust(url))

import asyncio
from playwright.async_api import async_playwright
import json

async def extract_via_internal_grid(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        data = await page.evaluate("""
            () => {
                const results = {};
                try {
                    const wm = window.SpreadsheetApp.workbook.worksheetManager;
                    
                    const extractSheet = (sheetId) => {
                        const s = wm.getSheetBySheetId(sheetId);
                        if (!s) return null;
                        const grid = s.cellDataGrid;
                        const kK = grid._kK;
                        
                        const rows = [];
                        // kK 是一个二维数组，或者是包含数组的对象
                        if (Array.isArray(kK)) {
                            kK.forEach(rowArr => {
                                if (Array.isArray(rowArr)) {
                                    const row = rowArr.map(cell => {
                                        if (cell && typeof cell === 'object') {
                                            return cell.m || cell.v || cell.value || "";
                                        }
                                        return "";
                                    });
                                    if (row.some(v => v !== "")) rows.push(row);
                                }
                            });
                        }
                        return {
                            name: s.getSheetName(),
                            data: rows
                        };
                    };
                    
                    results.enrollment = extractSheet('tz0b9p');
                    results.experience = extractSheet('facejs');
                } catch(e) {
                    results.error = e.message;
                    results.stack = e.stack;
                }
                return results;
            }
        """)
        
        if 'error' in data:
            print(f"Error: {data['error']}")
            print(data['stack'])
        else:
            if data['enrollment']:
                with open("online_enrollment_data.json", "w", encoding="utf-8") as f:
                    json.dump(data['enrollment']['data'], f, ensure_ascii=False, indent=2)
                print(f"Saved enrollment data: {len(data['enrollment']['data'])} rows")
            
            if data['experience']:
                with open("online_experience_data.json", "w", encoding="utf-8") as f:
                    json.dump(data['experience']['data'], f, ensure_ascii=False, indent=2)
                print(f"Saved experience data: {len(data['experience']['data'])} rows")
        
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_via_internal_grid(url))

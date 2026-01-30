import asyncio
from playwright.async_api import async_playwright
import json

async def extract_final_v2(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        await page.goto(url, wait_until="load")
        await asyncio.sleep(25)
        
        extract_js = """
            () => {
                const wm = window.SpreadsheetApp.workbook.worksheetManager;
                
                const extract = (sheetId) => {
                    const s = wm.getSheetBySheetId(sheetId);
                    if (!s) return [];
                    const kK = s.cellDataGrid._kK;
                    const rows = [];
                    
                    if (kK) {
                        for (let key in kK) {
                            const rowContainer = kK[key];
                            if (rowContainer && rowContainer._Ao && Array.isArray(rowContainer._Ao)) {
                                rowContainer._Ao.forEach(innerArr => {
                                    if (Array.isArray(innerArr)) {
                                        const row = innerArr.map(cell => {
                                            if (!cell) return "";
                                            return cell.m !== undefined ? cell.m : 
                                                   (cell.v !== undefined ? cell.v : 
                                                   (cell.value !== undefined ? cell.value : ""));
                                        });
                                        if (row.some(v => v !== "")) rows.push(row);
                                    }
                                });
                            }
                        }
                    }
                    return rows;
                };
                
                return {
                    enrollment: extract('tz0b9p'),
                    experience: extract('facejs')
                };
            }
        """
        
        data = await page.evaluate(extract_js)
        
        with open("enrollment_final.json", "w", encoding="utf-8") as f:
            json.dump(data['enrollment'], f, ensure_ascii=False, indent=2)
        print(f"Enrollment: {len(data['enrollment'])} rows")
        
        with open("experience_final.json", "w", encoding="utf-8") as f:
            json.dump(data['experience'], f, ensure_ascii=False, indent=2)
        print(f"Experience: {len(data['experience'])} rows")
        
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_final_v2(url))

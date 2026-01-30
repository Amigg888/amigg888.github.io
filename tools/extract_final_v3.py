import asyncio
from playwright.async_api import async_playwright
import json

async def extract_final_v3(url):
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
                        // kK 是行数组
                        for (let i = 0; i < kK.length; i++) {
                            const rowBlocks = kK[i];
                            if (Array.isArray(rowBlocks)) {
                                // 每个 rowBlock 是一个对象
                                rowBlocks.forEach(block => {
                                    if (block && block._Ao && Array.isArray(block._Ao)) {
                                        // _Ao 是单元格数组的数组（通常只有一层）
                                        block._Ao.forEach(cellArr => {
                                            if (Array.isArray(cellArr)) {
                                                const row = cellArr.map(cell => {
                                                    if (!cell) return "";
                                                    return cell.m !== undefined ? cell.m : 
                                                           (cell.v !== undefined ? cell.v : 
                                                           (cell.value !== undefined ? cell.value : ""));
                                                });
                                                if (row.some(v => v !== "")) rows.push(row);
                                            }
                                        });
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
    asyncio.run(extract_final_v3(url))

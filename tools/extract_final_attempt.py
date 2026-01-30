import asyncio
from playwright.async_api import async_playwright
import json

async def extract_final_attempt(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        await page.goto(url, wait_until="load")
        await asyncio.sleep(25) # 给更多时间加载
        
        # 滚动一下以确保加载
        for _ in range(5):
            await page.mouse.wheel(0, 1000)
            await asyncio.sleep(2)
        
        extract_js = """
            () => {
                const wm = window.SpreadsheetApp.workbook.worksheetManager;
                
                const extract = (sheetId) => {
                    const s = wm.getSheetBySheetId(sheetId);
                    if (!s) return [];
                    const kK = s.cellDataGrid._kK;
                    const rows = [];
                    
                    if (Array.isArray(kK)) {
                        kK.forEach(rowContainer => {
                            if (rowContainer && rowContainer._Ao && Array.isArray(rowContainer._Ao)) {
                                rowContainer._Ao.forEach(innerArr => {
                                    if (Array.isArray(innerArr)) {
                                        const row = innerArr.map(cell => {
                                            if (!cell) return "";
                                            // 尝试获取各种可能的值
                                            let val = cell.m !== undefined ? cell.m : 
                                                     (cell.v !== undefined ? cell.v : 
                                                     (cell.value !== undefined ? cell.value : ""));
                                            
                                            // 如果是对象（有时 v 是对象），尝试取其内部值
                                            if (typeof val === 'object' && val !== null) {
                                                val = val.v || val.m || JSON.stringify(val);
                                            }
                                            return val;
                                        });
                                        if (row.some(v => v !== "")) rows.push(row);
                                    }
                                });
                            }
                        });
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
    asyncio.run(extract_final_attempt(url))

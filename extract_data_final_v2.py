import asyncio
from playwright.async_api import async_playwright
import json

async def extract_data_final_v2(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        data = await page.evaluate("""
            () => {
                const results = {};
                const wm = window.SpreadsheetApp.workbook.worksheetManager;
                const sheets = wm.getSheetList();
                
                results.sheets = sheets.map(s => {
                    const sheetId = s.getSheetId();
                    const sheetName = s.getSheetName();
                    const rowCount = s.getRowCount();
                    const colCount = s.getColCount();
                    
                    const rows = [];
                    // 为了性能，我们限制一下行列数，或者根据实际内容来
                    const maxR = Math.min(rowCount, 150); 
                    const maxC = Math.min(colCount, 26); 
                    
                    for (let r = 0; r < maxR; r++) {
                        const row = [];
                        for (let c = 0; c < maxC; c++) {
                            const cell = s.getCellDataAtPosition(r, c);
                            if (cell) {
                                // 优先取格式化后的值 m，如果没有则取原始值 v
                                let val = cell.m !== undefined ? cell.m : (cell.v !== undefined ? cell.v : "");
                                row.push(val);
                            } else {
                                row.push("");
                            }
                        }
                        // 只有当行不全为空时才添加
                        if (row.some(v => v !== "" && v !== null)) {
                            rows.push(row);
                        }
                    }
                    
                    return {
                        id: sheetId,
                        name: sheetName,
                        data: rows
                    };
                });
                
                return results;
            }
        """)
        
        with open("final_extracted_data_v2.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Successfully extracted data to final_extracted_data_v2.json")
        
        # 验证一下数据
        if data and 'sheets' in data:
            for s in data['sheets']:
                print(f"Sheet: {s['name']} ({s['id']}) - {len(s['data'])} rows")
        
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_data_final_v2(url))

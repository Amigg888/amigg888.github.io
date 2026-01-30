import asyncio
from playwright.async_api import async_playwright
import json

async def extract_data_final(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        data = await page.evaluate("""
            () => {
                const results = {};
                const wm = window.SpreadsheetApp.workbook.worksheetManager;
                const sheets = wm.getSheetList();
                
                results.sheets = sheets.map(s => {
                    const sheetData = {
                        id: s.id,
                        name: s.name,
                        maxRow: s.maxRow,
                        maxCol: s.maxCol
                    };
                    
                    // 尝试提取数据
                    // 腾讯文档的 sheet 对象通常有一个 model 或 dataCenter
                    // 我们可以尝试使用 getCellData(r, c) 如果存在
                    const rows = [];
                    const maxR = Math.min(s.maxRow, 100); // 只取前100行
                    const maxC = Math.min(s.maxCol, 20);  // 只取前20列
                    
                    for (let r = 0; r < maxR; r++) {
                        const row = [];
                        for (let c = 0; c < maxC; c++) {
                            try {
                                // 尝试几种可能的获取单元格的方法
                                let cell = null;
                                if (typeof s.getCell === 'function') cell = s.getCell(r, c);
                                else if (typeof s.getCellData === 'function') cell = s.getCellData(r, c);
                                
                                if (cell) {
                                    row.push(cell.v || cell.value || cell.formattedValue || "");
                                } else {
                                    row.push("");
                                }
                            } catch(e) {
                                row.push("");
                            }
                        }
                        if (row.some(v => v !== "")) {
                            rows.append ? rows.append(row) : rows.push(row);
                        }
                    }
                    sheetData.data = rows;
                    return sheetData;
                });
                
                return results;
            }
        """)
        
        with open("final_extracted_data.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Successfully extracted data to final_extracted_data.json")
        
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_data_final(url))

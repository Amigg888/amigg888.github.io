import asyncio
from playwright.async_api import async_playwright
import json

async def extract_via_spreadsheet_app(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        # 尝试通过 SpreadsheetApp 提取数据
        data = await page.evaluate("""
            () => {
                const results = {};
                try {
                    // 尝试获取所有 sheet
                    const workbook = window.SpreadsheetApp.workbook;
                    const sheets = workbook.getSheets();
                    results.sheetCount = sheets.length;
                    results.sheets = sheets.map(s => ({
                        id: s.id,
                        name: s.name,
                        maxRow: s.maxRow,
                        maxCol: s.maxCol
                    }));
                    
                    // 尝试获取当前 active sheet 的数据
                    const activeSheet = workbook.getActiveSheet();
                    results.activeSheetName = activeSheet.name;
                    
                    // 提取前 100 行数据
                    const rows = [];
                    for (let r = 0; r < 100; r++) {
                        const row = [];
                        for (let c = 0; c < 20; c++) {
                            const cell = activeSheet.getCell(r, c);
                            if (cell) {
                                row.push(cell.value || cell.formattedValue || "");
                            } else {
                                row.push("");
                            }
                        }
                        // 只有当行不全为空时才添加
                        if (row.some(v => v !== "")) {
                            rows.push(row);
                        }
                    }
                    results.data = rows;
                } catch(e) {
                    results.error = e.message;
                    results.stack = e.stack;
                }
                return results;
            }
        """)
        
        print(json.dumps(data, indent=2))
        
        if 'data' in data:
            with open("spreadsheet_app_data.json", "w", encoding="utf-8") as f:
                json.dump(data['data'], f, ensure_ascii=False, indent=2)
            print("Saved data to spreadsheet_app_data.json")
            
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_via_spreadsheet_app(url))

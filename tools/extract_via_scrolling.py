import asyncio
from playwright.async_api import async_playwright
import json

async def extract_via_scrolling(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # 模拟大屏幕
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        # 尝试切换到“1月报课明细”标签 (tz0b9p)
        # 其实 URL 里已经带了 tab=tz0b9p，但为了保险
        
        print("Scrolling to load all data...")
        # 滚动多次以触发数据加载
        for i in range(10):
            await page.mouse.wheel(0, 1000)
            await asyncio.sleep(1)
        
        # 回到顶部
        await page.evaluate("window.scrollTo(0, 0)")
        await asyncio.sleep(2)
        
        print("Extracting data from window object...")
        data = await page.evaluate("""
            () => {
                const results = {};
                try {
                    const wm = window.SpreadsheetApp.workbook.worksheetManager;
                    const sheet = wm.getSheetBySheetId('tz0b9p') || wm.getSheetList()[0];
                    
                    const rowCount = sheet.getRowCount();
                    const colCount = sheet.getColCount();
                    const rows = [];
                    
                    for (let r = 0; r < Math.min(rowCount, 100); r++) {
                        const row = [];
                        for (let c = 0; c < Math.min(colCount, 26); c++) {
                            const cell = sheet.getCellDataAtPosition(r, c);
                            if (cell) {
                                row.push(cell.m || cell.v || "");
                            } else {
                                row.push("");
                            }
                        }
                        if (row.some(v => v !== "")) {
                            rows.push(row);
                        }
                    }
                    results.name = sheet.getSheetName();
                    results.data = rows;
                } catch(e) {
                    results.error = e.message;
                }
                return results;
            }
        """)
        
        if 'error' in data:
            print(f"Extraction error: {data['error']}")
        else:
            print(f"Extracted {len(data.get('data', []))} rows from {data.get('name')}")
            with open("scrolled_data_tz0b9p.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        
        # 同样的方法提取另一个标签 "1月体验明细" (facejs)
        print("Extracting facejs sheet...")
        data_facejs = await page.evaluate("""
            () => {
                const results = {};
                try {
                    const wm = window.SpreadsheetApp.workbook.worksheetManager;
                    const sheet = wm.getSheetBySheetId('facejs');
                    if (!sheet) return { error: "Sheet facejs not found" };
                    
                    const rowCount = sheet.getRowCount();
                    const colCount = sheet.getColCount();
                    const rows = [];
                    
                    for (let r = 0; r < Math.min(rowCount, 100); r++) {
                        const row = [];
                        for (let c = 0; c < Math.min(colCount, 26); c++) {
                            const cell = sheet.getCellDataAtPosition(r, c);
                            if (cell) {
                                row.push(cell.m || cell.v || "");
                            } else {
                                row.push("");
                            }
                        }
                        if (row.some(v => v !== "")) {
                            rows.push(row);
                        }
                    }
                    results.name = sheet.getSheetName();
                    results.data = rows;
                } catch(e) {
                    results.error = e.message;
                }
                return results;
            }
        """)
        
        if 'error' in data_facejs:
            print(f"Extraction error (facejs): {data_facejs['error']}")
        else:
            print(f"Extracted {len(data_facejs.get('data', []))} rows from {data_facejs.get('name')}")
            with open("scrolled_data_facejs.json", "w", encoding="utf-8") as f:
                json.dump(data_facejs, f, ensure_ascii=False, indent=2)
        
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_via_scrolling(url))

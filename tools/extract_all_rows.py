import asyncio
from playwright.async_api import async_playwright
import json

async def extract_all_rows(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(15)
        
        # 定义一个提取数据的 JS 函数
        extract_js = """
            () => {
                const wm = window.SpreadsheetApp.workbook.worksheetManager;
                const s = wm.getSheetBySheetId('tz0b9p');
                const grid = s.cellDataGrid;
                const kK = grid._kK;
                const results = [];
                
                if (Array.isArray(kK)) {
                    kK.forEach(rowContainer => {
                        let cellObjects = [];
                        if (Array.isArray(rowContainer)) {
                            rowContainer.forEach(item => {
                                if (item && item._Ao && Array.isArray(item._Ao)) {
                                    item._Ao.forEach(innerArr => {
                                        if (Array.isArray(innerArr)) cellObjects = cellObjects.concat(innerArr);
                                    });
                                }
                            });
                        } else if (rowContainer && rowContainer._Ao && Array.isArray(rowContainer._Ao)) {
                            rowContainer._Ao.forEach(innerArr => {
                                if (Array.isArray(innerArr)) cellObjects = cellObjects.concat(innerArr);
                            });
                        }
                        
                        if (cellObjects.length > 0) {
                            const row = cellObjects.map(cell => (cell ? (cell.m || cell.v || cell.value || "") : ""));
                            if (row.some(v => v !== "")) results.push(row);
                        }
                    });
                }
                return results;
            }
        """
        
        all_data = []
        print("Scrolling and collecting data...")
        for i in range(20): # 滚动20次
            await page.mouse.wheel(0, 1000)
            await asyncio.sleep(2)
            current_data = await page.evaluate(extract_js)
            # 合并数据并去重（通过第一列学员姓名和第二列报课时间）
            for row in current_data:
                if row not in all_data:
                    all_data.append(row)
            print(f"Collected {len(all_data)} unique rows so far...")
            
        with open("all_enrollment_data_scrolled.json", "w", encoding="utf-8") as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
            
        # 切换到体验明细标签并重复
        print("Switching to experience tab...")
        await page.click('text="1月体验明细"')
        await asyncio.sleep(5)
        
        all_exp_data = []
        extract_exp_js = extract_js.replace('tz0b9p', 'facejs')
        for i in range(20):
            await page.mouse.wheel(0, 1000)
            await asyncio.sleep(2)
            current_data = await page.evaluate(extract_exp_js)
            for row in current_data:
                if row not in all_exp_data:
                    all_exp_data.append(row)
            print(f"Collected {len(all_exp_data)} unique rows so far...")
            
        with open("all_experience_data_scrolled.json", "w", encoding="utf-8") as f:
            json.dump(all_exp_data, f, ensure_ascii=False, indent=2)
            
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_all_rows(url))

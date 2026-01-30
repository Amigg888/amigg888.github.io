import asyncio
from playwright.async_api import async_playwright
import json

async def extract_with_keyboard(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        # 点击页面中心以确保聚焦
        await page.mouse.click(500, 500)
        await asyncio.sleep(2)
        
        all_data = []
        
        # 提取数据的函数
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
                        if (rowContainer && rowContainer._Ao && Array.isArray(rowContainer._Ao)) {
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
        
        print("Moving down and collecting data...")
        for i in range(100): # 向下按100次方向键
            await page.keyboard.press("ArrowDown")
            if i % 10 == 0:
                await asyncio.sleep(1)
                current_data = await page.evaluate(extract_js)
                for row in current_data:
                    if row not in all_data:
                        all_data.append(row)
                print(f"Step {i}: Total unique rows: {len(all_data)}")
        
        with open("enrollment_data_keyboard.json", "w", encoding="utf-8") as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
            
        # 体验明细
        print("Switching to experience tab...")
        await page.click('text="1月体验明细"')
        await asyncio.sleep(5)
        await page.mouse.click(500, 500)
        
        all_exp_data = []
        extract_exp_js = extract_js.replace('tz0b9p', 'facejs')
        for i in range(100):
            await page.keyboard.press("ArrowDown")
            if i % 10 == 0:
                await asyncio.sleep(1)
                current_data = await page.evaluate(extract_exp_js)
                for row in current_data:
                    if row not in all_exp_data:
                        all_exp_data.append(row)
                print(f"Step {i}: Total unique rows: {len(all_exp_data)}")
                
        with open("experience_data_keyboard.json", "w", encoding="utf-8") as f:
            json.dump(all_exp_data, f, ensure_ascii=False, indent=2)
            
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_with_keyboard(url))

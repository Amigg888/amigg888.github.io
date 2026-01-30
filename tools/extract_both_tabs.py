import asyncio
from playwright.async_api import async_playwright
import json

async def extract_both_tabs(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        extract_js = """
            (sheetId) => {
                const wm = window.SpreadsheetApp.workbook.worksheetManager;
                const s = wm.getSheetBySheetId(sheetId);
                if (!s) return null;
                const kK = s.cellDataGrid._kK;
                const rows = [];
                if (kK) {
                    for (let i = 0; i < kK.length; i++) {
                        const rowBlocks = kK[i];
                        if (Array.isArray(rowBlocks)) {
                            rowBlocks.forEach(block => {
                                if (block && block._Ao && Array.isArray(block._Ao)) {
                                    block._Ao.forEach(cellArr => {
                                        if (Array.isArray(cellArr)) {
                                            const row = cellArr.map(cell => {
                                                if (!cell) return "";
                                                let val = cell.m !== undefined ? cell.m : 
                                                         (cell.v !== undefined ? cell.v : 
                                                         (cell.value !== undefined ? cell.value : ""));
                                                if (typeof val === 'object' && val !== null) {
                                                    val = val.v || val.m || "";
                                                }
                                                return val;
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
            }
        """
        
        # 提取 1月报课明细
        enrollment_data = await page.evaluate(extract_js, 'tz0b9p')
        print(f"Enrollment rows: {len(enrollment_data) if enrollment_data else 0}")
        
        # 尝试切换到 1月体验明细
        print("Switching tab to facejs...")
        # 找到包含 "1月体验明细" 的元素并点击
        try:
            tab = await page.wait_for_selector('text="1月体验明细"', timeout=10000)
            await tab.click()
            await asyncio.sleep(5)
            # 滚动一下触发加载
            await page.mouse.wheel(0, 1000)
            await asyncio.sleep(2)
        except:
            print("Failed to click tab via text. Trying via ID in URL...")
            await page.goto(url.replace('tz0b9p', 'facejs'), wait_until="load")
            await asyncio.sleep(10)
            
        experience_data = await page.evaluate(extract_js, 'facejs')
        print(f"Experience rows: {len(experience_data) if experience_data else 0}")
        
        with open("enrollment_data_v4.json", "w", encoding="utf-8") as f:
            json.dump(enrollment_data, f, ensure_ascii=False, indent=2)
            
        with open("experience_data_v4.json", "w", encoding="utf-8") as f:
            json.dump(experience_data, f, ensure_ascii=False, indent=2)
            
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_both_tabs(url))

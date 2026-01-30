import asyncio
from playwright.async_api import async_playwright
import os

async def extract_via_print(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(15)
        
        try:
            # 查找并点击“打印”按钮
            print("Looking for 'Print' button...")
            # 根据之前的 text extraction，打印按钮就在页面上
            print_btn = await page.wait_for_selector('text="打印"', timeout=10000)
            
            # 监听新打开的页面 (打印预览通常会打开一个新窗口)
            async with context.expect_page() as new_page_info:
                await print_btn.click()
            
            print_page = await new_page_info.value
            await print_page.wait_for_load_state("networkidle")
            await asyncio.sleep(5)
            
            # 在打印预览页面中提取表格数据
            # 打印预览通常是纯 HTML table
            data = await print_page.evaluate("""
                () => {
                    const rows = [];
                    document.querySelectorAll('tr').forEach(tr => {
                        const cells = [];
                        tr.querySelectorAll('td').forEach(td => cells.push(td.innerText.trim()));
                        rows.push(cells);
                    });
                    return rows;
                }
            """)
            
            print(f"Extracted {len(data)} rows from print view")
            
            import json
            with open("print_data.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            print("Saved to print_data.json")
            
        except Exception as e:
            print(f"Print extraction failed: {e}")
            await page.screenshot(path="print_error.png")
            
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_via_print(url))

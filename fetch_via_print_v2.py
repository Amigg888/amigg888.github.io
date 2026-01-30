import asyncio
from playwright.async_api import async_playwright
import json

async def extract_via_print_v2(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20) # 给予足够加载时间
        
        try:
            # 查找所有“打印”按钮并尝试点击可见的那个
            print("Searching for 'Print' buttons...")
            btns = await page.query_selector_all('text="打印"')
            print(f"Found {len(btns)} potential buttons")
            
            clicked = False
            for btn in btns:
                if await btn.is_visible():
                    print("Found visible print button, clicking...")
                    async with context.expect_page() as new_page_info:
                        await btn.click()
                    print_page = await new_page_info.value
                    clicked = True
                    break
            
            if not clicked:
                # 尝试通过坐标点击，因为有时候 selector 没那么好使
                # 打印按钮通常在顶部工具栏
                print("No visible button found via selector, trying coordinate click (approximate)...")
                await page.mouse.click(1140, 115) # 这是一个可能的坐标
                try:
                    async with context.expect_page(timeout=5000) as new_page_info:
                        pass
                    print_page = await new_page_info.value
                    clicked = True
                except:
                    print("Coordinate click failed too.")

            if clicked:
                print("Waiting for print page to load...")
                await print_page.wait_for_load_state("networkidle")
                await asyncio.sleep(5)
                
                # 提取数据
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
                
                print(f"Extracted {len(data)} rows")
                with open("print_data_v2.json", "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                print("Saved to print_data_v2.json")
            else:
                print("Failed to trigger print view.")
                await page.screenshot(path="print_fail_v2.png")
                
        except Exception as e:
            print(f"Error: {e}")
            await page.screenshot(path="print_error_v2.png")
            
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_via_print_v2(url))

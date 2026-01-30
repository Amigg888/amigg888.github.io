import asyncio
from playwright.async_api import async_playwright
import os

async def export_via_ui(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        try:
            # 尝试点击“文件”菜单
            # 腾讯文档的菜单项通常是这个类
            print("Trying to click 'File' menu...")
            # 尝试多种选择器
            selectors = [
                'div:has-text("文件")',
                '.header-menu-item:has-text("文件")',
                '#header-menu-file',
                '.menu-item-text:has-text("文件")'
            ]
            
            clicked = False
            for s in selectors:
                try:
                    btn = await page.wait_for_selector(s, timeout=5000)
                    if btn:
                        await btn.click()
                        print(f"Clicked File menu using selector: {s}")
                        clicked = True
                        break
                except:
                    continue
            
            if not clicked:
                print("Failed to click File menu. Taking screenshot.")
                await page.screenshot(path="menu_fail.png")
                return

            await asyncio.sleep(2)
            
            # 点击“导出为”
            print("Looking for 'Export' option...")
            export_btn = await page.wait_for_selector('text="导出为"', timeout=5000)
            await export_btn.hover()
            await asyncio.sleep(1)
            
            # 点击“本地 Excel 表格 (.xlsx)”
            print("Looking for 'Excel' option...")
            excel_btn = await page.wait_for_selector('text="本地 Excel 表格 (.xlsx)"', timeout=5000)
            
            async with page.expect_download() as download_info:
                await excel_btn.click()
            
            download = await download_info.value
            path = os.path.join(os.getcwd(), "exported_data.xlsx")
            await download.save_as(path)
            print(f"Downloaded to: {path}")
            
        except Exception as e:
            print(f"UI Export failed: {e}")
            await page.screenshot(path="export_error_v2.png")
            
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(export_via_ui(url))

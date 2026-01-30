import asyncio
from playwright.async_api import async_playwright
import os

async def export_via_ui(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True) # 改为无头模式以适应环境
        context = await browser.new_context()
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(10)
        
        try:
            # 点击“文件”菜单
            # 腾讯文档的菜单通常在左上角
            print("Looking for 'File' menu...")
            file_menu = await page.wait_for_selector('text="文件"', timeout=10000)
            await file_menu.click()
            await asyncio.sleep(2)
            
            # 点击“导出为”
            print("Looking for 'Export' option...")
            export_option = await page.wait_for_selector('text="导出为"', timeout=5000)
            await export_option.hover()
            await asyncio.sleep(1)
            
            # 点击“本地 Excel 表格 (.xlsx)”
            print("Looking for 'Excel' option...")
            excel_option = await page.wait_for_selector('text="本地 Excel 表格 (.xlsx)"', timeout=5000)
            
            async with page.expect_download() as download_info:
                await excel_option.click()
            
            download = await download_info.value
            path = os.path.join(os.getcwd(), "exported_data.xlsx")
            await download.save_as(path)
            print(f"Downloaded to: {path}")
            
        except Exception as e:
            print(f"UI Export failed: {e}")
            await page.screenshot(path="export_error.png")
            
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(export_via_ui(url))

import asyncio
from playwright.async_api import async_playwright
import os

async def export_via_ui_v3(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # 设置一个很大的视口
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        try:
            # 确保页面在顶部
            await page.evaluate("window.scrollTo(0, 0)")
            await asyncio.sleep(2)
            
            # 尝试点击“文件”菜单
            # 使用更精确的 selector 或者直接点击坐标
            print("Attempting to click 'File' menu...")
            
            # 尝试几种可能的 selector
            selectors = [
                '#header-menu-file',
                '.header-menu-item:has-text("文件")',
                'div[role="menuitem"]:has-text("文件")',
                'text="文件"'
            ]
            
            success = False
            for s in selectors:
                try:
                    el = await page.wait_for_selector(s, timeout=5000)
                    if el:
                        # 尝试点击
                        await el.click(force=True)
                        print(f"Clicked 'File' using {s}")
                        success = True
                        break
                except:
                    continue
            
            if not success:
                # 尝试快捷键 Alt+F (Windows) 或 Ctrl+Option+F (Mac)
                print("Selector failed, trying Alt+F...")
                await page.keyboard.press("Alt+f")
                await asyncio.sleep(2)
            
            # 检查菜单是否打开
            # 菜单打开后应该能看到“导出为”
            try:
                export_item = await page.wait_for_selector('text="导出为"', timeout=5000)
                print("Found 'Export' item, hovering...")
                await export_item.hover()
                await asyncio.sleep(1)
                
                # 点击“本地 Excel 表格”
                print("Looking for Excel option...")
                excel_item = await page.wait_for_selector('text="本地 Excel 表格 (.xlsx)"', timeout=5000)
                
                async with page.expect_download() as download_info:
                    await excel_item.click()
                
                download = await download_info.value
                path = os.path.join(os.getcwd(), "exported_data.xlsx")
                await download.save_as(path)
                print(f"Successfully exported to {path}")
                return path
            except Exception as e:
                print(f"Failed to find menu items: {e}")
                await page.screenshot(path="export_fail_v3.png")
                
        except Exception as e:
            print(f"Export failed: {e}")
            await page.screenshot(path="export_error_v3.png")
            
        await browser.close()
        return None

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(export_via_ui_v3(url))

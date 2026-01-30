import asyncio
from playwright.async_api import async_playwright
import os

async def try_export_excel(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(15)
        
        # 尝试寻找“文件”菜单并点击
        # 腾讯文档的顶部菜单通常在特定的容器中
        try:
            # 这里的选择器需要根据实际 DOM 调整，通常包含 '文件' 字样
            file_menu = page.locator("text='文件'")
            if await file_menu.is_visible():
                print("Found 'File' menu, clicking...")
                await file_menu.click()
                await asyncio.sleep(2)
                
                # 寻找“导出”
                export_item = page.locator("text='导出'")
                if await export_item.is_visible():
                    print("Found 'Export' item, clicking...")
                    await export_item.hover() # 导出通常是二级菜单
                    await asyncio.sleep(1)
                    
                    # 寻找“本地Excel”
                    excel_item = page.locator("text='本地 Excel'")
                    if await excel_item.is_visible():
                        print("Found 'Local Excel', triggering download...")
                        async with page.expect_download() as download_info:
                            await excel_item.click()
                        download = await download_info.value
                        path = await download.path()
                        dest = "tencent_exported.xlsx"
                        await download.save_as(dest)
                        print(f"Downloaded to {dest}")
                        return dest
                    else:
                        print("Could not find 'Local Excel' item.")
                else:
                    print("Could not find 'Export' item.")
            else:
                print("Could not find 'File' menu.")
        except Exception as e:
            print(f"Error during export attempt: {e}")
            # 截图保存，用于排查
            await page.screenshot(path="export_error.png")
            print("Saved screenshot to export_error.png")
            
        await browser.close()
        return None

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(try_export_excel(url))

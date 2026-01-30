import asyncio
from playwright.async_api import async_playwright
import os

async def export_via_api_with_context(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        print(f"Opening sheet to get cookies: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(15)
        
        # 获取 padId
        pad_id = "DZWRnU29OdGR2bEtD" # 从 URL 提取
        export_url = f"https://docs.qq.com/cgi-bin/online_edit/export_excel?id={pad_id}&type=sheet"
        
        print(f"Triggering export via API: {export_url}")
        try:
            async with page.expect_download(timeout=30000) as download_info:
                await page.goto(export_url)
            
            download = await download_info.value
            dest = "tencent_direct_export.xlsx"
            await download.save_as(dest)
            print(f"Successfully exported to {dest}")
            return dest
        except Exception as e:
            print(f"Export failed: {e}")
            # 检查是否有错误提示
            content = await page.content()
            if "登录" in content:
                print("Export requires login.")
            else:
                print(f"Page content snippet: {content[:500]}")
        
        await browser.close()
        return None

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(export_via_api_with_context(url))

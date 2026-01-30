import asyncio
from playwright.async_api import async_playwright
import json

async def fetch_via_copy_final_attempt(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            permissions=["clipboard-read", "clipboard-write"],
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        # 注入脚本
        await page.add_init_script("""
            window._copiedData = null;
            document.addEventListener('copy', (e) => {
                const html = e.clipboardData.getData('text/html');
                const text = e.clipboardData.getData('text/plain');
                window._copiedData = { html, text };
            });
        """)
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(20)
        
        # 尝试寻找并点击 Tab
        try:
            tab_text = "1月体验明细"
            print(f"Clicking tab: {tab_text}")
            await page.click(f"text='{tab_text}'", timeout=5000)
            await asyncio.sleep(5)
        except:
            print("Tab not found, continuing...")
            
        # 聚焦 Canvas
        print("Focusing canvas and copying...")
        canvas = page.locator("canvas").first
        if await canvas.is_visible():
            await canvas.click()
            await asyncio.sleep(1)
            # 模拟全选和复制
            for _ in range(3): # 多试几次
                await page.keyboard.press("Control+a")
                await asyncio.sleep(0.5)
                await page.keyboard.press("Control+c")
                await asyncio.sleep(1)
                
                data = await page.evaluate("window._copiedData")
                if data and (data.get('text') or data.get('html')):
                    print("Successfully captured copy data!")
                    await browser.close()
                    return data
        
        await browser.close()
        return None

async def main():
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    data = await fetch_via_copy_final_attempt(url)
    if data:
        with open("final_copy_data.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Final copy data saved to final_copy_data.json")
    else:
        print("Final copy attempt failed.")

if __name__ == "__main__":
    asyncio.run(main())

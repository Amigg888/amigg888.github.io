import asyncio
from playwright.async_api import async_playwright
import json

async def fetch_via_clipboard_refined(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # 允许剪贴板访问
        context = await browser.new_context(
            permissions=["clipboard-read", "clipboard-write"],
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        # 注入脚本监听剪贴板内容
        await page.add_init_script("""
            window._copiedData = null;
            document.addEventListener('copy', (e) => {
                const html = e.clipboardData.getData('text/html');
                const text = e.clipboardData.getData('text/plain');
                window._copiedData = { html, text };
                console.log('Copy event detected!');
            });
        """)
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="networkidle", timeout=60000)
        await asyncio.sleep(15)
        
        # 点击 Canvas 中心以激活
        print("Clicking canvas...")
        await page.mouse.click(500, 500)
        await asyncio.sleep(1)
        
        # 全选 (Ctrl+A / Cmd+A)
        print("Selecting all...")
        # 尝试多种组合
        for key in ["Control", "Meta"]:
            await page.keyboard.press(f"{key}+a")
            await asyncio.sleep(1)
            await page.keyboard.press(f"{key}+c")
            await asyncio.sleep(2)
            
            data = await page.evaluate("window._copiedData")
            if data and (data.get('text') or data.get('html')):
                print(f"Success with {key}!")
                break
        else:
            # 如果全选没用，尝试点击左上角再全选
            print("Trying alternative selection...")
            await page.mouse.click(100, 200) # 约 A1 单元格位置
            await asyncio.sleep(1)
            await page.keyboard.press("Control+a")
            await asyncio.sleep(1)
            await page.keyboard.press("Control+c")
            await asyncio.sleep(2)
            data = await page.evaluate("window._copiedData")

        await browser.close()
        return data

async def main():
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    data = await fetch_via_clipboard_refined(url)
    if data:
        with open("tencent_clipboard_data.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Clipboard data saved to tencent_clipboard_data.json")
        if data.get('text'):
            print(f"Sample text: {data['text'][:200]}")
    else:
        print("Failed to capture clipboard data.")

if __name__ == "__main__":
    asyncio.run(main())

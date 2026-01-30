import asyncio
from playwright.async_api import async_playwright
import json

async def capture_via_clipboard_mac(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # 给予剪贴板权限
        context = await browser.new_context(
            permissions=["clipboard-read", "clipboard-write"],
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        # 注入脚本监听复制事件
        await page.add_init_script("""
            window._copiedData = null;
            document.addEventListener('copy', (e) => {
                const html = e.clipboardData.getData('text/html');
                const text = e.clipboardData.getData('text/plain');
                window._copiedData = { html, text };
                console.log('Copy event triggered!');
            });
        """)
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(20)
        
        # 确保点击了表格区域
        print("Clicking table center...")
        await page.mouse.click(500, 500)
        await asyncio.sleep(2)
        
        # 尝试多种快捷键组合
        keys_to_try = [
            ["Meta+a", "Meta+c"],
            ["Control+a", "Control+c"],
        ]
        
        for keys in keys_to_try:
            print(f"Trying keys: {keys}")
            await page.keyboard.press(keys[0])
            await asyncio.sleep(1)
            await page.keyboard.press(keys[1])
            await asyncio.sleep(2)
            
            data = await page.evaluate("window._copiedData")
            if data and (data.get('text') or data.get('html')):
                print("SUCCESS! Captured data via clipboard.")
                await browser.close()
                return data
        
        # 如果还是不行，尝试点击左上角的“全选”按钮
        # 腾讯文档左上角通常有一个全选方块
        print("Trying to click 'Select All' corner...")
        await page.mouse.click(35, 185) # 约略位置
        await asyncio.sleep(1)
        await page.keyboard.press("Meta+c")
        await asyncio.sleep(2)
        
        data = await page.evaluate("window._copiedData")
        if data:
            print("SUCCESS! Captured data via corner click.")
            await browser.close()
            return data

        await browser.close()
    return None

async def main():
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    data = await capture_via_clipboard_mac(url)
    if data:
        with open("clipboard_result.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Data saved to clipboard_result.json")
    else:
        print("Clipboard capture failed.")

if __name__ == "__main__":
    asyncio.run(main())

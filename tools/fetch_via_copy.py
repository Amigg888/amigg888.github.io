import asyncio
from playwright.async_api import async_playwright

async def copy_paste_extract(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # 使用 Mac 快捷键 (Meta) 还是 Windows (Control)?
        # Playwright 默认模拟的是 Linux/Windows
        
        context = await browser.new_context()
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        # 点击页面中心以聚焦
        await page.mouse.click(500, 500)
        await asyncio.sleep(2)
        
        print("Selecting all and copying...")
        # 尝试 Control+A, Control+C
        await page.keyboard.press("Control+KeyA")
        await asyncio.sleep(1)
        await page.keyboard.press("Control+KeyC")
        await asyncio.sleep(2)
        
        # 尝试在页面上创建一个 textarea 并粘贴
        print("Pasting into temporary textarea...")
        data = await page.evaluate("""
            async () => {
                const ta = document.createElement('textarea');
                ta.id = 'temp-pastebox';
                document.body.appendChild(ta);
                ta.focus();
                // 尝试执行粘贴
                document.execCommand('paste'); 
                // 注意：由于安全限制，execCommand('paste') 可能不起作用
                // 但我们可以尝试监听 paste 事件
                return new Promise((resolve) => {
                    ta.addEventListener('paste', (e) => {
                        const text = e.clipboardData.getData('text');
                        resolve(text);
                    });
                    // 如果 5 秒内没粘贴成功，返回错误
                    setTimeout(() => resolve("Paste failed or timed out"), 5000);
                    
                    // 模拟粘贴快捷键
                    const pasteEvent = new KeyboardEvent('keydown', {
                        key: 'v',
                        ctrlKey: true,
                        bubbles: true
                    });
                    ta.dispatchEvent(pasteEvent);
                });
            }
        """)
        
        print(f"Result: {data[:500]}...")
        
        if "Paste failed" not in data:
            with open("pasted_data.txt", "w", encoding="utf-8") as f:
                f.write(data)
            print("Saved to pasted_data.txt")
            
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(copy_paste_extract(url))

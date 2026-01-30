import asyncio
from playwright.async_api import async_playwright
import json

async def capture_via_textarea(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(20)
        
        # 点击表格中心
        await page.mouse.click(500, 500)
        await asyncio.sleep(2)
        
        # 尝试复制
        print("Pressing Control+A and Control+C...")
        await page.keyboard.press("Control+a")
        await asyncio.sleep(1)
        await page.keyboard.press("Control+c")
        await asyncio.sleep(2)
        
        # 查找可能的 textarea
        print("Checking textareas...")
        text_data = await page.evaluate("""
            () => {
                const results = [];
                document.querySelectorAll('textarea').forEach(ta => {
                    results.push({
                        id: ta.id,
                        class: ta.className,
                        value: ta.value
                    });
                });
                return results;
            }
        """)
        
        await browser.close()
        return text_data

async def main():
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    data = await capture_via_textarea(url)
    with open("textarea_capture.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Textarea data saved.")

if __name__ == "__main__":
    asyncio.run(main())

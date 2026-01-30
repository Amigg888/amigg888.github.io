import asyncio
from playwright.async_api import async_playwright

async def get_page_text(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(15)
        
        # 尝试提取所有文本
        text = await page.evaluate("() => document.body.innerText")
        print(f"Extracted {len(text)} characters")
        
        # 搜索关键年份 2026
        if "2026" in text:
            print("Found '2026' in page text!")
            # 打印 2026 附近的文本
            idx = text.find("2026")
            print(text[max(0, idx-100):idx+500])
        else:
            print("'2026' not found in page text.")
            
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(get_page_text(url))

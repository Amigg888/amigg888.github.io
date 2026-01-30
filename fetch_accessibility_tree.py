import asyncio
from playwright.async_api import async_playwright
import json

async def fetch_accessibility_tree(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(20)
        
        # 获取无障碍树
        tree = await page.accessibility.snapshot()
        
        await browser.close()
        return tree

async def main():
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    tree = await fetch_accessibility_tree(url)
    with open("accessibility_tree.json", "w", encoding="utf-8") as f:
        json.dump(tree, f, ensure_ascii=False, indent=2)
    print("Accessibility tree saved to accessibility_tree.json")

if __name__ == "__main__":
    asyncio.run(main())

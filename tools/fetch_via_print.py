import asyncio
from playwright.async_api import async_playwright
import json

async def fetch_via_print_view(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(15)
        
        # 尝试通过快捷键打开打印预览，或者点击打印按钮
        # 腾讯文档的打印预览通常会打开一个新窗口，我们需要捕获它
        async with context.expect_page() as new_page_info:
            print("Triggering print via keyboard...")
            await page.keyboard.press("Control+p")
        
        print_page = await new_page_info.value
        await print_page.wait_for_load_state("load")
        await asyncio.sleep(5)
        
        print(f"Print page opened: {print_page.url}")
        
        # 在打印页面中，数据通常是 HTML table
        content = await print_page.evaluate("""
            () => {
                const rows = [];
                document.querySelectorAll('tr').forEach(tr => {
                    const cells = [];
                    tr.querySelectorAll('td').forEach(td => cells.push(td.innerText.trim()));
                    rows.push(cells);
                });
                return rows;
            }
        """)
        
        await browser.close()
        return content

async def main():
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    data = await fetch_via_print_view(url)
    if data:
        with open("tencent_print_data.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Successfully saved {len(data)} rows to tencent_print_data.json")
    else:
        print("Failed to capture print data.")

if __name__ == "__main__":
    asyncio.run(main())

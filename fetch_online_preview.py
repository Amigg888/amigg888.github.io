import asyncio
from playwright.async_api import async_playwright
import json

async def fetch_preview_data(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        # 加上 preview=1 参数
        preview_url = url + "&preview=1"
        print(f"Opening preview: {preview_url}")
        
        await page.goto(preview_url, wait_until="load", timeout=60000)
        await asyncio.sleep(10)
        
        # 在预览模式下，数据通常直接在 HTML 中
        content = await page.content()
        
        # 提取表格内容
        # 预览模式通常使用标准的 table 或 div 布局
        table_data = await page.evaluate("""
            () => {
                const rows = [];
                const table = document.querySelector('table');
                if (table) {
                    table.querySelectorAll('tr').forEach(tr => {
                        const cells = [];
                        tr.querySelectorAll('td').forEach(td => cells.push(td.innerText.trim()));
                        rows.push(cells);
                    });
                } else {
                    // 尝试 div 布局
                    const grid = document.querySelectorAll('.grid-row');
                    grid.forEach(row => {
                        const cells = [];
                        row.querySelectorAll('.grid-cell').forEach(cell => cells.push(cell.innerText.trim()));
                        rows.push(cells);
                    });
                }
                return rows;
            }
        """)
        
        await browser.close()
        return table_data

async def main():
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    data = await fetch_preview_data(url)
    if data:
        with open("tencent_preview_data.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Successfully saved {len(data)} rows to tencent_preview_data.json")
    else:
        print("No preview data found.")

if __name__ == "__main__":
    asyncio.run(main())

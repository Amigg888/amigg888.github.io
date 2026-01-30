import asyncio
from playwright.async_api import async_playwright
import json

async def capture_screenshot_and_data(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={'width': 1920, 'height': 1080}
        )
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        
        # 等待页面稳定
        await asyncio.sleep(15)
        
        # 截图保存，用于人工确认
        await page.screenshot(path="tencent_debug.png")
        print("Screenshot saved to tencent_debug.png")
        
        # 提取所有可能的全局数据变量
        data = await page.evaluate("""
            () => {
                const result = {};
                // 常见的腾讯文档数据挂载点
                const keys = ['clientVars', 'ssrRenderResult', 'initialState', '__INITIAL_STATE__'];
                keys.forEach(k => {
                    if (window[k]) result[k] = window[k];
                });
                return result;
            }
        """)
        
        # 尝试从 DOM 中抓取可见文本
        text_content = await page.evaluate("""
            () => {
                const items = [];
                // 腾讯文档的 Canvas 渲染器通常会把文本放在一个隐藏的层中
                const elements = document.querySelectorAll('.grid-canvas-container, .grid-container, [role="grid"]');
                elements.forEach(el => {
                    items.push(el.innerText);
                });
                return items;
            }
        """)
        
        await browser.close()
        return {"data": data, "text_content": text_content}

async def main():
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    result = await capture_screenshot_and_data(url)
    with open("tencent_full_dump.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print("Full dump saved to tencent_full_dump.json")

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
from playwright.async_api import async_playwright
import json
import os

async def fetch_tencent_docs_interactive(url):
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
        await asyncio.sleep(10)
        
        # 尝试切换 Tab 并抓取
        tabs = ["1月体验明细", "1月报课明细"]
        all_data = {}
        
        for tab_name in tabs:
            print(f"Switching to tab: {tab_name}")
            try:
                # 寻找包含 tab 名字的元素并点击
                tab_selector = f"text='{tab_name}'"
                if await page.is_visible(tab_selector):
                    await page.click(tab_selector)
                    await asyncio.sleep(5) # 等待切换加载
                    
                    # 抓取当前视图下的所有文本
                    # 腾讯文档的 Canvas 渲染器通常会有一个同步的 DOM 层用于辅助功能
                    # 尝试抓取所有可见文本
                    content = await page.evaluate("""
                        () => {
                            const results = [];
                            // 尝试抓取所有可能有内容的 div
                            const divs = document.querySelectorAll('div');
                            for (const div of divs) {
                                // 过滤掉太长的（可能是代码/样式）和太短的
                                const text = div.innerText.trim();
                                if (text && text.length < 100 && div.children.length === 0) {
                                    results.push(text);
                                }
                            }
                            return results;
                        }
                    """)
                    all_data[tab_name] = content
                    print(f"Found {len(content)} entries for {tab_name}")
                else:
                    print(f"Tab {tab_name} not found")
            except Exception as e:
                print(f"Error on tab {tab_name}: {e}")
        
        await browser.close()
        return all_data

async def main():
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    data = await fetch_tencent_docs_interactive(url)
    if data:
        with open("tencent_tabs_content.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Successfully saved tab content to tencent_tabs_content.json")
    else:
        print("No data found.")

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
from playwright.async_api import async_playwright
import json

async def explore_window(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        # 探索 window 对象
        # 查找包含 'pad', 'sheet', 'spread', 'data' 的键
        data = await page.evaluate("""
            () => {
                const results = {};
                for (let key in window) {
                    if (key.toLowerCase().includes('pad') || 
                        key.toLowerCase().includes('sheet') || 
                        key.toLowerCase().includes('spread')) {
                        try {
                            const val = window[key];
                            if (typeof val === 'object' && val !== null) {
                                results[key] = Object.keys(val).slice(0, 20); // 只取前20个键
                            } else {
                                results[key] = typeof val;
                            }
                        } catch(e) {
                            results[key] = "error";
                        }
                    }
                }
                return results;
            }
        """)
        
        print("Found interesting window objects:")
        print(json.dumps(data, indent=2))
        
        # 尝试查找具体的表格数据
        # Tencent Docs 经常把数据存在某个深度嵌套的对象里
        # 比如 window.pad.spreadsheet.model
        more_data = await page.evaluate("""
            () => {
                const paths = [
                    'pad.spreadsheet.model',
                    'sheet.model',
                    'spreadsheet.model',
                    'clientVars.collab_client_vars.initialAttributedText'
                ];
                const found = {};
                paths.forEach(p => {
                    try {
                        let obj = window;
                        p.split('.').forEach(part => obj = obj[part]);
                        found[p] = "found! type: " + typeof obj;
                        if (typeof obj === 'object') {
                            found[p + "_keys"] = Object.keys(obj).slice(0, 20);
                        }
                    } catch(e) {
                        found[p] = "not found";
                    }
                });
                return found;
            }
        """)
        print("\nChecking specific paths:")
        print(json.dumps(more_data, indent=2))
        
        await browser.close()

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(explore_window(url))

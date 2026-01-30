import asyncio
from playwright.async_api import async_playwright
import json
import re
import os

async def fetch_tencent_docs_data(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # 设置更详细的浏览器上下文
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={'width': 1920, 'height': 1080}
        )
        page = await context.new_page()
        
        # 拦截所有响应，寻找数据接口
        intercepted_data = []
        async def handle_response(response):
            # 腾讯文档常见的数据加载接口
            if any(k in response.url for k in ["load_sheet", "get_line_data", "get_sheet_data"]):
                print(f"Intercepted data request: {response.url}")
                try:
                    text = await response.text()
                    # 有些是 protobuf，有些是 JSON，先存下来
                    intercepted_data.append({
                        "url": response.url,
                        "content": text[:1000] # 记录前1000个字符用于分析
                    })
                except:
                    pass
        
        page.on("response", handle_response)
        
        print(f"Loading page: {url}")
        
        try:
            # 增加超时时间，并改用 load 模式
            await page.goto(url, wait_until="load", timeout=60000)
            print("Page loaded, waiting for data rendering...")
            
            # 等待较长时间确保数据加载和渲染
            await asyncio.sleep(20)
            
            # 策略 1: 提取 SSR 数据或全局变量
            global_vars = await page.evaluate("""
                () => {
                    const result = {};
                    if (window.clientVars) result.clientVars = window.clientVars;
                    if (window.ssrRenderResult) result.ssrRenderResult = window.ssrRenderResult;
                    return result;
                }
            """)
            
            # 策略 2: 提取无障碍/搜索层文本 (腾讯文档通常会把文字放在一些隐藏的 div 中)
            text_nodes = await page.evaluate("""
                () => {
                    const nodes = [];
                    // 寻找可能的文本容器
                    const selectors = ['.cell-text', '.grid-cell-text', '.text-content', 'div[role="gridcell"]'];
                    for (const sel of selectors) {
                        document.querySelectorAll(sel).forEach(el => {
                            if (el.innerText.trim()) nodes.push(el.innerText.trim());
                        });
                    }
                    // 如果上面没找到，尝试全文搜索短文本块
                    if (nodes.length === 0) {
                        const all = document.querySelectorAll('div, span');
                        all.forEach(el => {
                            if (el.children.length === 0 && el.innerText.trim().length > 0 && el.innerText.trim().length < 50) {
                                nodes.push(el.innerText.trim());
                            }
                        });
                    }
                    return nodes;
                }
            """)
            
            # 综合结果
            result = {
                "url": url,
                "global_vars": global_vars,
                "intercepted": intercepted_data,
                "text_nodes": text_nodes[:200] # 限制数量
            }
            
            return result
                
        except Exception as e:
            print(f"Error during scraping: {e}")
            return None
        finally:
            await browser.close()

async def main():
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    data = await fetch_tencent_docs_data(url)
    if data:
        with open("tencent_online_data.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Successfully fetched online data to tencent_online_data.json")
        
        # 简单校验是否拿到了关键信息
        nodes = data.get("text_nodes", [])
        print(f"Found {len(nodes)} text nodes.")
        if any("体验" in n for n in nodes) or any("报课" in n for n in nodes):
            print("Detected relevant keywords in text nodes!")
        else:
            print("No relevant keywords found in text nodes. Checking global vars...")
            cv = data.get("global_vars", {}).get("clientVars", {})
            if cv:
                print(f"Title: {cv.get('title')}")
    else:
        print("Failed to fetch data.")

if __name__ == "__main__":
    asyncio.run(main())

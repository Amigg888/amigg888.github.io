import asyncio
from playwright.async_api import async_playwright
import json

async def inspect_client_vars(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        await asyncio.sleep(20)
        
        # 深度探索 clientVars
        analysis = await page.evaluate("""
            () => {
                const getStructure = (obj, depth = 0) => {
                    if (depth > 5 || obj === null || typeof obj !== 'object') return typeof obj;
                    const result = {};
                    for (let key in obj) {
                        try {
                            const val = obj[key];
                            if (Array.isArray(val)) {
                                result[key] = `Array(${val.length})`;
                                if (val.length > 0 && depth < 3) {
                                    result[key + '_sample'] = getStructure(val[0], depth + 1);
                                }
                            } else if (typeof val === 'object') {
                                result[key] = getStructure(val, depth + 1);
                            } else {
                                result[key] = typeof val;
                                if (typeof val === 'string' && val.length > 100) {
                                    result[key] = `String(${val.length})`;
                                }
                            }
                        } catch(e) { result[key] = 'error'; }
                    }
                    return result;
                };
                return {
                    clientVars: getStructure(window.clientVars),
                    ssr: window.ssrRenderResult ? 'exists' : 'null'
                };
            }
        """)
        
        await browser.close()
        return analysis

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    result = asyncio.run(inspect_client_vars(url))
    with open("client_vars_structure.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print("Structure saved to client_vars_structure.json")

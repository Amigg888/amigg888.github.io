import asyncio
from playwright.async_api import async_playwright
import json
import base64
import zlib
import re

async def capture_all_data(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        
        intercepted_data = []

        async def handle_response(response):
            if "dop-api/get/sheet" in response.url or "dop-api/get/load_sheet" in response.url:
                try:
                    text = await response.text()
                    intercepted_data.append({
                        "url": response.url,
                        "content": text
                    })
                    print(f"Captured: {response.url[:100]}...")
                except:
                    pass

        page.on("response", handle_response)
        
        print(f"Opening: {url}")
        await page.goto(url, wait_until="load", timeout=60000)
        
        # 滚动页面以触发更多数据加载
        print("Scrolling...")
        for i in range(5):
            await page.mouse.wheel(0, 2000)
            await asyncio.sleep(2)
            
        # 等待一段时间确保所有请求完成
        await asyncio.sleep(10)
        
        with open("intercepted_raw_v2.json", "w", encoding="utf-8") as f:
            json.dump(intercepted_data, f, ensure_ascii=False, indent=2)
            
        await browser.close()
        return len(intercepted_data)

def extract_strings(data):
    results = []
    # 尝试匹配 UTF-8 中文和英文
    pattern = re.compile(rb'[\xe4-\xe9][\x80-\xbf]{2}|[\x20-\x7e]{2,}')
    matches = pattern.findall(data)
    for m in matches:
        try:
            text = m.decode('utf-8').strip()
            if len(text) > 1:
                results.append(text)
        except:
            continue
    return results

def process_intercepts():
    with open("intercepted_raw_v2.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    
    all_strings = set()
    for entry in data:
        try:
            body = json.loads(entry['content'])
            def find_b64(obj):
                if isinstance(obj, str):
                    if len(obj) > 10:
                        try:
                            # 尝试 base64
                            decoded = base64.b64decode(obj)
                            # 尝试解压
                            try:
                                decompressed = zlib.decompress(decoded)
                                strings = extract_strings(decompressed)
                                for s in strings: all_strings.add(s)
                            except:
                                strings = extract_strings(decoded)
                                for s in strings: all_strings.add(s)
                        except:
                            pass
                elif isinstance(obj, dict):
                    for v in obj.values(): find_b64(v)
                elif isinstance(obj, list):
                    for v in obj: find_b64(v)
            
            find_b64(body)
        except:
            pass
            
    sorted_strings = sorted(list(all_strings))
    with open("captured_strings_v2.json", "w", encoding="utf-8") as f:
        json.dump(sorted_strings, f, ensure_ascii=False, indent=2)
    
    print(f"Found {len(sorted_strings)} unique strings.")
    # 打印前 50 个包含中文的字符串
    chinese_count = 0
    for s in sorted_strings:
        if re.search('[\u4e00-\u9fa5]', s):
            print(f"Chinese: {s}")
            chinese_count += 1
            if chinese_count > 50: break

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    # asyncio.run(capture_all_data(url))
    process_intercepts()

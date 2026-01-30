import json
import base64
import zlib
import re

def extract_all_printable(data):
    # 匹配连续的可打印字符或中文字符
    # 中文字符范围: \u4e00-\u9fa5
    # 我们直接寻找连续的字节，然后尝试解码
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

def main():
    with open("all_sheet_intercepts.json", "r", encoding="utf-8") as f:
        intercepts = json.load(f)
    
    parsed_results = {}
    
    for entry in intercepts:
        url = entry['url']
        sub_id_match = re.search(r'subId=([^&]+)', url)
        sub_id = sub_id_match.group(1) if sub_id_match else "unknown"
        
        if sub_id not in parsed_results:
            parsed_results[sub_id] = []
            
        try:
            body = json.loads(entry['content'])
            if 'data' in body and 'initialAttributedText' in body['data']:
                texts = body['data']['initialAttributedText'].get('text', [])
                for item in texts:
                    if 'related_sheet' in item:
                        raw_b64 = item['related_sheet']
                        decoded = base64.b64decode(raw_b64)
                        decompressed = zlib.decompress(decoded)
                        strings = extract_all_printable(decompressed)
                        parsed_results[sub_id].extend(strings)
        except Exception as e:
            pass
            
    with open("extracted_text_raw.json", "w", encoding="utf-8") as f:
        json.dump(parsed_results, f, ensure_ascii=False, indent=2)
    
    for sub_id, strings in parsed_results.items():
        print(f"Tab {sub_id}: found {len(strings)} strings.")
        # 打印前 20 个字符串看看
        print(f"Sample: {strings[:20]}")

if __name__ == "__main__":
    main()

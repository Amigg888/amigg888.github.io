import json
import base64
import re

def extract_strings(binary_data):
    # 匹配 UTF-8 字符序列 (中文字符范围)
    # 中文范围: \u4e00-\u9fa5
    # 简单的做法是寻找连续的可打印字符
    try:
        # 尝试寻找中文字符
        matches = re.findall(r'[\u4e00-\u9fa5a-zA-Z0-9\-\:\.]{2,}', binary_data.decode('utf-8', errors='ignore'))
        return matches
    except:
        return []

def main():
    with open("captured_intercepts.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    
    all_extracted = []
    for entry in data:
        if 'data' in entry and 'data' in entry['data'] and 'initialAttributedText' in entry['data']['data']:
            texts = entry['data']['data']['initialAttributedText'].get('text', [])
            for item in texts:
                if 'related_sheet' in item:
                    raw_b64 = item['related_sheet']
                    try:
                        decoded = base64.b64decode(raw_b64)
                        # 提取其中的字符串
                        strings = extract_strings(decoded)
                        if strings:
                            all_extracted.append({
                                "url": entry['url'],
                                "strings": strings
                            })
                    except:
                        continue
    
    with open("extracted_strings.json", "w", encoding="utf-8") as f:
        json.dump(all_extracted, f, ensure_ascii=False, indent=2)
    print(f"Extracted strings from {len(all_extracted)} sources.")

if __name__ == "__main__":
    main()

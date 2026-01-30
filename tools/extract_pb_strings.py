import base64
import zlib
import json
import re

def extract_protobuf_strings(data):
    """
    非常简单的 Protobuf 字符串提取逻辑。
    字符串字段通常是: [Tag & Type] [Length] [Data]
    Tag 1, Type 2 (string) = 0x0a
    """
    results = []
    i = 0
    while i < len(data):
        # 寻找 Tag 1 (0x0a)
        if data[i] == 0x0a:
            i += 1
            if i >= len(data): break
            # 读取长度 (简单处理，假设长度 < 128)
            length = data[i]
            i += 1
            if i + length <= len(data):
                content = data[i:i+length]
                try:
                    text = content.decode('utf-8')
                    if len(text) > 1: # 忽略单字符
                        results.append(text)
                except:
                    pass
                i += length
            else:
                break
        else:
            i += 1
    return results

def main():
    with open("captured_intercepts.json", "r", encoding="utf-8") as f:
        intercepts = json.load(f)
    
    all_data = []
    for entry in intercepts:
        if 'data' in entry and 'data' in entry['data'] and 'initialAttributedText' in entry['data']['data']:
            texts = entry['data']['data']['initialAttributedText'].get('text', [])
            for item in texts:
                if 'related_sheet' in item:
                    raw_b64 = item['related_sheet']
                    try:
                        decoded = base64.b64decode(raw_b64)
                        decompressed = zlib.decompress(decoded)
                        strings = extract_protobuf_strings(decompressed)
                        if strings:
                            all_data.append({
                                "url": entry['url'],
                                "strings": strings
                            })
                    except Exception as e:
                        print(f"Error decoding: {e}")
                        continue
    
    with open("protobuf_extracted_strings.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print(f"Extracted strings from {len(all_data)} items.")

if __name__ == "__main__":
    main()

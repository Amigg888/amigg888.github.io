import json
import base64
import zlib
import re

def extract_strings(data):
    results = []
    # 匹配 UTF-8 中文
    pattern = re.compile(rb'[\xe4-\xe9][\x80-\xbf]{2,}')
    matches = pattern.findall(data)
    for m in matches:
        try:
            text = m.decode('utf-8').strip()
            if len(text) > 0:
                results.append(text)
        except:
            continue
    return results

def process():
    try:
        with open("intercepted_raw_v2.json", "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading file: {e}")
        return

    all_found = []
    
    for entry in data:
        content = entry.get('content', '')
        # 寻找所有的 "related_sheet":"..."
        matches = re.findall(r'"related_sheet":"([^"]+)"', content)
        for b64_str in matches:
            try:
                # 修复 padding
                missing_padding = len(b64_str) % 4
                if missing_padding:
                    b64_str += '=' * (4 - missing_padding)
                
                decoded = base64.b64decode(b64_str)
                try:
                    decompressed = zlib.decompress(decoded)
                    strings = extract_strings(decompressed)
                    all_found.extend(strings)
                except Exception as e:
                    # 尝试 raw strings
                    strings = extract_strings(decoded)
                    all_found.extend(strings)
            except:
                pass

    # 过滤掉重复和太短的
    unique_found = []
    seen = set()
    for s in all_found:
        if s not in seen and len(s) > 1:
            unique_found.append(s)
            seen.add(s)
            
    print(f"Total unique strings found: {len(unique_found)}")
    for s in unique_found[:100]:
        print(s)

    with open("final_extracted_strings.json", "w", encoding="utf-8") as f:
        json.dump(unique_found, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    process()

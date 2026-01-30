import os
import json
import base64
import zlib

def try_decode(data_str):
    try:
        # 尝试 Base64 解码
        decoded = base64.b64decode(data_str)
        # 尝试 Zlib 解压缩
        try:
            return zlib.decompress(decoded).decode('utf-8', errors='ignore')
        except:
            # 尝试 raw inflate (no header)
            try:
                return zlib.decompress(decoded, -zlib.MAX_WBITS).decode('utf-8', errors='ignore')
            except:
                return decoded.decode('utf-8', errors='ignore')
    except Exception as e:
        return f"Error: {e}"

def extract_from_responses():
    results = {}
    if not os.path.exists("responses"):
        print("Responses directory not found.")
        return
    
    for filename in os.listdir("responses"):
        if filename.endswith(".json"):
            try:
                with open(os.path.join("responses", filename), "r", encoding="utf-8") as f:
                    content = f.read()
                    if "initialAttributedText" in content:
                        data = json.loads(content)
                        # 腾讯文档的数据结构比较深
                        # 可能是 data['data']['initialAttributedText']['text']
                        text_list = []
                        if 'data' in data and 'initialAttributedText' in data['data']:
                            text_list = data['data']['initialAttributedText'].get('text', [])
                        
                        for i, item in enumerate(text_list):
                            if 'related_sheet' in item:
                                raw_val = item['related_sheet']
                                decoded_val = try_decode(raw_val)
                                results[f"{filename}_{i}"] = decoded_val
            except:
                continue
    
    with open("decoded_responses.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"Decoded {len(results)} items to decoded_responses.json")

if __name__ == "__main__":
    extract_from_responses()

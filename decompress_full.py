import json
import base64
import zlib
import re

def decompress_full():
    try:
        with open("intercepted_raw_v2.json", "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading file: {e}")
        return

    for entry in data:
        content = entry.get('content', '')
        url = entry.get('url', '')
        
        # 寻找 related_sheet
        matches = re.findall(r'"related_sheet":"([^"]+)"', content)
        if not matches:
            continue
            
        print(f"\nProcessing URL: {url[:100]}...")
        for i, b64_str in enumerate(matches):
            print(f"  String {i} length: {len(b64_str)}")
            try:
                # 修复 padding
                missing_padding = len(b64_str) % 4
                if missing_padding:
                    b64_str += '=' * (4 - missing_padding)
                
                decoded = base64.b64decode(b64_str)
                decompressed = zlib.decompress(decoded)
                
                # 保存解压后的原始数据
                filename = f"decompressed_{len(b64_str)}.bin"
                with open(filename, "wb") as bf:
                    bf.write(decompressed)
                print(f"  Successfully decompressed! Saved to {filename}")
                
                # 尝试以 UTF-8 读取（可能会有二进制，所以用 ignore）
                text = decompressed.decode('utf-8', errors='ignore')
                print(f"  Text snippet: {text[:200]}")
                
                # 寻找中文字符
                chinese = re.findall(r'[\u4e00-\u9fa5]+', text)
                if chinese:
                    print(f"  Found {len(chinese)} Chinese segments. Samples: {chinese[:10]}")
                
            except Exception as e:
                print(f"  Failed to decompress: {e}")

if __name__ == "__main__":
    decompress_full()

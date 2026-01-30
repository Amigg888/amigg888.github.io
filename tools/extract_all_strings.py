import re

def extract_all_strings(filename):
    with open(filename, "rb") as f:
        data = f.read()
    
    # 提取所有连续的 UTF-8 字符 (包括中文和英文/数字)
    # 中文范围: \xe4\xb8\x80 到 \xe9\xbe\xaf
    # 我们也想要数字和日期
    pattern = re.compile(rb'[\xe4-\xe9][\x80-\xbf]{2,}|[a-zA-Z0-9\-\:\. ]{2,}')
    matches = pattern.findall(data)
    
    results = []
    for m in matches:
        try:
            text = m.decode('utf-8').strip()
            if text:
                results.append(text)
        except:
            continue
            
    return results

if __name__ == "__main__":
    for f in ["decompressed_2144.bin", "decompressed_7352.bin"]:
        print(f"\n--- Strings in {f} ---")
        strs = extract_all_strings(f)
        for s in strs:
            print(s)

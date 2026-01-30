import re

def extract_strings_with_lengths(file_path):
    with open(file_path, 'rb') as f:
        data = f.read()
    
    # 查找所有可能是字符串的部分
    # 在 Protobuf 中，字符串通常以 tag|wire_type 开头，然后是长度
    # 比如 0a [len] [bytes]
    
    results = []
    i = 0
    while i < len(data):
        # 寻找 0a (tag 1, wire type 2)
        if data[i] == 0x0a:
            if i + 1 < len(data):
                length = data[i+1]
                if 0 < length < 100 and i + 2 + length <= len(data):
                    try:
                        s = data[i+2 : i+2+length].decode('utf-8')
                        # 检查是否包含中文字符或者是数字
                        if any('\u4e00' <= c <= '\u9fff' for c in s) or s.isdigit():
                            results.append(s)
                            i += 2 + length
                            continue
                    except:
                        pass
        i += 1
    return results

if __name__ == "__main__":
    file_path = 'decompressed_7352.bin'
    strings = extract_strings_with_lengths(file_path)
    
    # 打印前 200 个字符串
    for s in strings[:200]:
        print(s)
    
    with open("extracted_strings_v2.txt", "w", encoding="utf-8") as f:
        for s in strings:
            f.write(s + "\n")

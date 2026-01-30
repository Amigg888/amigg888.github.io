import json
import re

def search_data():
    try:
        with open("intercepted_raw_v2.json", "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error: {e}")
        return

    # 常见的中文字符和数字模式
    patterns = [
        r'2026',
        r'体验',
        r'报课',
        r'学员',
        r'[\u4e00-\u9fa5]{2,}', # 连续两个中文字符
    ]
    
    for entry in data:
        content = entry.get('content', '')
        url = entry.get('url', '')
        
        for p in patterns:
            if re.search(p, content):
                print(f"Found pattern '{p}' in URL: {url[:100]}...")
                # 打印匹配到的上下文
                match = re.search(p, content)
                start = max(0, match.start() - 50)
                end = min(len(content), match.end() + 100)
                print(f"Context: {content[start:end]}")
                print("-" * 40)

if __name__ == "__main__":
    search_data()

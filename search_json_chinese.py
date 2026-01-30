import json
import re

def find_chinese(obj):
    results = []
    if isinstance(obj, str):
        if re.search('[\u4e00-\u9fa5]', obj):
            results.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            results.extend(find_chinese(v))
    elif isinstance(obj, list):
        for v in obj:
            results.extend(find_chinese(v))
    return results

def main():
    with open("all_sheet_intercepts.json", "r", encoding="utf-8") as f:
        intercepts = json.load(f)
    
    for entry in intercepts:
        print(f"URL: {entry['url'][:100]}...")
        try:
            body = json.loads(entry['content'])
            chinese = find_chinese(body)
            if chinese:
                print(f"  Found {len(chinese)} Chinese strings: {chinese[:10]}")
            else:
                print("  No Chinese strings found in JSON.")
        except:
            print("  Failed to parse JSON body.")

if __name__ == "__main__":
    main()

import json

def check_text_objects():
    try:
        with open("intercepted_raw_v2.json", "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error: {e}")
        return

    for entry in data:
        content = entry.get('content', '')
        if 'initialAttributedText' in content:
            try:
                js = json.loads(content)
                text_list = js.get('data', {}).get('initialAttributedText', {}).get('text', [])
                print(f"URL: {entry.get('url')[:100]}...")
                print(f"Found {len(text_list)} text objects")
                for obj in text_list[:50]: # 查看前50个
                    # 打印非 related_sheet 的对象
                    if 'related_sheet' not in obj:
                        print(obj)
                    else:
                        # 如果是 related_sheet，打印长度
                        print(f"related_sheet length: {len(obj['related_sheet'])}")
            except:
                continue

if __name__ == "__main__":
    check_text_objects()

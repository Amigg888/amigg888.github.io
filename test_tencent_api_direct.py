import requests
import json

def fetch_sheet_api(local_id, sub_id):
    url = f"https://docs.qq.com/cgi-bin/online_edit/load_sheet?localId={local_id}&subId={sub_id}&is_master_db=0"
    headers = {
        "Referer": f"https://docs.qq.com/sheet/{local_id}",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    
    print(f"Fetching API: {url}")
    response = requests.get(url, headers=headers)
    
    # 腾讯文档的响应可能包含一些安全前缀，如 "/*{" or similar
    text = response.text
    print(f"Raw response length: {len(text)}")
    print(f"Response preview: {text[:200]}")
    
    try:
        # 尝试清理可能的前缀
        if text.startswith("/*"):
            text = text[text.find("{"):text.rfind("}")+1]
        
        data = json.loads(text)
        return data
    except Exception as e:
        print(f"JSON parse error: {e}")
        return None

if __name__ == "__main__":
    local_id = "edgSoNtdvlKC"
    # 尝试两个 tab
    for sub_id in ["facejs", "tz0b9p"]:
        data = fetch_sheet_api(local_id, sub_id)
        if data:
            with open(f"online_data_{sub_id}.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Saved data for {sub_id}")

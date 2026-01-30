import json
import base64
import zlib
import re

def extract_protobuf_strings(data):
    results = []
    i = 0
    while i < len(data):
        if data[i] == 0x0a:
            i += 1
            if i >= len(data): break
            length = 0
            shift = 0
            while True:
                if i >= len(data): break
                byte = data[i]
                length |= (byte & 0x7f) << shift
                i += 1
                if not (byte & 0x80): break
                shift += 7
            
            if i + length <= len(data):
                content = data[i:i+length]
                try:
                    text = content.decode('utf-8')
                    if len(text) > 0:
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
    with open("all_sheet_intercepts.json", "r", encoding="utf-8") as f:
        intercepts = json.load(f)
    
    parsed_results = {}
    
    for entry in intercepts:
        url = entry['url']
        # 提取 subId
        sub_id_match = re.search(r'subId=([^&]+)', url)
        sub_id = sub_id_match.group(1) if sub_id_match else "unknown"
        
        if sub_id not in parsed_results:
            parsed_results[sub_id] = []
            
        try:
            body = json.loads(entry['content'])
            if 'data' in body and 'initialAttributedText' in body['data']:
                texts = body['data']['initialAttributedText'].get('text', [])
                for item in texts:
                    if 'related_sheet' in item:
                        raw_b64 = item['related_sheet']
                        decoded = base64.b64decode(raw_b64)
                        decompressed = zlib.decompress(decoded)
                        strings = extract_protobuf_strings(decompressed)
                        parsed_results[sub_id].extend(strings)
        except Exception as e:
            print(f"Error parsing {url}: {e}")
            
    with open("parsed_sheet_strings.json", "w", encoding="utf-8") as f:
        json.dump(parsed_results, f, ensure_ascii=False, indent=2)
    
    print("Parsed data saved to parsed_sheet_strings.json")
    for sub_id, strings in parsed_results.items():
        print(f"Tab {sub_id}: found {len(strings)} strings. Sample: {strings[:10]}")

if __name__ == "__main__":
    main()

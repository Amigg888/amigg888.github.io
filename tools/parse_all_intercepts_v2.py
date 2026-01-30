import json
import base64
import zlib
import re

def extract_protobuf_strings(data):
    results = []
    i = 0
    while i < len(data):
        if data[i] == 0x0a: # String tag
            i += 1
            if i >= len(data): break
            # Read varint length
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
        sub_id_match = re.search(r'subId=([^&]+)', url)
        sub_id = sub_id_match.group(1) if sub_id_match else "unknown"
        
        if sub_id not in parsed_results:
            parsed_results[sub_id] = []
            
        print(f"Processing URL: {url[:100]}...")
        try:
            body = json.loads(entry['content'])
            if 'data' in body and 'initialAttributedText' in body['data']:
                print(f"  Found initialAttributedText in {sub_id}")
                texts = body['data']['initialAttributedText'].get('text', [])
                for item in texts:
                    if 'related_sheet' in item:
                        raw_b64 = item['related_sheet']
                        print(f"    Found related_sheet (length: {len(raw_b64)})")
                        try:
                            decoded = base64.b64decode(raw_b64)
                            # Try decompressing - Tencent Docs usually uses zlib
                            try:
                                decompressed = zlib.decompress(decoded)
                                print(f"      Decompressed size: {len(decompressed)}")
                                strings = extract_protobuf_strings(decompressed)
                                print(f"      Extracted {len(strings)} strings")
                                parsed_results[sub_id].extend(strings)
                            except Exception as ze:
                                print(f"      Zlib error: {ze}")
                                # Try raw if zlib fails
                                strings = extract_protobuf_strings(decoded)
                                parsed_results[sub_id].extend(strings)
                        except Exception as be:
                            print(f"      Base64 error: {be}")
            else:
                print(f"  NO initialAttributedText in {sub_id}")
                # Check if it's nested differently
                if 'data' in body and 'data' in body['data'] and 'initialAttributedText' in body['data']['data']:
                    print(f"  Found NESTED initialAttributedText in {sub_id}")
                    # ... same logic ...
        except Exception as e:
            print(f"Error parsing {url}: {e}")
            
    with open("parsed_sheet_strings.json", "w", encoding="utf-8") as f:
        json.dump(parsed_results, f, ensure_ascii=False, indent=2)
    
    print("\nSummary:")
    for sub_id, strings in parsed_results.items():
        print(f"Tab {sub_id}: found {len(strings)} strings.")

if __name__ == "__main__":
    main()

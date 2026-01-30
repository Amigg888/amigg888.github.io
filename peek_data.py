import json
import base64
import zlib

def main():
    with open("all_sheet_intercepts.json", "r", encoding="utf-8") as f:
        intercepts = json.load(f)
    
    for entry in intercepts:
        body = json.loads(entry['content'])
        if 'data' in body and 'initialAttributedText' in body['data']:
            texts = body['data']['initialAttributedText'].get('text', [])
            for item in texts:
                if 'related_sheet' in item:
                    raw_b64 = item['related_sheet']
                    decoded = base64.b64decode(raw_b64)
                    decompressed = zlib.decompress(decoded)
                    print(f"Decompressed hex (first 100 bytes): {decompressed[:100].hex(' ')}")
                    # Try to see if there's any ASCII text
                    import string
                    printable = "".join(chr(b) if chr(b) in string.printable else "." for b in decompressed[:200])
                    print(f"Printable part: {printable}")
                    return # Just check the first one

if __name__ == "__main__":
    main()

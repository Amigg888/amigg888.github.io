import csv
import json
import os
import subprocess
import re

# 配置
EXCEL_FILE = '/Users/mima0000/Library/Containers/com.kingsoft.wpsoffice.mac/Data/Library/Application Support/Kingsoft/WPS Cloud Files/userdata/qing/filecache/.285491809/cachedata/E6D6E9AEEA524746BF1C5B41E6D28E4D/「2026」声度体验学员及报课名单.xlsx'
XLSX2CSV_PATH = '/Users/mima0000/Library/Python/3.9/bin/xlsx2csv'
OUTPUT_JS_ENROLLMENT = 'data-2026.js'
OUTPUT_JS_EXPERIENCE = 'data-experience-2026.js'

def run_xlsx2csv(sheet_id):
    cmd = [XLSX2CSV_PATH, EXCEL_FILE, '-s', str(sheet_id)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error reading sheet {sheet_id}: {result.stderr}")
        return None
    return result.stdout

def clean_date(date_str):
    if not date_str: return ""
    # 处理 "2026""年""01""月""16""日""" 这种奇怪格式
    if not date_str: return ""
    clean = date_str.replace('""', '')
    # 提取数字
    parts = re.findall(r'\d+', clean)
    if len(parts) >= 3:
        return f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
    return clean

def process_experience():
    print("Processing Experience Data (Sheet 1)...")
    content = run_xlsx2csv(1)
    if not content: return
    
    reader = csv.DictReader(content.splitlines())
    data = []
    for row in reader:
        name = row.get('学员姓名', '').strip()
        if not name or name == '学员姓名': continue
        
        # 转换字段名以匹配 2025 的格式
        item = {
            "学员姓名": name,
            "年级": row.get('年级', ''),
            "性别": row.get('性别', ''),
            "学员来源": row.get('学员来源', ''),
            "邀约老师": row.get('邀约老师', ''),
            "体验课老师": row.get('体验课老师', ''),
            "所在校区": row.get('所在校区', ''),
            "体验课时间": row.get('体验课时间', '').split(' ')[0].replace('/', '-'),
            "状态": row.get('状态', '')
        }
        data.append(item)
    
    js_content = f"window.experienceDetails2026 = {json.dumps(data, ensure_ascii=False, indent=4)};"
    with open(OUTPUT_JS_EXPERIENCE, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"Saved {len(data)} items to {OUTPUT_JS_EXPERIENCE}")

def process_enrollment():
    print("Processing Enrollment Data (Sheet 2)...")
    content = run_xlsx2csv(2)
    if not content: return
    
    reader = csv.DictReader(content.splitlines())
    data = []
    for row in reader:
        name = row.get('学员姓名', '').strip()
        if not name or name == '学员姓名': continue
        
        # 转换字段名以匹配 2025 的格式
        item = {
            "学员姓名": name,
            "报课时间": clean_date(row.get('报课时间', '')),
            "报课属性": row.get('报课属性', ''),
            "报课课时": row.get('报课课时', ''),
            "实收金额": row.get('实收金额', ''),
            "归属业绩金额": row.get('实收金额', ''), # 默认归属金额等于实收
            "所在校区": row.get('所在校区', ''),
            "业绩归属人": row.get('业绩归属', '')
        }
        data.append(item)
    
    js_content = f"window.enrollmentDetails2026 = {json.dumps(data, ensure_ascii=False, indent=4)};"
    with open(OUTPUT_JS_ENROLLMENT, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"Saved {len(data)} items to {OUTPUT_JS_ENROLLMENT}")

if __name__ == "__main__":
    process_experience()
    process_enrollment()
    print("\nUpdate Complete! Now updating home-dashboard.js to include 2026 data...")

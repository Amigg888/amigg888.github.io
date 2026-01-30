
import json
import re

file_path = '/Users/mima0000/Library/Mobile Documents/com~apple~CloudDocs/仪表盘/data-2025.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the window variable assignment
json_str = re.sub(r'^window\.enrollmentDetails2025\s*=\s*', '', content).strip()
if json_str.endswith(';'):
    json_str = json_str[:-1]

data = json.loads(json_str)

result = {}

for item in data:
    month = item.get('报课时间', '')[:7]
    teacher = item.get('业绩归属人', '')
    campus = item.get('所在校区', '')
    amount = float(item.get('归属业绩金额', 0))
    attr = item.get('报课属性', '')
    type_key = 'renewal' if attr == '续费' else 'new'

    if month not in result:
        result[month] = {}
    if teacher not in result[month]:
        result[month][teacher] = {'new': 0, 'renewal': 0, 'campuses': {}}
    
    result[month][teacher][type_key] += amount
    
    if campus not in result[month][teacher]['campuses']:
        result[month][teacher]['campuses'][campus] = {'new': 0, 'renewal': 0}
    result[month][teacher]['campuses'][campus][type_key] += amount

# Output only the totals for comparison
print(json.dumps(result, indent=2, ensure_ascii=False))

#!/usr/bin/env python3
"""
清理2026年3月的工作数据缓存
"""

import os
import json

# 清理工作数据文件
work_data_dir = '/Users/mima0000/Library/Mobile Documents/com~apple~CloudDocs/dashboard/work_data'
files_to_remove = [
    'data_2026-03.json',
    'history_2026-03.json'
]

for filename in files_to_remove:
    filepath = os.path.join(work_data_dir, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        print(f"已删除: {filepath}")
    else:
        print(f"文件不存在: {filepath}")

# 清理审计日志中2026-03的记录
audit_log_path = '/Users/mima0000/Library/Mobile Documents/com~apple~CloudDocs/dashboard/audit_logs.json'
if os.path.exists(audit_log_path):
    with open(audit_log_path, 'r', encoding='utf-8') as f:
        logs = json.load(f)
    
    # 过滤掉2026-03的保存记录
    filtered_logs = [log for log in logs if '2026-03' not in log.get('details', '')]
    
    with open(audit_log_path, 'w', encoding='utf-8') as f:
        json.dump(filtered_logs, f, ensure_ascii=False, indent=4)
    
    print(f"已清理审计日志中2026-03的记录")
    print(f"原记录数: {len(logs)}, 现记录数: {len(filtered_logs)}")

print("\n清理完成！请刷新浏览器页面，并清除浏览器缓存（localStorage）")
print("浏览器控制台执行: localStorage.removeItem('work_data_2026-03')")

import requests
import time
import json
import os

def export_tencent_sheet(local_id):
    # 腾讯文档导出 API
    export_url = "https://docs.qq.com/cgi-bin/online_edit/export_offline_config"
    progress_url = "https://docs.qq.com/cgi-bin/online_edit/export_offline_progress"
    
    headers = {
        "Referer": f"https://docs.qq.com/sheet/{local_id}",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    
    # 1. 创建导出任务
    # 注意：公开文档可能不需要 Cookie，但需要正确的 Referer
    payload = {
        "localId": local_id,
        "type": "excel",
        "exportType": "excel"
    }
    
    print(f"Creating export task for {local_id}...")
    try:
        response = requests.post(export_url, data=payload, headers=headers)
        res_json = response.json()
        print(f"Export task response: {res_json}")
        
        if res_json.get("ret") != 0:
            print(f"Error creating task: {res_json.get('msg')}")
            return None
            
        # 2. 轮询进度
        for _ in range(20): # 最多等待 20 秒
            time.sleep(2)
            prog_res = requests.get(f"{progress_url}?localId={local_id}", headers=headers)
            prog_json = prog_res.json()
            print(f"Progress: {prog_json}")
            
            if prog_json.get("ret") == 0 and prog_json.get("url"):
                download_url = prog_json.get("url")
                print(f"Download URL found: {download_url}")
                
                # 3. 下载文件
                file_res = requests.get(download_url)
                file_path = "temp_online_export.xlsx"
                with open(file_path, "wb") as f:
                    f.write(file_res.content)
                print(f"File downloaded to {file_path}")
                return file_path
    except Exception as e:
        print(f"Exception during export: {e}")
    
    return None

if __name__ == "__main__":
    # 从 URL 中提取的 localPadId (来自之前的 clientVars 抓取)
    local_id = "edgSoNtdvlKC" 
    export_tencent_sheet(local_id)

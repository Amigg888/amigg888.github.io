from flask import Flask, jsonify
from flask_cors import CORS
import subprocess
import os

app = Flask(__name__)
CORS(app)  # 允许跨域请求

@app.route('/sync', methods=['POST'])
def sync_data():
    try:
        # 执行同步脚本
        # 使用绝对路径确保能找到脚本
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sync_online_docs.py')
        result = subprocess.run(['python3', script_path], capture_output=True, text=True)
        
        if result.returncode == 0:
            return jsonify({
                "status": "success",
                "message": "数据同步成功！",
                "output": result.stdout
            })
        else:
            return jsonify({
                "status": "error",
                "message": "同步脚本执行失败",
                "error": result.stderr
            }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    # 在 5001 端口运行，避免与常用端口冲突
    app.run(port=5001)

from flask import Flask, jsonify, request, session, send_from_directory
from flask_cors import CORS
from flask_session import Session
import subprocess
import os
import json
import bcrypt
import time
from datetime import datetime, timedelta

app = Flask(__name__, static_url_path='', static_folder='.')
app.config['SECRET_KEY'] = 'sendo_secret_key_2026'
# Session 配置
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'flask_session')
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_KEY_PREFIX'] = 'session:'
app.config['SESSION_COOKIE_NAME'] = 'sendo_session'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True

# 确保 session 目录存在
if not os.path.exists(app.config['SESSION_FILE_DIR']):
    os.makedirs(app.config['SESSION_FILE_DIR'])
    print(f"Created session directory: {app.config['SESSION_FILE_DIR']}")
else:
    print(f"Using existing session directory: {app.config['SESSION_FILE_DIR']}")

Session(app)

# 允许跨域并支持 Cookie，动态匹配 Origin
CORS(app, supports_credentials=True, resources={
    r"/*": {
        "origins": [
            "http://localhost:5500", 
            "http://127.0.0.1:5500", 
            "http://localhost:5501",
            "http://127.0.0.1:5501",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://192.168.110.17:5500",
            "http://192.168.110.17:5501",
            "null",
            "*"
        ],
        "allow_headers": ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
        "methods": ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
        "expose_headers": ["Content-Type", "Authorization", "Access-Control-Allow-Origin", "Access-Control-Allow-Credentials"]
    }
})

# 动态添加并强制覆盖 CORS 响应头
@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Origin, Accept, X-Requested-With'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, DELETE'
    elif request.method == 'OPTIONS':
        # 处理没有 Origin 头的 OPTIONS 请求 (罕见但可能)
        response.headers['Access-Control-Allow-Origin'] = '*'
    return response

@app.before_request
def debug_request():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {request.method} {request.path}")
    print(f"  - Headers: {dict(request.headers)}")
    if 'username' in session:
        print(f"  - Session user: {session['username']}")
    else:
        print("  - No session found in current request")

# 内存中存储登录尝试次数
login_attempts = {}
MAX_ATTEMPTS = 5
LOCKOUT_TIME = 300  # 5分钟

def load_users():
    if os.path.exists('users.json'):
        with open('users.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def log_action(username, action, details=""):
    log_entry = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "username": username,
        "action": action,
        "details": details,
        "ip": request.remote_addr
    }
    logs = []
    if os.path.exists('audit_logs.json'):
        try:
            with open('audit_logs.json', 'r', encoding='utf-8') as f:
                logs = json.load(f)
        except:
            logs = []
    
    logs.append(log_entry)
    # 只保留最近 1000 条日志
    if len(logs) > 1000:
        logs = logs[-1000:]
        
    with open('audit_logs.json', 'w', encoding='utf-8') as f:
        json.dump(logs, f, ensure_ascii=False, indent=4)

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    # 检查锁定状态
    now = time.time()
    if username in login_attempts:
        attempts, last_time = login_attempts[username]
        if attempts >= MAX_ATTEMPTS and now - last_time < LOCKOUT_TIME:
            return jsonify({
                "status": "error",
                "message": f"账号已锁定，请在 {int(LOCKOUT_TIME - (now - last_time))} 秒后重试"
            }), 403

    users = load_users()
    if username in users:
        user_info = users[username]
        if bcrypt.checkpw(password.encode('utf-8'), user_info['password'].encode('utf-8')):
            # 登录成功
            session['username'] = username
            session['role'] = user_info['role']
            session['name'] = user_info['name']
            session.permanent = True
            
            print(f"  - Login success for {username}, session set: {dict(session)}")
            if username in login_attempts:
                del login_attempts[username]
                
            log_action(username, "LOGIN", "登录成功")
            return jsonify({
                "status": "success",
                "user": {
                    "username": username,
                    "role": user_info['role'],
                    "name": user_info['name']
                }
            })
    
    # 登录失败
    attempts, _ = login_attempts.get(username, (0, 0))
    login_attempts[username] = (attempts + 1, now)
    
    log_action(username or "unknown", "LOGIN_FAILED", "登录失败")
    return jsonify({
        "status": "error",
        "message": "用户名或密码错误"
    }), 401

@app.route('/logout', methods=['POST'])
def logout():
    username = session.get('username')
    if username:
        log_action(username, "LOGOUT", "登出成功")
    session.clear()
    return jsonify({"status": "success", "message": "已退出登录"})

@app.route('/check-session', methods=['GET'])
def check_session():
    print(f"Checking session: {dict(session)}")
    if 'username' in session:
        return jsonify({
            "authenticated": True,
            "user": {
                "username": session['username'],
                "role": session.get('role', 'teacher'),
                "name": session.get('name', 'User')
            }
        })
    return jsonify({"authenticated": False}), 401

@app.route('/log-action', methods=['POST'])
def record_log():
    if 'username' not in session:
        return jsonify({"status": "error", "message": "未登录"}), 401
    
    data = request.json
    log_action(session['username'], data.get('action'), data.get('details', ''))
    return jsonify({"status": "success"})

@app.route('/sync', methods=['POST'])
def sync_data():
    # 移除登录权限校验，允许直接同步
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

@app.route('/work-data', methods=['GET'])
def get_work_data():
    month = request.args.get('month')
    if not month:
        return jsonify({"status": "error", "message": "Month is required"}), 400
    
    file_path = f'work_data/data_{month}.json'
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    return jsonify({})

@app.route('/work-data', methods=['POST'])
def save_work_data():
    if 'username' not in session:
        return jsonify({"status": "error", "message": "未登录"}), 401
    
    data = request.json
    month = data.get('month')
    table_data = data.get('data')
    
    if not month or not table_data:
        return jsonify({"status": "error", "message": "Invalid data"}), 400
    
    if not os.path.exists('work_data'):
        os.makedirs('work_data')
    
    file_path = f'work_data/data_{month}.json'
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(table_data, f, ensure_ascii=False, indent=4)
    
    log_action(session['username'], "SAVE_WORK_DATA", f"保存了 {month} 的工作数据")
    return jsonify({"status": "success"})

@app.route('/work-history', methods=['GET'])
def get_work_history():
    month = request.args.get('month')
    if not month:
        return jsonify({"status": "error", "message": "Month is required"}), 400
    
    file_path = f'work_data/history_{month}.json'
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    return jsonify([])

@app.route('/work-history', methods=['POST'])
def save_work_history():
    if 'username' not in session:
        return jsonify({"status": "error", "message": "未登录"}), 401
    
    data = request.json
    month = data.get('month')
    history = data.get('history')
    
    if not month or history is None:
        return jsonify({"status": "error", "message": "Invalid data"}), 400
    
    if not os.path.exists('work_data'):
        os.makedirs('work_data')
    
    file_path = f'work_data/history_{month}.json'
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=4)
    
    return jsonify({"status": "success"})

if __name__ == '__main__':
    # 在 3001 端口运行，监听所有接口以提高兼容性
    app.run(host='0.0.0.0', port=3001)

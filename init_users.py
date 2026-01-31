import bcrypt
import json
import os

def init_users():
    users = {
        "sendo": {
            "password": bcrypt.hashpw("666888".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "role": "admin",
            "name": "总管理员"
        },
        "xiaohua": {
            "password": bcrypt.hashpw("666888".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "role": "teacher",
            "name": "小花老师"
        },
        "taozi": {
            "password": bcrypt.hashpw("666888".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "role": "teacher",
            "name": "桃子老师"
        },
        "youzi": {
            "password": bcrypt.hashpw("666888".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "role": "teacher",
            "name": "柚子老师"
        },
        "xiaocao": {
            "password": bcrypt.hashpw("666888".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "role": "teacher",
            "name": "小草老师"
        }
    }
    
    with open('users.json', 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=4)
    print("Users initialized successfully in users.json")

if __name__ == "__main__":
    init_users()

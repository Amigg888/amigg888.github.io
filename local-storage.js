// 统一的本地文件存储管理器
// 替代 localStorage，将数据保存到本地 JSON 文件

const LocalStorage = {
    // 基础路径
    basePath: 'local_data',
    
    // 初始化 - 创建必要的文件夹
    async init() {
        // 文件夹会在服务器启动时自动创建
        console.log('本地文件存储管理器已初始化');
    },
    
    // 获取完整的文件路径
    getFilePath(key) {
        // 根据 key 的类型决定存储位置
        if (key.startsWith('work_data_')) {
            const month = key.replace('work_data_', '');
            return `work_data/data_${month}.json`;
        }
        if (key.startsWith('salary_manual_')) {
            const month = key.replace('salary_manual_', '');
            return `salary_data/${month}.json`;
        }
        if (key.startsWith('history_')) {
            return `local_data/history/${key}.json`;
        }
        if (key.startsWith('eval_')) {
            return `local_data/evaluations/${key}.json`;
        }
        if (key.startsWith('advance_records_')) {
            const month = key.replace('advance_records_', '');
            return `local_data/finance/advance_${month}.json`;
        }
        if (key.startsWith('reimbursement_records_')) {
            const month = key.replace('reimbursement_records_', '');
            return `local_data/finance/reimbursement_${month}.json`;
        }
        if (key === 'user') {
            return 'local_data/user.json';
        }
        if (key === 'selected_month') {
            return 'local_data/selected_month.txt';
        }
        // 默认路径
        return `local_data/${key}.json`;
    },
    
    // 获取数据 - 优先从本地文件，回退到 localStorage
    async getItem(key) {
        const filePath = this.getFilePath(key);
        
        try {
            // 尝试从本地文件加载
            const response = await fetch(filePath + `?t=${Date.now()}`, { 
                cache: 'no-cache',
                method: 'GET'
            });
            
            if (response.ok) {
                const text = await response.text();
                console.log(`从本地文件加载: ${filePath}`);
                return text;
            }
        } catch (e) {
            console.warn(`从本地文件加载失败 ${filePath}:`, e);
        }
        
        // 回退到 localStorage
        const value = localStorage.getItem(key);
        if (value) {
            console.log(`从 localStorage 回退加载: ${key}`);
        }
        return value;
    },
    
    // 保存数据 - 保存到本地文件，同时兼容 localStorage
    async setItem(key, value) {
        const filePath = this.getFilePath(key);
        
        // 同时保存到 localStorage（兼容旧版本）
        localStorage.setItem(key, value);
        
        try {
            // 尝试保存到本地文件
            const response = await fetch(filePath, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: value
            });
            
            if (response.ok) {
                console.log(`已保存到本地文件: ${filePath}`);
                return true;
            } else {
                console.warn(`保存到本地文件失败 ${filePath}:`, response.status);
            }
        } catch (e) {
            console.warn(`保存到本地文件出错 ${filePath}:`, e);
        }
        
        return false;
    },
    
    // 删除数据
    async removeItem(key) {
        localStorage.removeItem(key);
        
        const filePath = this.getFilePath(key);
        try {
            const response = await fetch(filePath, { method: 'DELETE' });
            return response.ok;
        } catch (e) {
            console.warn(`删除本地文件失败 ${filePath}:`, e);
            return false;
        }
    },
    
    // 批量保存（用于保存整个对象）
    async setObject(key, obj) {
        return await this.setItem(key, JSON.stringify(obj));
    },
    
    // 批量获取（自动解析 JSON）
    async getObject(key, defaultValue = null) {
        const value = await this.getItem(key);
        if (!value) return defaultValue;
        try {
            return JSON.parse(value);
        } catch (e) {
            return value; // 如果不是 JSON，返回原始值
        }
    }
};

// 导出
window.LocalStorage = LocalStorage;

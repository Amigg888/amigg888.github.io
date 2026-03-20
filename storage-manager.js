// 统一存储管理器 - 支持 file:// 和 http:// 双模式
const StorageManager = {
    // 检测当前运行模式
    getMode() {
        if (window.location.protocol === 'file:') {
            return 'file';  // 双击打开
        } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'localhost';  // 本地服务器
        }
        return 'web';  // 线上环境
    },

    // 保存数据
    async save(key, data) {
        const mode = this.getMode();
        const json = JSON.stringify(data, null, 4);
        
        // 始终保存到 localStorage
        localStorage.setItem(key, json);
        
        if (mode === 'localhost') {
            // localhost 模式：通过服务器保存到文件
            try {
                const endpoint = this.getEndpoint(key);
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ month: this.extractMonth(key), data })
                });
                if (response.ok) {
                    console.log(`[${mode}] 数据已保存到服务器: ${key}`);
                    return true;
                }
            } catch (e) {
                console.warn(`[${mode}] 服务器保存失败:`, e);
            }
        } else if (mode === 'file') {
            // file 模式：提示用户保存文件
            try {
                const filename = this.getFilename(key);
                await this.downloadFile(filename, json);
                console.log(`[${mode}] 已触发下载: ${filename}`);
                return true;
            } catch (e) {
                console.warn(`[${mode}] 下载失败:`, e);
            }
        }
        
        return false;
    },

    // 加载数据
    async load(key, defaultValue = null) {
        const mode = this.getMode();
        
        // localhost 模式：优先从服务器加载
        if (mode === 'localhost') {
            try {
                const endpoint = this.getEndpoint(key, true);
                const response = await fetch(endpoint, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    if (data && Object.keys(data).length > 0) {
                        console.log(`[${mode}] 从服务器加载: ${key}`);
                        // 同步到 localStorage
                        localStorage.setItem(key, JSON.stringify(data));
                        return data;
                    }
                }
            } catch (e) {
                console.warn(`[${mode}] 服务器加载失败:`, e);
            }
        }
        
        // file 模式 或 服务器无数据：从 localStorage 加载
        const localData = localStorage.getItem(key);
        if (localData) {
            console.log(`[${mode}] 从 localStorage 加载: ${key}`);
            return JSON.parse(localData);
        }
        
        return defaultValue;
    },

    // 获取 API 端点
    getEndpoint(key, isGet = false) {
        if (key.startsWith('work_data_')) {
            return isGet ? `/work-data?month=${this.extractMonth(key)}` : '/work-data';
        }
        if (key.startsWith('salary_manual_')) {
            return isGet ? `/salary-data?month=${this.extractMonth(key)}` : '/salary-data';
        }
        if (key.startsWith('advance_records_')) {
            return isGet ? `/advance-records?month=${this.extractMonth(key)}` : '/advance-records';
        }
        if (key.startsWith('reimbursement_records_')) {
            return isGet ? `/reimbursement-records?month=${this.extractMonth(key)}` : '/reimbursement-records';
        }
        return null;
    },

    // 提取月份
    extractMonth(key) {
        // 支持 work_data_2026-01, salary_manual_2026-01 等格式
        const match = key.match(/\d{4}-\d{2}$/);
        return match ? match[0] : key;
    },

    // 获取文件名
    getFilename(key) {
        const month = this.extractMonth(key);
        if (key.startsWith('work_data_')) return `work_data/data_${month}.json`;
        if (key.startsWith('salary_manual_')) return `salary_data/${month}.json`;
        if (key.startsWith('advance_records_')) return `finance_data/advance_${month}.json`;
        if (key.startsWith('reimbursement_records_')) return `finance_data/reimbursement_${month}.json`;
        return `${key}.json`;
    },

    // 下载文件
    downloadFile(filename, content) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            resolve();
        });
    },

    // 上传文件
    async uploadFile() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    reject(new Error('未选择文件'));
                    return;
                }
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    resolve(data);
                } catch (err) {
                    reject(err);
                }
            };
            input.click();
        });
    }
};

// 导出
window.StorageManager = StorageManager;

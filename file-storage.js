// 本地文件存储管理器 - 支持直接双击打开 HTML 文件
// 使用 File System Access API 或降级到下载/上传

const FileStorage = {
    // 检查是否支持 File System Access API
    isFileSystemAccessSupported() {
        return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
    },

    // 保存数据到本地文件
    async saveData(filename, data) {
        const json = JSON.stringify(data, null, 4);
        
        // 尝试使用 File System Access API
        if (this.isFileSystemAccessSupported()) {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                const writable = await fileHandle.createWritable();
                await writable.write(json);
                await writable.close();
                console.log(`数据已保存到: ${filename}`);
                return true;
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.warn('File System Access API 失败:', e);
                }
            }
        }
        
        // 降级方案：触发下载
        try {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log(`已触发下载: ${filename}`);
            return true;
        } catch (e) {
            console.error('保存失败:', e);
            return false;
        }
    },

    // 从本地文件加载数据
    async loadData() {
        // 尝试使用 File System Access API
        if (this.isFileSystemAccessSupported()) {
            try {
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                const file = await fileHandle.getFile();
                const text = await file.text();
                return JSON.parse(text);
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.warn('File System Access API 失败:', e);
                }
            }
        }
        
        // 降级方案：使用 input file
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
                    resolve(JSON.parse(text));
                } catch (err) {
                    reject(err);
                }
            };
            input.click();
        });
    },

    // 自动保存（尝试多种方式）
    async autoSave(filename, data) {
        // 1. 保存到 localStorage
        localStorage.setItem(filename, JSON.stringify(data));
        
        // 2. 尝试保存到文件
        const saved = await this.saveData(filename, data);
        
        return saved;
    },

    // 自动加载（尝试多种方式）
    async autoLoad(filename, defaultValue = null) {
        // 1. 尝试从 localStorage 加载
        const localData = localStorage.getItem(filename);
        if (localData) {
            try {
                return JSON.parse(localData);
            } catch (e) {
                console.warn('解析 localStorage 数据失败:', e);
            }
        }
        
        return defaultValue;
    }
};

// 导出
window.FileStorage = FileStorage;

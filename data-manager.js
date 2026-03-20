// 数据管理器 - 提供导出/导入功能，避免依赖浏览器缓存
const DataManager = {
    // 导出所有数据到 JSON 文件
    async exportAllData() {
        const data = {
            exportTime: new Date().toISOString(),
            version: '1.0',
            data: {}
        };
        
        // 收集所有 localStorage 数据
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            try {
                data.data[key] = JSON.parse(value);
            } catch (e) {
                data.data[key] = value;
            }
        }
        
        // 下载为文件
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard_backup_${dayjs().format('YYYYMMDD_HHmmss')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('数据已导出');
        return true;
    },
    
    // 从 JSON 文件导入数据
    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (data.data) {
                        // 导入到 localStorage
                        Object.entries(data.data).forEach(([key, value]) => {
                            localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
                        });
                        console.log('数据已导入');
                        resolve(true);
                    } else {
                        reject(new Error('无效的备份文件格式'));
                    }
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('读取文件失败'));
            reader.readAsText(file);
        });
    },
    
    // 导出指定月份的数据
    async exportMonthData(month) {
        const data = {
            month,
            exportTime: new Date().toISOString(),
            workData: null,
            salaryData: null,
            advanceRecords: null,
            reimbursementRecords: null
        };
        
        // 工作数据
        const workData = localStorage.getItem(`work_data_${month}`);
        if (workData) data.workData = JSON.parse(workData);
        
        // 工资数据
        const salaryData = localStorage.getItem(`salary_manual_${month}`);
        if (salaryData) data.salaryData = JSON.parse(salaryData);
        
        // 垫付记录
        const advanceRecords = localStorage.getItem(`advance_records_${month}`);
        if (advanceRecords) data.advanceRecords = JSON.parse(advanceRecords);
        
        // 报销记录
        const reimbursementRecords = localStorage.getItem(`reimbursement_records_${month}`);
        if (reimbursementRecords) data.reimbursementRecords = JSON.parse(reimbursementRecords);
        
        // 下载
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `month_data_${month}_${dayjs().format('YYYYMMDD')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`${month} 数据已导出`);
        return true;
    },
    
    // 导入月份数据
    async importMonthData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const month = data.month;
                    
                    if (!month) {
                        reject(new Error('无效的月份数据文件'));
                        return;
                    }
                    
                    // 导入各项数据
                    if (data.workData) {
                        localStorage.setItem(`work_data_${month}`, JSON.stringify(data.workData));
                    }
                    if (data.salaryData) {
                        localStorage.setItem(`salary_manual_${month}`, JSON.stringify(data.salaryData));
                    }
                    if (data.advanceRecords) {
                        localStorage.setItem(`advance_records_${month}`, JSON.stringify(data.advanceRecords));
                    }
                    if (data.reimbursementRecords) {
                        localStorage.setItem(`reimbursement_records_${month}`, JSON.stringify(data.reimbursementRecords));
                    }
                    
                    console.log(`${month} 数据已导入`);
                    resolve(month);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('读取文件失败'));
            reader.readAsText(file);
        });
    }
};

// 导出
window.DataManager = DataManager;

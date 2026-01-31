console.log('Salary Calculation script loading...');
const initApp = () => {
    console.log('Salary Calculation initApp starting...');
    if (typeof Vue === 'undefined') {
        console.error('Vue is not loaded!');
        return;
    }
    const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

    createApp({
        setup() {
            const isAuthorized = ref(true); // Now handled by auth-guard.js
            const inputPassword = ref('');
            const passwordError = ref(false);

            // User Info for RBAC
            const currentUser = ref(JSON.parse(localStorage.getItem('user')) || { role: 'admin' });
            const isMobileMenuOpen = ref(false);

            const checkPassword = () => {
                if (inputPassword.value === '888') {
                    isAuthorized.value = true;
                    sessionStorage.setItem('salary_authorized', 'true');
                    passwordError.value = false;
                    initData();
                    loadHistoryRecords();
                } else {
                    passwordError.value = true;
                    inputPassword.value = '';
                    setTimeout(() => { passwordError.value = false; }, 2000);
                }
            };

            const tableData = reactive({});
            const currentMonth = ref(localStorage.getItem('selected_month') || '2026-01');
            const showDatePicker = ref(false);
            const pickerTempYear = ref(currentMonth.value.split('-')[0]);

            const selectMonth = (year, month) => {
                currentMonth.value = `${year}-${String(month).padStart(2, '0')}`;
                showDatePicker.value = false;
            };

            const saveStatus = ref(''); // '', 'saving', 'saved', 'error'
            
            // 历史记录相关
            const showHistory = ref(false);
            const historyRecords = ref([]);
            const historyNote = ref('');
            const currentVersionId = ref(null);

            const baseSalaryMap = {
                'xh_la': 2000,
                'xh_ch': 2000,
                'tz': 3500,
                'yz': 3200,
                'xc': 3500
            };
            
            const socialSecurityMap = {
                '小花老师': 523.53,
                'xh_la': 261.77,
                'xh_ch': 261.77,
                'tz': 523.53,
                'yz': 523.53,
                'xc': 523.53
            };

            const columns = [
                { key: 'name', label: '姓名', width: '120px' },
                { key: 'baseSalary', label: '基本工资' },
                { key: 'inviteBonus', label: '邀约奖金' },
                { key: 'conversionBonus', label: '体验课转化奖励' },
                { key: 'classCommission', label: '课时工资' },
                { key: 'salesCommission', label: '业绩提成' },
                { key: 'performanceBonus', label: '绩效奖金' },
                { key: 'grossPay', label: '应发工资' },
                { key: 'socialSecurity', label: '社保代扣' },
                { key: 'adjustments', label: '其他调整', width: '100px' },
                { key: 'adjustmentRemark', label: '调整备注', width: '150px' },
                { key: 'netPay', label: '实发工资' }
            ];

            // 历史记录相关方法
            const loadHistoryRecords = () => {
                const saved = localStorage.getItem(`history_salary_${currentMonth.value}`);
                historyRecords.value = saved ? JSON.parse(saved) : [];
            };

            const saveHistoryRecord = (isReplace = false) => {
                if (!isReplace && !historyNote.value.trim()) {
                    saveStatus.value = 'error';
                    setTimeout(() => { saveStatus.value = ''; }, 2000);
                    return;
                }

                const timestamp = Date.now();
                const newRecord = {
                    id: isReplace && currentVersionId.value ? currentVersionId.value : timestamp,
                    timestamp: timestamp,
                    displayTime: dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss'),
                    note: isReplace ? (historyRecords.value.find(r => r.id === currentVersionId.value)?.note || '无备注') : historyNote.value,
                    data: JSON.parse(JSON.stringify(tableData))
                };

                if (isReplace && currentVersionId.value) {
                    const index = historyRecords.value.findIndex(r => r.id === currentVersionId.value);
                    if (index !== -1) {
                        historyRecords.value[index] = newRecord;
                    }
                } else {
                    historyRecords.value.unshift(newRecord);
                }

                localStorage.setItem(`history_salary_${currentMonth.value}`, JSON.stringify(historyRecords.value));
                
                if (!isReplace) {
                    historyNote.value = '';
                    currentVersionId.value = newRecord.id;
                }
                
                // 使用状态提示代替弹窗
                saveStatus.value = 'saved';
                setTimeout(() => { saveStatus.value = ''; }, 2000);
            };

            const loadVersion = (record) => {
                // 清空当前 tableData 并合并新数据
                Object.keys(tableData).forEach(key => delete tableData[key]);
                Object.assign(tableData, JSON.parse(JSON.stringify(record.data)));
                currentVersionId.value = record.id;
                showHistory.value = false;
                
                // 无感加载，仅通过状态提示
                saveStatus.value = 'saved';
                setTimeout(() => { saveStatus.value = ''; }, 2000);
            };

            const deleteVersion = (id) => {
                historyRecords.value = historyRecords.value.filter(r => r.id !== id);
                localStorage.setItem(`history_salary_${currentMonth.value}`, JSON.stringify(historyRecords.value));
                if (currentVersionId.value === id) {
                    currentVersionId.value = null;
                }
                // 无感提示
                saveStatus.value = 'saved';
                setTimeout(() => { saveStatus.value = ''; }, 2000);
            };

            const initData = () => {
                const savedWorkData = localStorage.getItem(`work_data_${currentMonth.value}`);
                let workData = null;

                if (savedWorkData) {
                    try {
                        workData = JSON.parse(savedWorkData);
                    } catch (e) {
                        console.error('解析工作数据失败:', e);
                    }
                } else if (window.presetWorkHistory && window.presetWorkHistory[currentMonth.value]) {
                    // 如果没有本地保存的数据，但有预设数据，使用最新的预设数据
                    const monthPresets = window.presetWorkHistory[currentMonth.value];
                    if (monthPresets.length > 0) {
                        // 按时间戳降序排序，取最新的
                        const latestPreset = [...monthPresets].sort((a, b) => b.timestamp - a.timestamp)[0];
                        workData = latestPreset.data;
                        console.log(`使用预设数据进行 ${currentMonth.value} 的工资计算`);
                    }
                }

                if (workData) {
                    const teachersList = ['xh_la', 'xh_ch', 'tz', 'yz', 'xc'];
                    const teacherDisplayNames = {
                        'xh_la': '小花老师(临安)',
                        'xh_ch': '小花老师(青山)',
                        'tz': '桃子老师',
                        'yz': '柚子老师',
                        'xc': '小草老师'
                    };

                    // Filter for teachers
                    let filteredTeachers = teachersList;
                    if (currentUser.value.role === 'teacher') {
                        // Match by teacher name prefix
                        filteredTeachers = teachersList.filter(t => 
                            teacherDisplayNames[t].includes(currentUser.value.name)
                        );
                    }

                    // Remove other teachers if they exist in tableData (cleanup)
                    Object.keys(tableData).forEach(key => {
                        if (key !== '小花老师' && !filteredTeachers.includes(key) && !['xh_la', 'xh_ch'].includes(key)) {
                             delete tableData[key];
                        }
                    });

                    // Initialize salary data based on work data
                    filteredTeachers.forEach(id => {
                        const work = workData[id] || { name: id, demoInvites: 0, demoEnrollments: 0, attendance: 0, totalSales: 0 };
                        const baseSalary = baseSalaryMap[id] || 0;
                        
                        // 1. 体验课奖金
                        const inviteBonus = Number(work.demoInvites || 0) * 20;
                        const conversionBonus = Number(work.demoEnrollments || 0) * 50;
                        
                        // 2. 课时提成
                        const attendance = Number(work.attendance || 0); // 出勤人次 (仅供参考或门槛判断)
                        const regularHours = Number(work.regularHours || 0); // 常规课消课时 (以此为准计算课时费)
                        
                        let classRate = 10;
                        if (regularHours > 200) classRate = 15;
                        else if (regularHours > 150) classRate = 12;
                        
                        const regularClassCommission = regularHours * classRate;
                        const oneOnOneAmount = Number(work.oneOnOneAmount || 0);
                        const oneOnOneCommission = oneOnOneAmount * 0.3; // 一对一金额 * 30%
                        
                        const classCommission = regularClassCommission + oneOnOneCommission;
                        
                        // 3. 销售提成
                        const totalSales = Number(work.totalSales || (Number(work.newSales || 0) + Number(work.renewalSales || 0)));
                        let salesRate = 0.03;
                        if (totalSales > 30000) salesRate = 0.07;
                        else if (totalSales > 10000) salesRate = 0.05;
                        const salesCommission = totalSales * salesRate;

                        // 4. 绩效奖金 (从绩效考核数据中读取)
                        const teacherMap = { 'tz': '桃子老师', 'yz': '柚子老师', 'xh_la': '小花老师', 'xh_ch': '小花老师', 'xc': '小草老师' };
                        const teacherName = teacherMap[id];
                        let performanceBonus = 0;
                        if (teacherName) {
                            const evalSaved = localStorage.getItem(`eval_${teacherName}_${currentMonth.value}`);
                            if (evalSaved) {
                                const evalData = JSON.parse(evalSaved);
                                const score = evalData.scores ? Object.values(evalData.scores).reduce((a, b) => a + b, 0) : 0;
                                let coefficient = 1.0;
                                if (score >= 120) coefficient = 2.0;
                                else if (score >= 100) coefficient = 1.7;
                                else if (score >= 80) coefficient = 1.4;
                                else if (score >= 60) coefficient = 1.0;
                                else if (score >= 40) coefficient = 0.8;
                                else coefficient = 0.6;
                                
                                performanceBonus = 500 * coefficient;
                            }
                        }
                        
                        const grossPay = baseSalary + inviteBonus + conversionBonus + classCommission + salesCommission + performanceBonus;
                        const socialSecurity = socialSecurityMap[id] || 0;
                        
                        // 获取现有的调整金额和备注（如果存在）
                        const existingAdjustments = tableData[id]?.adjustments || 0;
                        const existingRemark = tableData[id]?.adjustmentRemark || '';
                        const netPay = grossPay - socialSecurity + Number(existingAdjustments);

                        tableData[id] = {
                            id,
                            name: work.name,
                            baseSalary,
                            inviteBonus,
                            conversionBonus,
                            classCommission,
                            salesCommission,
                            performanceBonus,
                            grossPay,
                            socialSecurity,
                            adjustments: existingAdjustments,
                            adjustmentRemark: existingRemark,
                            netPay
                        };
                    });

                    // 4. 小花老师汇总
                    const xh_la = tableData['xh_la'];
                    const xh_ch = tableData['xh_ch'];
                    if (xh_la && xh_ch) {
                        const totalAdjustments = Number(xh_la.adjustments || 0) + Number(xh_ch.adjustments || 0);
                        const combinedRemarks = [xh_la.adjustmentRemark, xh_ch.adjustmentRemark].filter(r => r).join('; ');
                        tableData['小花老师'] = {
                            id: 'xh_total',
                            name: '小花老师',
                            isSummary: true,
                            baseSalary: xh_la.baseSalary + xh_ch.baseSalary,
                            inviteBonus: xh_la.inviteBonus + xh_ch.inviteBonus,
                            conversionBonus: xh_la.conversionBonus + xh_ch.conversionBonus,
                            classCommission: xh_la.classCommission + xh_ch.classCommission,
                            salesCommission: xh_la.salesCommission + xh_ch.salesCommission,
                            performanceBonus: xh_la.performanceBonus + xh_ch.performanceBonus,
                            grossPay: xh_la.grossPay + xh_ch.grossPay,
                            socialSecurity: socialSecurityMap['小花老师'],
                            adjustments: totalAdjustments,
                            adjustmentRemark: combinedRemarks,
                            netPay: (xh_la.grossPay + xh_ch.grossPay) - socialSecurityMap['小花老师'] + totalAdjustments
                        };
                    }
                } else {
                    // No data for current month, clear table
                    Object.keys(tableData).forEach(key => delete tableData[key]);
                }
            };

            // 监听月份变化并存储到本地，以便跨页面同步
            watch(currentMonth, (newVal) => {
                localStorage.setItem('selected_month', newVal);
                initData();
                loadHistoryRecords();
                currentVersionId.value = null;
            });

            const formatMoney = (val) => {
                return Number(val || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            };

            const handleAdjustmentChange = (id) => {
                const row = tableData[id];
                if (!row) return;
                
                // 重新计算实发工资
                row.netPay = row.grossPay - row.socialSecurity + Number(row.adjustments || 0);
                
                // 如果是校区老师，更新小花老师汇总
                if (id === 'xh_la' || id === 'xh_ch') {
                    const xh_la = tableData['xh_la'];
                    const xh_ch = tableData['xh_ch'];
                    if (xh_la && xh_ch) {
                        const xh_total = tableData['小花老师'];
                        if (xh_total) {
                            xh_total.adjustments = Number(xh_la.adjustments || 0) + Number(xh_ch.adjustments || 0);
                            xh_total.adjustmentRemark = [xh_la.adjustmentRemark, xh_ch.adjustmentRemark].filter(r => r).join('; ');
                            xh_total.netPay = (xh_la.grossPay + xh_ch.grossPay) - socialSecurityMap['小花老师'] + xh_total.adjustments;
                        }
                    }
                }
            };

            const exportToCSV = () => {
                if (typeof dayjs === 'undefined') {
                    console.error('Day.js 库未加载，无法导出。');
                    saveStatus.value = 'error';
                    setTimeout(() => { saveStatus.value = ''; }, 2000);
                    return;
                }
                let csv = '\uFEFF'; // BOM for Excel
                csv += columns.map(c => c.label).join(',') + '\n';
                
                const order = ['小花老师', 'xh_la', 'xh_ch', 'tz', 'yz', 'xc'];
                order.forEach(id => {
                    const row = tableData[id];
                    if (!row) return;
                    csv += columns.map(col => {
                        const val = row[col.key];
                        // 处理包含逗号的备注，防止 CSV 格式错误
                        if (col.key === 'adjustmentRemark' && val) {
                            return `"${String(val).replace(/"/g, '""')}"`;
                        }
                        return val;
                    }).join(',') + '\n';
                });
                
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `工资计算明细_${dayjs().format('YYYYMMDD')}.csv`;
                link.click();
            };

            onMounted(() => {
                // 确保初始化时 Modal 是关闭的
                showHistory.value = false;
                if (isAuthorized.value) {
                    initData();
                    loadHistoryRecords();
                }
            });

            return {
                isAuthorized,
                inputPassword,
                passwordError,
                checkPassword,
                columns,
                tableData,
                currentMonth,
                showDatePicker,
                pickerTempYear,
                selectMonth,
                saveStatus,
                formatMoney,
                exportToCSV,
                showHistory,
                historyRecords,
                historyNote,
                currentVersionId,
                saveHistoryRecord,
                loadVersion,
                deleteVersion,
                handleAdjustmentChange,
                isMobileMenuOpen
            };
        }
    }).mount('#app');
};

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

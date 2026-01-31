console.log('Data Entry script loading...');
const initApp = () => {
    console.log('Data Entry initApp starting...');
    if (typeof Vue === 'undefined') {
        console.error('Vue is not loaded!');
        return;
    }
    const { createApp, ref, reactive, computed, watch, onMounted } = Vue;

    createApp({
        setup() {
            const teachers = ['小花老师', '桃子老师', '柚子老师', '小草老师'];
            const expandedRows = reactive({ '小花老师': true });
            const currentMonth = ref(localStorage.getItem('selected_month') || '2026-01');
            const showDatePicker = ref(false);
            const pickerTempYear = ref(currentMonth.value.split('-')[0]);

            const selectMonth = (year, month) => {
                currentMonth.value = `${year}-${String(month).padStart(2, '0')}`;
                showDatePicker.value = false;
            };

            const saveStatus = ref(''); // '', 'saving', 'saved', 'error'
            
            // History Management
            const showHistory = ref(false);
            const historyRecords = ref([]);
            const historyNote = ref('');
            const currentVersionId = ref(null); // ID of the currently loaded version

            // Column definitions
            const columns = [
                { key: 'name', label: '姓名', type: 'text', readonly: true, width: '120px' },
                { key: 'demoInvites', label: '试听课邀约人数', type: 'number' },
                { key: 'demoAttendees', label: '试听课上课人数', type: 'number' },
                { key: 'demoEnrollments', label: '试听课报课人数', type: 'number' },
                { key: 'demoRate', label: '试听转化率', type: 'formula', formula: (row) => calculateRate(row.demoEnrollments, row.demoAttendees) },
                { key: 'regularHours', label: '常规课消课时', type: 'number' },
                { key: 'oneOnOneAttendees', label: '一对一人次', type: 'number' },
                { key: 'oneOnOneAmount', label: '一对一消课金额', type: 'number', decimals: 2 },
                { key: 'newStudents', label: '新签学员数', type: 'number', decimals: 1 },
                { key: 'newSales', label: '新签业绩', type: 'number', decimals: 2 },
                { key: 'renewalStudents', label: '续费学员数', type: 'number', decimals: 1 },
                { key: 'renewalSales', label: '续费业绩', type: 'number', decimals: 2 },
                { key: 'totalSales', label: '总业绩', type: 'formula', formula: (row) => (Number(row.newSales || 0) + Number(row.renewalSales || 0)).toFixed(2) },
                { key: 'attendance', label: '出勤人次', type: 'number' },
                { key: 'absence', label: '缺勤人次', type: 'number' },
                { key: 'leave', label: '请假人次', type: 'number' },
                { key: 'makeup', label: '补课人次', type: 'number' },
                { key: 'attendanceRate', label: '出勤率', type: 'formula', formula: (row) => calculateAttendanceRate(row.attendance, row.absence, row.leave) }
            ];

            // Teaching related columns for special handling of 小草老师
            const teachingColumns = ['demoAttendees', 'demoEnrollments', 'regularHours', 'oneOnOneAttendees', 'oneOnOneAmount', 'attendanceRate'];

            const calculateRate = (num, den) => {
                if (!den || den === 0) return '0.00%';
                return ((num / den) * 100).toFixed(2) + '%';
            };

            const calculateAttendanceRate = (att, abs, lea) => {
                const total = Number(att || 0) + Number(abs || 0) + Number(lea || 0);
                if (total === 0) return '0.00%';
                return ((Number(att || 0) / total) * 100).toFixed(2) + '%';
            };

            const initialData = {
                '小花老师': {
                    isSummary: true,
                    children: [
                        { id: 'xh_la', name: '临安校区', parent: '小花老师' },
                        { id: 'xh_ch', name: '昌化校区', parent: '小花老师' }
                    ]
                },
                '桃子老师': { id: 'tz', name: '桃子老师' },
                '柚子老师': { id: 'yz', name: '柚子老师' },
                '小草老师': { id: 'xc', name: '小草老师', isTeachingDisabled: true }
            };

            const tableData = reactive({});

            // Initialize tableData from localStorage or initialData
            const initData = () => {
                // Clear existing data first
                Object.keys(tableData).forEach(key => delete tableData[key]);
                
                // Initialize empty rows structure first
                Object.entries(initialData).forEach(([key, config]) => {
                    if (config.isSummary) {
                        tableData[key] = { name: key, isSummary: true, children: config.children.map(c => c.id) };
                        config.children.forEach(child => {
                            tableData[child.id] = createEmptyRow(child.name, child.id, child.parent);
                        });
                    } else {
                        tableData[config.id] = createEmptyRow(config.name, config.id, null, config.isTeachingDisabled);
                    }
                });

                // Then try to load saved data for the current month
                const saved = localStorage.getItem(`work_data_${currentMonth.value}`);
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        Object.keys(parsed).forEach(key => {
                            if (tableData[key]) {
                                Object.assign(tableData[key], parsed[key]);
                            }
                        });
                        // Re-calculate summaries after loading
                        updateSummaryRow('小花老师');
                    } catch (e) {
                        console.error('Failed to parse saved data:', e);
                    }
                } else if (presetHistory && presetHistory[currentMonth.value] && presetHistory[currentMonth.value].length > 0) {
                    // 如果本地无保存数据，则自动加载预设的系统/截图数据
                    const preset = presetHistory[currentMonth.value][0];
                    Object.keys(preset.data).forEach(key => {
                        if (tableData[key]) {
                            Object.assign(tableData[key], JSON.parse(JSON.stringify(preset.data[key])));
                        }
                    });
                    // 重新计算汇总行
                    updateSummaryRow('小花老师');
                    console.log(`自动加载了 ${currentMonth.value} 的预设数据`);
                }
            };

            const createEmptyRow = (name, id, parent = null, isTeachingDisabled = false) => {
                const row = { id, name, parent, isTeachingDisabled };
                columns.forEach(col => {
                    if (col.key !== 'name') {
                        row[col.key] = 0;
                    }
                });
                return row;
            };

            // Computed summary for 小花老师
            const updateSummaryRow = (parentName) => {
                const summaryRow = tableData[parentName];
                if (!summaryRow || !summaryRow.children) return;

                const childrenRows = summaryRow.children.map(id => tableData[id]);
                
                columns.forEach(col => {
                    if (col.type === 'number') {
                        summaryRow[col.key] = childrenRows.reduce((sum, child) => sum + Number(child[col.key] || 0), 0);
                    }
                });
            };

            // Total summary row for all teachers
            const grandTotal = computed(() => {
                const result = { name: '汇总' };
                const rowsToSum = Object.values(tableData).filter(row => !row.parent && row.name !== '汇总');
                
                columns.forEach(col => {
                    if (col.type === 'number') {
                        result[col.key] = rowsToSum.reduce((sum, row) => sum + Number(row[col.key] || 0), 0);
                    }
                });
                return result;
            });

            const handleInputChange = (rowId, colKey) => {
                const row = tableData[rowId];
                if (row[colKey] === '' || isNaN(row[colKey])) {
                    row[colKey] = 0;
                }
                if (row.parent) {
                    updateSummaryRow(row.parent);
                }
                saveToLocal();
            };

            const saveToLocal = () => {
                saveStatus.value = 'saving';
                try {
                    localStorage.setItem(`work_data_${currentMonth.value}`, JSON.stringify(tableData));
                    setTimeout(() => {
                        saveStatus.value = 'saved';
                        setTimeout(() => { saveStatus.value = ''; }, 2000);
                    }, 500);
                } catch (e) {
                    saveStatus.value = 'error';
                    console.error('Save failed:', e);
                }
            };

            // 预设的历史记录数据（2025年 1-12月）
            const presetHistory = window.presetWorkHistory || {};

            // History Methods
            const loadHistoryRecords = () => {
                const saved = localStorage.getItem(`history_work_data_${currentMonth.value}`);
                let records = saved ? JSON.parse(saved) : [];
                
                // 合并预设记录
                if (presetHistory[currentMonth.value]) {
                    const preset = presetHistory[currentMonth.value];
                    // 避免重复添加预设记录
                    preset.forEach(p => {
                        if (!records.some(r => r.id === p.id)) {
                            records.push(p);
                        }
                    });
                    // 按时间倒序排列
                    records.sort((a, b) => b.timestamp - a.timestamp);
                }
                
                historyRecords.value = records;
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

                localStorage.setItem(`history_work_data_${currentMonth.value}`, JSON.stringify(historyRecords.value));
                historyNote.value = '';
                if (!isReplace) currentVersionId.value = newRecord.id;
                
                // 使用状态提示代替弹窗
                saveStatus.value = 'saved';
                setTimeout(() => { saveStatus.value = ''; }, 2000);
            };

            const loadVersion = (record) => {
                Object.keys(tableData).forEach(key => delete tableData[key]);
                Object.assign(tableData, JSON.parse(JSON.stringify(record.data)));
                currentVersionId.value = record.id;
                updateSummaryRow('小花老师');
                showHistory.value = false;
                
                // 无感加载，仅通过状态提示
                saveStatus.value = 'saved';
                setTimeout(() => { saveStatus.value = ''; }, 2000);
            };

            const deleteVersion = (id) => {
                historyRecords.value = historyRecords.value.filter(r => r.id !== id);
                localStorage.setItem(`history_work_data_${currentMonth.value}`, JSON.stringify(historyRecords.value));
                if (currentVersionId.value === id) currentVersionId.value = null;
                // 无感提示
                saveStatus.value = 'saved';
                setTimeout(() => { saveStatus.value = ''; }, 2000);
            };

            // 监听月份变化并存储到本地，以便跨页面同步
            watch(currentMonth, (newVal) => {
                localStorage.setItem('selected_month', newVal);
                currentVersionId.value = null; // 重置当前版本ID
                initData();
                loadHistoryRecords();
            });

            const exportToCSV = () => {
                if (typeof dayjs === 'undefined') {
                    console.error('Day.js 库未加载，无法导出。');
                    saveStatus.value = 'error';
                    setTimeout(() => { saveStatus.value = ''; }, 2000);
                    return;
                }
                let csv = '\uFEFF'; // BOM for Excel
                csv += columns.map(c => c.label).join(',') + '\n';
                
                const rows = [];
                // Add rows in order using IDs
                ['小花老师', 'xh_la', 'xh_ch', 'tz', 'yz', 'xc'].forEach(id => {
                    const row = tableData[id];
                    if (!row) return;
                    const rowData = columns.map(col => {
                        if (col.type === 'formula') return col.formula(row);
                        if (row.isTeachingDisabled && teachingColumns.includes(col.key)) return '/';
                        if (col.decimals !== undefined) return Number(row[col.key] || 0).toFixed(col.decimals);
                        return row[col.key];
                    });
                    rows.push(rowData.join(','));
                });
                
                // Add Grand Total
                const totalData = columns.map(col => {
                    if (col.type === 'formula') return col.formula(grandTotal.value);
                    if (col.key === 'name') return '汇总';
                    if (col.decimals !== undefined) return Number(grandTotal.value[col.key] || 0).toFixed(col.decimals);
                    return grandTotal.value[col.key];
                });
                rows.push(totalData.join(','));

                csv += rows.join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `每月工作数据明细_${dayjs().format('YYYYMMDD')}.csv`;
                link.click();
            };

            onMounted(() => {
                // 确保初始化时 Modal 是关闭的
                showHistory.value = false;
                initData();
                loadHistoryRecords();
                // 初始化 Lucide 图标
                if (window.lucide) {
                    window.lucide.createIcons();
                }
            });

            return {
                columns,
                tableData,
                expandedRows,
                grandTotal,
                teachingColumns,
                currentMonth,
                showDatePicker,
                pickerTempYear,
                selectMonth,
                saveStatus,
                showHistory,
                historyRecords,
                historyNote,
                currentVersionId,
                handleInputChange,
                exportToCSV,
                saveToLocal,
                saveHistoryRecord,
                loadVersion,
                deleteVersion,
                calculateRate,
                calculateAttendanceRate,
                isMobileMenuOpen: ref(false)
            };
        }
    }).mount('#app');
};

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

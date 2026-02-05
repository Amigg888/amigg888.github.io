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
            const normalizeTeacherName = (name) => {
                if (!name) return '未知老师';
                if (name === '许鹤丽') return '桃子老师';
                if (name === '许俊梅') return '小花老师';
                return name;
            };

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
                { key: 'name', label: '姓名', type: 'text', readonly: true, width: '100px' },
                { key: 'demoInvites', label: '试听课邀约', type: 'number' },
                { key: 'demoAttendees', label: '试听课上课', type: 'number' },
                { key: 'demoEnrollments', label: '试听课报课', type: 'number' },
                { key: 'demoRate', label: '转化率', type: 'formula', formula: (row) => calculateRate(row.demoEnrollments, row.demoAttendees) },
                { key: 'regularHours', label: '常规消课', type: 'number' },
                { key: 'oneOnOneAttendees', label: '1对1人次', type: 'number' },
                { key: 'oneOnOneAmount', label: '1对1金额', type: 'number', decimals: 2 },
                { key: 'newStudents', label: '新签人数', type: 'number', decimals: 1 },
                { key: 'newSales', label: '新签业绩', type: 'number', decimals: 2 },
                { key: 'renewalStudents', label: '续费人数', type: 'number', decimals: 1 },
                { key: 'renewalSales', label: '续费业绩', type: 'number', decimals: 2 },
                { key: 'totalSales', label: '总业绩', type: 'formula', formula: (row) => (Number(row.newSales || 0) + Number(row.renewalSales || 0)).toFixed(2) },
                { key: 'attendance', label: '出勤', type: 'number' },
                { key: 'absence', label: '缺勤', type: 'number' },
                { key: 'leave', label: '请假', type: 'number' },
                { key: 'makeup', label: '补课', type: 'number' },
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

            const syncFromGlobalData = () => {
                const year = currentMonth.value.split('-')[0];
                const consumptionData = year === '2026' ? (window.consumptionData2026 || []) : (window.consumptionData2025 || []);
                const experienceData = year === '2026' ? (window.experienceDetails2026 || []) : (window.experienceDetails2025 || []);
                const enrollmentData = year === '2026' ? (window.enrollmentDetails2026 || []) : (window.enrollmentDetails2025 || []);

                // Map of IDs to their filters
                const idConfig = {
                    'xh_la': { name: '小花老师', campus: '临安校区' },
                    'xh_ch': { name: '小花老师', campus: '昌化校区' },
                    'tz': { name: '桃子老师', campus: null },
                    'yz': { name: '柚子老师', campus: null },
                    'xc': { name: '小草老师', campus: null }
                };

                Object.entries(idConfig).forEach(([id, config]) => {
                    const row = tableData[id];
                    if (!row) return;

                    // 1. Consumption Sync
                    const cRecords = consumptionData.filter(d => 
                        normalizeTeacherName(d.姓名) === config.name && 
                        d.月份 === currentMonth.value &&
                        (!config.campus || d.校区 === config.campus)
                    );

                    if (cRecords.length > 0) {
                        row.regularHours = cRecords.reduce((sum, r) => sum + (r.消课课时 || 0), 0);
                        row.oneOnOneAttendees = cRecords.reduce((sum, r) => sum + (r.一对一人次 || 0), 0);
                        row.oneOnOneAmount = cRecords.reduce((sum, r) => sum + (r.一对一金额 || 0), 0);
                        row.attendance = cRecords.reduce((sum, r) => sum + (r.出勤人次 || 0), 0);
                        row.absence = cRecords.reduce((sum, r) => sum + (r.缺勤人次 || 0), 0);
                        row.leave = cRecords.reduce((sum, r) => sum + (r.请假人次 || 0), 0);
                        row.makeup = cRecords.reduce((sum, r) => sum + (r.补课人次 || r.缺课已补 || 0), 0);
                    }

                    // 2. Experience Sync
                    // 试听邀约归属邀约老师
                    const inviteRecords = experienceData.filter(d => 
                        normalizeTeacherName(d.邀约老师) === config.name && 
                        d.体验课时间 && d.体验课时间.startsWith(currentMonth.value) &&
                        (!config.campus || d.所在校区 === config.campus)
                    );
                    if (inviteRecords.length > 0) {
                        row.demoInvites = inviteRecords.length;
                    }

                    // 试听课上课和转化归属上课老师
                    const teachingRecords = experienceData.filter(d => 
                        normalizeTeacherName(d.体验课老师) === config.name && 
                        d.体验课时间 && d.体验课时间.startsWith(currentMonth.value) &&
                        (!config.campus || d.所在校区 === config.campus)
                    );
                    if (teachingRecords.length > 0) {
                        row.demoAttendees = teachingRecords.filter(d => d.状态 === '已体验' || d.状态 === '已报课').length;
                        row.demoEnrollments = teachingRecords.filter(d => d.状态 === '已报课').length;
                    }

                    // 3. Enrollment Sync
                    const enRecords = enrollmentData.filter(d => {
                        const matchTeacher = normalizeTeacherName(d.业绩归属人) === config.name;
                        const matchMonth = d.报课时间 && d.报课时间.startsWith(currentMonth.value);
                        const matchCampus = !config.campus || d.所在校区 === config.campus;
                        return matchTeacher && matchMonth && matchCampus;
                    });

                    if (enRecords.length > 0) {
                        row.newStudents = enRecords.filter(d => d.报课属性 && d.报课属性.includes('新报')).length;
                        row.newSales = enRecords.filter(d => d.报课属性 && d.报课属性.includes('新报'))
                                                .reduce((sum, r) => sum + (Number(r.归属业绩金额) || 0), 0);
                        row.renewalStudents = enRecords.filter(d => d.报课属性 && d.报课属性.includes('续费')).length;
                        row.renewalSales = enRecords.filter(d => d.报课属性 && d.报课属性.includes('续费'))
                                                  .reduce((sum, r) => sum + (Number(r.归属业绩金额) || 0), 0);
                    }
                });

                updateSummaryRow('小花老师');
                saveToLocal();
            };

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

                // If it's Jan 2026, always try to sync from global data to ensure attendance is populated
                if (currentMonth.value === '2026-01') {
                    syncFromGlobalData();
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
                        result[col.key] = rowsToSum.reduce((sum, row) => {
                            // 如果该列对该老师是禁用的（显示为 /），则不计入汇总
                            if (row.isTeachingDisabled && teachingColumns.includes(col.key)) {
                                return sum;
                            }
                            return sum + Number(row[col.key] || 0);
                        }, 0);
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
                saveToLocal,
                syncFromGlobalData,
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

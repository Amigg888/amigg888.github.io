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

            // 其他调整弹窗状态
            const showAdjustmentModal = ref(false);
            const activeTeacherId = ref(null);
            const tempAdjustments = ref([]);

            const openAdjustmentModal = (id) => {
                activeTeacherId.value = id;
                const row = tableData[id];
                if (row) {
                    // 深拷贝现有调整项
                    tempAdjustments.value = row.adjustmentList ? JSON.parse(JSON.stringify(row.adjustmentList)) : [];
                    
                    // 兼容性处理：如果列表为空但总额不为0，将总额作为一个细项存入列表
                    if (tempAdjustments.value.length === 0 && Number(row.adjustments || 0) !== 0) {
                        tempAdjustments.value.push({ 
                            amount: Number(row.adjustments), 
                            remark: row.adjustmentRemark || '原有调整数据' 
                        });
                        // 同步回原数据，确保结构一致
                        row.adjustmentList = JSON.parse(JSON.stringify(tempAdjustments.value));
                    }
                    
                    // 如果最终还是为空，初始化一个空白项
                    if (tempAdjustments.value.length === 0) {
                        tempAdjustments.value.push({ amount: 0, remark: '' });
                    }
                }
                showAdjustmentModal.value = true;
            };

            const addAdjustmentItem = () => {
                tempAdjustments.value.push({ amount: 0, remark: '' });
            };

            const removeAdjustmentItem = (index) => {
                tempAdjustments.value.splice(index, 1);
            };

            const saveAdjustments = () => {
                const row = tableData[activeTeacherId.value];
                if (row) {
                    row.adjustmentList = JSON.parse(JSON.stringify(tempAdjustments.value));
                    // 重新计算总调整金额
                    row.adjustments = row.adjustmentList.reduce((sum, item) => sum + Number(item.amount || 0), 0);
                    handleAdjustmentChange(activeTeacherId.value);
                }
                showAdjustmentModal.value = false;
            };

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
                { key: 'attendance', label: '出勤', width: '130px' },
                { key: 'baseSalary', label: '基本工资' },
                { key: 'inviteBonus', label: '邀约奖金' },
                { key: 'conversionBonus', label: '体验课转化奖励' },
                { key: 'classCommission', label: '课时工资' },
                { key: 'salesCommission', label: '业绩提成' },
                { key: 'performanceBonus', label: '绩效奖金' },
                { key: 'grossPay', label: '应发工资' },
                { key: 'socialSecurity', label: '社保代扣' },
                { key: 'adjustments', label: '其他', width: '150px' },
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

            // 自动保存手动输入的数据
            const saveSalaryData = () => {
                const manualData = {};
                Object.keys(tableData).forEach(id => {
                    const row = tableData[id];
                    if (row.isSummary) return; // 不保存汇总行，汇总行由逻辑生成

                    manualData[id] = {
                        adjustments: row.adjustments,
                        adjustmentList: row.adjustmentList || [],
                        shouldAttend: row.shouldAttend || 0,
                        actualAttend: row.actualAttend || 0
                    };

                    if (row.isPartTime) {
                        manualData[id].classHours = row.classHours;
                        manualData[id].hourlyRate = row.hourlyRate;
                    }
                });

                localStorage.setItem(`salary_manual_${currentMonth.value}`, JSON.stringify(manualData));
                
                saveStatus.value = 'saving';
                setTimeout(() => {
                    saveStatus.value = 'saved';
                    setTimeout(() => { saveStatus.value = ''; }, 1000);
                }, 300);
            };

            // 计算合计行
            const grandTotal = computed(() => {
                const total = {
                    name: '合计',
                    baseSalary: 0,
                    inviteBonus: 0,
                    conversionBonus: 0,
                    classCommission: 0,
                    salesCommission: 0,
                    performanceBonus: 0,
                    grossPay: 0,
                    socialSecurity: 0,
                    adjustments: 0,
                    netPay: 0
                };

                // 只累加顶层老师（不累加分校区，避免重复计算）
                const mainTeacherIds = ['小花老师', 'tz', 'yz', 'xc', 'qq'];
                mainTeacherIds.forEach(id => {
                    const row = tableData[id];
                    if (row) {
                        total.baseSalary += Number(row.baseSalary || 0);
                        total.inviteBonus += Number(row.inviteBonus || 0);
                        total.conversionBonus += Number(row.conversionBonus || 0);
                        // 琪琪老师的课时工资不计入合计
                        if (id !== 'qq') {
                            total.classCommission += Number(row.classCommission || 0);
                        }
                        total.salesCommission += Number(row.salesCommission || 0);
                        total.performanceBonus += Number(row.performanceBonus || 0);
                        total.grossPay += Number(row.grossPay || 0);
                        total.socialSecurity += Number(row.socialSecurity || 0);
                        total.adjustments += Number(row.adjustments || 0);
                        total.netPay += Number(row.netPay || 0);
                    }
                });

                return total;
            });

            const initData = () => {
                const savedWorkData = localStorage.getItem(`work_data_${currentMonth.value}`);
                let workData = null;

                // 加载手动保存的调整数据
                const manualSaved = localStorage.getItem(`salary_manual_${currentMonth.value}`);
                const manualData = manualSaved ? JSON.parse(manualSaved) : {};

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
                        'xh_la': '临安校区',
                        'xh_ch': '昌化校区',
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
                        
                        // 获取现有的调整金额和备注（从本地持久化数据加载）
                        const saved = manualData[id] || {};
                        const existingAdjustments = saved.adjustments || 0;
                        const existingAdjustmentList = saved.adjustmentList || [];
                        const shouldAttend = saved.shouldAttend !== undefined ? saved.shouldAttend : 26;
                        const actualAttend = saved.actualAttend !== undefined ? saved.actualAttend : 26;
                        
                        // 计算基本工资扣除
                        let attendanceAdjustedBase = baseSalary;
                        if (shouldAttend > 0 && actualAttend < shouldAttend) {
                            attendanceAdjustedBase = baseSalary - (baseSalary / shouldAttend * (shouldAttend - actualAttend));
                        }
                        
                        const grossPay = attendanceAdjustedBase + inviteBonus + conversionBonus + classCommission + salesCommission + performanceBonus;
                        const socialSecurity = socialSecurityMap[id] || 0;
                        const netPay = grossPay - socialSecurity + Number(existingAdjustments);

                        tableData[id] = {
                            id,
                            name: teacherDisplayNames[id] || work.name,
                            isTeachingDisabled: work.isTeachingDisabled || false,
                            shouldAttend,
                            actualAttend,
                            absence: Number(work.absence || 0),
                            leave: Number(work.leave || 0),
                            makeup: Number(work.makeup || 0),
                            baseSalary: attendanceAdjustedBase,
                            originalBaseSalary: baseSalary, // 保留原始基本工资用于显示或重新计算
                            inviteBonus,
                            conversionBonus,
                            classCommission,
                            salesCommission,
                            performanceBonus,
                            grossPay,
                            socialSecurity,
                            adjustments: existingAdjustments,
                            adjustmentList: existingAdjustmentList,
                            netPay
                        };
                    });

                        const qiqiId = 'qq';
                    const qiqiManual = manualData[qiqiId] || {};
                    tableData[qiqiId] = {
                        id: qiqiId,
                        name: '琪琪老师',
                        isPartTime: true,
                        shouldAttend: qiqiManual.shouldAttend || 0,
                        actualAttend: qiqiManual.actualAttend || 0,
                        classHours: qiqiManual.classHours || 0,
                        hourlyRate: qiqiManual.hourlyRate || 0,
                        classCommission: (Number(qiqiManual.hourlyRate || 0) * 0.5),
                        baseSalary: 0,
                        inviteBonus: 0,
                        conversionBonus: 0,
                        salesCommission: 0,
                        performanceBonus: 0,
                        socialSecurity: 0,
                        adjustments: qiqiManual.adjustments || 0,
                        adjustmentList: qiqiManual.adjustmentList || [],
                        get grossPay() { return this.classCommission; },
                        get netPay() { return this.classCommission + Number(this.adjustments || 0); }
                    };

                    // 4. 小花老师汇总
                    const xh_la = tableData['xh_la'];
                    const xh_ch = tableData['xh_ch'];
                    if (xh_la && xh_ch) {
                        const totalAdjustments = Number(xh_la.adjustments || 0) + Number(xh_ch.adjustments || 0);
                        tableData['小花老师'] = {
                            id: 'xh_total',
                            name: '小花老师',
                            isSummary: true,
                            shouldAttend: xh_la.shouldAttend, // 假设应出勤天数一致
                            actualAttend: xh_la.actualAttend, 
                            baseSalary: xh_la.baseSalary + xh_ch.baseSalary,
                            inviteBonus: xh_la.inviteBonus + xh_ch.inviteBonus,
                            conversionBonus: xh_la.conversionBonus + xh_ch.conversionBonus,
                            classCommission: xh_la.classCommission + xh_ch.classCommission,
                            salesCommission: xh_la.salesCommission + xh_ch.salesCommission,
                            performanceBonus: xh_la.performanceBonus + xh_ch.performanceBonus,
                            grossPay: xh_la.grossPay + xh_ch.grossPay,
                            socialSecurity: socialSecurityMap['小花老师'],
                            adjustments: totalAdjustments,
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

            const getFormula = (id, colKey) => {
                const row = tableData[id];
                if (!row) return '';

                const f = (val) => formatMoney(val);
                const originalBase = row.originalBaseSalary || baseSalaryMap[id] || 0;

                // 从全局数据获取原始指标
                const savedWorkData = localStorage.getItem(`work_data_${currentMonth.value}`);
                let work = null;
                if (savedWorkData) {
                    try {
                        const parsed = JSON.parse(savedWorkData);
                        work = parsed[id];
                    } catch (e) {}
                }

                switch (colKey) {
                    case 'attendance':
                        if (row.isSummary) return '汇总校区出勤情况';
                        if (id === 'xc') {
                            return `出勤/缺勤/请假/补课: ${row.actualAttend || 0} / ${row.absence || 0} / ${row.leave || 0} / ${row.makeup || 0}`;
                        }
                        return `出勤天数: ${row.actualAttend} / ${row.shouldAttend} (工作日)`;

                    case 'baseSalary':
                        if (row.isPartTime) return `上课课时: ${row.classHours} 课时 × ${row.hourlyRate} 元/课时 × 50% (分成) = ${f(row.classCommission)}`;
                        if (row.isSummary) return '汇总各校区老师的基本工资（已扣除缺勤）';
                        if (row.shouldAttend > 0 && row.actualAttend < row.shouldAttend) {
                            return `出勤折算: ${f(originalBase)} (原薪) - (${f(originalBase)} / ${row.shouldAttend}天 × ${row.shouldAttend - row.actualAttend}天缺勤) = ${f(row.baseSalary)}`;
                        }
                        return `全勤基本工资: ${f(row.baseSalary)}`;

                    case 'inviteBonus':
                        if (row.isPartTime || row.isSummary) return '';
                        const invites = work ? (work.demoInvites || 0) : 0;
                        return `邀约奖励: ${invites} 人次 × 20 元/人 = ${f(row.inviteBonus)}`;

                    case 'conversionBonus':
                        if (row.isPartTime || row.isSummary) return '';
                        const enrolls = work ? (work.demoEnrollments || 0) : 0;
                        return `转化奖励: ${enrolls} 人次 × 50 元/人 = ${f(row.conversionBonus)}`;

                    case 'classCommission':
                        if (row.isPartTime) return `课时费: ${row.classHours} 课时 × ${row.hourlyRate} 元/课时 × 50% = ${f(row.classCommission)}`;
                        if (row.isSummary) return '汇总各校区老师的课时提成';
                        const regHours = work ? (work.regularHours || 0) : 0;
                        const oneOnOne = work ? (work.oneOnOneAmount || 0) : 0;
                        let rate = 10;
                        if (regHours > 200) rate = 15;
                        else if (regHours > 150) rate = 12;
                        return `常规课: ${regHours} 课时 × ${rate} 元/课时 (${f(regHours * rate)}) + 1对1提成: ${f(oneOnOne)} × 30% (${f(oneOnOne * 0.3)}) = ${f(row.classCommission)}`;

                    case 'salesCommission':
                        if (row.isPartTime || row.isSummary) return '';
                        const sales = work ? (work.totalSales || (Number(work.newSales || 0) + Number(work.renewalSales || 0))) : 0;
                        let sRate = 0.03;
                        if (sales > 30000) sRate = 0.07;
                        else if (sales > 10000) sRate = 0.05;
                        return `业绩提成: ${f(sales)} × ${(sRate * 100).toFixed(0)}% = ${f(row.salesCommission)}`;

                    case 'performanceBonus':
                        if (row.isPartTime || row.isSummary) return '';
                        return `绩效奖金: 500 元 × 考核系数 = ${f(row.performanceBonus)}`;

                    case 'grossPay':
                        if (row.isPartTime) return `应发工资 = 课时费 (${f(row.classCommission)})`;
                        if (row.isSummary) return '应发总额 = 汇总各校区应发工资之和';
                        return `应发工资 = 基本工资 (${f(row.baseSalary)}) + 邀约 (${f(row.inviteBonus)}) + 转化 (${f(row.conversionBonus)}) + 课时 (${f(row.classCommission)}) + 销售 (${f(row.salesCommission)}) + 绩效 (${f(row.performanceBonus)}) = ${f(row.grossPay)}`;

                    case 'socialSecurity':
                        return row.isSummary ? '汇总社保代扣' : `个人缴纳社保费用: ${f(row.socialSecurity)}`;

                    case 'adjustments':
                        if (row.isSummary) return '汇总所有手动调整项金额';
                        if (!row.adjustmentList || row.adjustmentList.length === 0) return '暂无其他调整项 (点击可添加)';
                        return '调整明细：\n' + row.adjustmentList.map(item => `• ${item.remark || '未命名'}: ${f(item.amount)}`).join('\n');

                    case 'netPay':
                        if (row.isPartTime) return `实发工资 = 应发 (${f(row.grossPay)}) + 其他调整 (${f(row.adjustments)}) = ${f(row.netPay)}`;
                        return `实发工资 = 应发 (${f(row.grossPay)}) - 社保 (${f(row.socialSecurity)}) + 其他调整 (${f(row.adjustments)}) = ${f(row.netPay)}`;

                    default:
                        return '';
                }
            };

            const handleAdjustmentChange = (id) => {
                const row = tableData[id];
                if (!row) return;
                
                // 重新计算基本工资和总额
                if (!row.isPartTime && !row.isSummary) {
                    const originalBase = row.originalBaseSalary || baseSalaryMap[id] || 0;
                    if (row.shouldAttend > 0 && row.actualAttend < row.shouldAttend) {
                        row.baseSalary = originalBase - (originalBase / row.shouldAttend * (row.shouldAttend - row.actualAttend));
                    } else {
                        row.baseSalary = originalBase;
                    }
                    
                    // 重新计算应发工资
                    row.grossPay = row.baseSalary + row.inviteBonus + row.conversionBonus + row.classCommission + row.salesCommission + row.performanceBonus;
                }

                // 重新计算实发工资
                if (row.isPartTime) {
                    row.classCommission = (Number(row.hourlyRate || 0) * 0.5);
                    row.netPay = row.classCommission + Number(row.adjustments || 0);
                } else if (row.isSummary) {
                    // 汇总行逻辑
                    if (id === '小花老师') {
                        const xh_la = tableData['xh_la'];
                        const xh_ch = tableData['xh_ch'];
                        if (xh_la && xh_ch) {
                            row.baseSalary = xh_la.baseSalary + xh_ch.baseSalary;
                            row.grossPay = xh_la.grossPay + xh_ch.grossPay;
                            row.adjustments = Number(xh_la.adjustments || 0) + Number(xh_ch.adjustments || 0);
                            row.netPay = row.grossPay - row.socialSecurity + row.adjustments;
                        }
                    }
                } else {
                    row.netPay = row.grossPay - row.socialSecurity + Number(row.adjustments || 0);
                }
                
                // 如果是校区老师，同步更新汇总行
                if (id === 'xh_la' || id === 'xh_ch') {
                    handleAdjustmentChange('小花老师');
                }

                // 触发自动保存
                saveSalaryData();
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
                isMobileMenuOpen,
                grandTotal,
                showAdjustmentModal,
                activeTeacherId,
                tempAdjustments,
                openAdjustmentModal,
                addAdjustmentItem,
                removeAdjustmentItem,
                saveAdjustments,
                getFormula
            };
        }
    }).mount('#app');
};

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

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
            const isAuthorized = ref(true); // 已移除密码验证
            const inputPassword = ref('');
            const passwordError = ref(false);

            // Check session storage for existing authorization
            onMounted(() => {
                if (sessionStorage.getItem('salary_authorized') === 'true') {
                    isAuthorized.value = true;
                }
            });

            // User Info for RBAC - 默认为管理员以确保能看到所有数据
            const currentUser = ref(JSON.parse(localStorage.getItem('user')) || { role: 'admin', name: '总管理员' });
            const isMobileMenuOpen = ref(false);

            // 其他调整弹窗状态
            const showAdjustmentModal = ref(false);
            const activeTeacherId = ref(null);
            const tempAdjustments = ref([]);

            const copyingId = ref(null);

            const shouldShowInCard = (id, colKey) => {
                const row = tableData[id];
                if (!row || colKey === 'name') return false;
                
                // 跳过不适用的列
                if (row.isTeachingDisabled && ['conversionBonus', 'classCommission', 'performanceBonus'].includes(colKey)) {
                    return false;
                }
                if (row.isPartTime && ['attendance', 'conversionBonus', 'salesCommission', 'performanceBonus'].includes(colKey)) {
                    return false;
                }
                return true;
            };

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

            const teacherImages = {
                '小花老师': 'img/小花老师.png',
                '临安校区': 'img/小花老师.png',
                '昌化校区': 'img/小花老师.png',
                '小草老师': 'img/小草老师.png',
                '柚子老师': 'img/柚子老师.png',
                '桃子老师': 'img/桃子老师.png'
            };

            const columns = [
                { key: 'name', label: '姓名', width: '130px' },
                { key: 'attendance', label: '出勤', width: '80px' },
                { key: 'baseSalary', label: '基本工资', width: '85px' },
                { key: 'inviteBonus', label: '邀约奖金', width: '85px' },
                { key: 'conversionBonus', label: '体验转化', width: '85px' },
                { key: 'classCommission', label: '课时工资', width: '85px' },
                { key: 'salesCommission', label: '业绩提成', width: '85px' },
                { key: 'performanceBonus', label: '绩效奖金', width: '85px' },
                { key: 'grossPay', label: '应发工资', width: '85px' },
                { key: 'socialSecurity', label: '社保代扣', width: '85px' },
                { key: 'adjustments', label: '其他', width: '85px' },
                { key: 'netPay', label: '实发工资', width: '85px' }
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
            const saveSalaryData = async () => {
                const manualData = {};
                const workDataToSave = {};
                
                Object.keys(tableData).forEach(id => {
                    const row = tableData[id];
                    if (row.isSummary) return;

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
                    
                    workDataToSave[id] = { ...row };
                });

                localStorage.setItem(`salary_manual_${currentMonth.value}`, JSON.stringify(manualData));
                
                saveStatus.value = 'saving';
                
                try {
                    const response = await fetch('/work-data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ month: currentMonth.value, data: workDataToSave })
                    });
                    
                    if (response.ok) {
                        saveStatus.value = 'saved';
                        console.log('工资数据已保存到服务器');
                    } else {
                        console.error('保存到服务器失败');
                        saveStatus.value = 'saved';
                    }
                } catch (error) {
                    console.error('保存到服务器出错:', error);
                    saveStatus.value = 'saved';
                }
                
                setTimeout(() => { saveStatus.value = ''; }, 1000);
            };

            onMounted(() => {
                initData();
                loadHistoryRecords();
            });

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

            const initData = async () => {
                const year = currentMonth.value.split('-')[0];
                let workData = null;

                // 1. 尝试从服务器加载工作数据 (Independent Work Database)
                let isFromServer = false;
                try {
                    // 如果是在本地开发环境（如 Live Server 5500/5501 端口），尝试连接到 3001 端口的服务
                    const serverPort = '3001';
                    const host = window.location.hostname || 'localhost';
                    const serverUrl = window.location.port === serverPort ? '' : `http://${host}:${serverPort}`;
                    
                    // 添加时间戳防止缓存
                    const timestamp = new Date().getTime();
                    console.log(`正在从服务器获取 ${currentMonth.value} 的工作数据... URL: ${serverUrl}/work-data?month=${currentMonth.value}&t=${timestamp}`);
                    const response = await fetch(`${serverUrl}/work-data?month=${currentMonth.value}&t=${timestamp}`, {
                        credentials: 'include'
                    });
                    if (response.ok) {
                        const serverData = await response.json();
                        if (serverData && Object.keys(serverData).length > 0) {
                            workData = serverData;
                            isFromServer = true;
                            console.log(`从服务器成功加载了 ${currentMonth.value} 的工作数据`, workData);
                        }
                    } else {
                        console.warn(`服务器返回错误: ${response.status}`);
                    }
                } catch (e) {
                    console.error('从服务器获取工作数据失败:', e);
                }

                // 2. 如果服务器没有数据，回退到 localStorage
                if (!workData) {
                    const savedWorkData = localStorage.getItem(`work_data_${currentMonth.value}`);
                    if (savedWorkData) {
                        try {
                            workData = JSON.parse(savedWorkData);
                            console.log('从本地缓存加载了工作数据');
                        } catch (e) {
                            console.error('解析本地工作数据失败:', e);
                        }
                    }
                }

                // 3. 如果本地也没有，回退到预设数据
                if (!workData && window.presetWorkHistory && window.presetWorkHistory[currentMonth.value]) {
                    const monthPresets = window.presetWorkHistory[currentMonth.value];
                    if (monthPresets.length > 0) {
                        const latestPreset = [...monthPresets].sort((a, b) => b.timestamp - a.timestamp)[0];
                        workData = latestPreset.data;
                        console.log(`使用预设数据进行 ${currentMonth.value} 的工资计算`);
                    }
                }

                // 加载手动保存的调整数据
                const manualSaved = localStorage.getItem(`salary_manual_${currentMonth.value}`);
                const manualData = manualSaved ? JSON.parse(manualSaved) : {};

                // 强制同步逻辑优化：只有在没有服务器数据，或者明确需要从全局 JS 同步时才执行
                // 如果已经从服务器获取了数据，则不再从静态 JS 文件强制覆盖，除非服务器数据为空
                const consumptionData = year === '2026' ? (window.consumptionData2026 || []) : (window.consumptionData2025 || []);
                const experienceData = year === '2026' ? (window.experienceDetails2026 || []) : (window.experienceDetails2025 || []);
                const enrollmentData = year === '2026' ? (window.enrollmentDetails2026 || []) : (window.enrollmentDetails2025 || []);
                
                const hasGlobalData = consumptionData.length > 0 || experienceData.length > 0 || enrollmentData.length > 0;
                
                if (!isFromServer && hasGlobalData) {
                    console.log(`从全局数据同步 ${currentMonth.value} 的工作数据...`);
                    const oldWorkData = workData || {};
                    workData = {};
                    
                    const idConfig = {
                        'xh_la': { name: '小花老师', campus: '临安校区' },
                        'xh_ch': { name: '小花老师', campus: '昌化校区' },
                        'tz': { name: '桃子老师', campus: null },
                        'yz': { name: '柚子老师', campus: null },
                        'xc': { name: '小草老师', campus: null, isTeachingDisabled: true },
                        'qq': { name: '琪琪老师', campus: null, isPartTime: true }
                    };

                    Object.entries(idConfig).forEach(([id, config]) => {
                        const monthStr = currentMonth.value;
                        
                        // 1. 邀约/转化数据 (experienceData)
                        // 邀约奖金归属于邀约老师
                        const inviteExp = experienceData.filter(d => {
                            const dMonth = d.体验课时间 ? d.体验课时间.substring(0, 7) : '';
                            return dMonth === monthStr && 
                                   d.邀约老师 === config.name && 
                                   (!config.campus || d.所在校区 === config.campus);
                        });
                        const demoInvites = inviteExp.length;

                        // 转化奖金逻辑修正：
                        // 教务销售老师（如小草老师）只拿邀约奖金（20元/人）。
                        // 只有实际上课的老师（体验课老师）才拿转化奖金（50元/人）。
                        const teachingExp = experienceData.filter(d => {
                            const dMonth = d.体验课时间 ? d.体验课时间.substring(0, 7) : '';
                            return dMonth === monthStr && 
                                   d.体验课老师 === config.name && 
                                   (!config.campus || d.所在校区 === config.campus);
                        });
                        const demoAttendees = teachingExp.filter(d => d.状态 === '已体验' || d.状态 === '已报课').length;
                        const demoEnrollments = teachingExp.filter(d => d.状态 === '已报课').length;

                        // 2. 消课数据 (consumptionData)
                        const teacherCons = consumptionData.filter(d => d.月份 === monthStr && d.姓名 === config.name && (!config.campus || d.校区 === config.campus));
                        const regularHours = teacherCons.reduce((sum, d) => sum + Number(d.消课课时 || 0), 0);
                        const oneOnOneAttendees = teacherCons.reduce((sum, d) => sum + Number(d.一对一人次 || 0), 0);
                        
                        // 优先从全局数据同步一对一金额
                        const syncedOneOnOneAmount = teacherCons.reduce((sum, d) => sum + Number(d.一对一金额 || 0), 0);
                        
                        // 如果全局数据没有一对一金额，则尝试从以下来源获取：
                        // 1. 本地加载的旧数据 (oldWorkData - 包含从服务器获取的数据)
                        // 2. 预设的 JSON 数据 (presetWorkHistory)
                        let oneOnOneAmount = syncedOneOnOneAmount;
                        if (oneOnOneAmount === 0) {
                            // 尝试从旧数据获取 (这里包含从服务器加载的数据)
                            if (oldWorkData[id]) {
                                oneOnOneAmount = Number(oldWorkData[id].oneOnOneAmount || 0);
                                console.log(`${config.name} 一对一金额从旧数据恢复: ${oneOnOneAmount}`);
                            }
                            
                            // 如果还是 0，且存在预设数据，从预设数据中获取
                            if (oneOnOneAmount === 0 && window.presetWorkHistory && window.presetWorkHistory[monthStr]) {
                                const monthPresets = window.presetWorkHistory[monthStr];
                                if (monthPresets.length > 0) {
                                    const latestPreset = [...monthPresets].sort((a, b) => b.timestamp - a.timestamp)[0];
                                    if (latestPreset.data && latestPreset.data[id]) {
                                        oneOnOneAmount = Number(latestPreset.data[id].oneOnOneAmount || 0);
                                    }
                                }
                            }
                        }
                        
                        const attendance = teacherCons.reduce((sum, d) => sum + Number(d.出勤人次 || 0), 0);
                        const absence = teacherCons.reduce((sum, d) => sum + Number(d.缺勤人次 || 0), 0);
                        const leave = teacherCons.reduce((sum, d) => sum + Number(d.请假人次 || 0), 0);
                        const makeup = teacherCons.reduce((sum, d) => sum + Number(d.缺课已补 || 0), 0);

                        // 3. 业绩数据 (enrollmentData)
                        const teacherEnr = enrollmentData.filter(d => {
                            const dMonth = d.报课时间 ? d.报课时间.substring(0, 7) : '';
                            return dMonth === monthStr && 
                                   d.业绩归属人 === config.name && 
                                   (!config.campus || d.所在校区 === config.campus);
                        });
                        const newSales = teacherEnr.filter(d => d.报课属性 === '新报' || d.报课属性 === '新签').reduce((sum, d) => sum + Number(d.实收金额 || 0), 0);
                        const renewalSales = teacherEnr.filter(d => d.报课属性 === '续费').reduce((sum, d) => sum + Number(d.实收金额 || 0), 0);
                        const totalSales = newSales + renewalSales;

                        workData[id] = {
                            id,
                            name: config.name,
                            isTeachingDisabled: config.isTeachingDisabled || false,
                            isPartTime: config.isPartTime || false,
                            demoInvites,
                            demoAttendees,
                            demoEnrollments,
                            regularHours,
                            oneOnOneAttendees,
                            oneOnOneAmount,
                            attendance,
                            absence,
                            leave,
                            makeup,
                            newSales,
                            renewalSales,
                            totalSales
                        };
                    });
                } else {
                    console.warn(`未找到 ${currentMonth.value} 的全局数据，跳过同步`);
                }

                if (workData) {
                    const teachersList = ['xh_la', 'xh_ch', 'tz', 'yz', 'xc', 'qq'];
                    const teacherDisplayNames = {
                        'xh_la': '临安校区',
                        'xh_ch': '昌化校区',
                        'tz': '桃子老师',
                        'yz': '柚子老师',
                        'xc': '小草老师',
                        'qq': '琪琪老师'
                    };

                    // 用户名到老师ID的映射
                    const userNameToIds = {
                        '小花老师': ['xh_la', 'xh_ch'],
                        '桃子老师': ['tz'],
                        '柚子老师': ['yz'],
                        '小草老师': ['xc'],
                        '琪琪老师': ['qq']
                    };

                    // Filter for teachers based on user role
                    let filteredTeachers = teachersList;
                    let canSeePartTime = true; // 所有人都可以看到兼职老师数据
                    
                    if (currentUser.value.role === 'teacher') {
                        // 获取当前用户可查看的老师ID列表
                        const allowedIds = userNameToIds[currentUser.value.name] || [];
                        filteredTeachers = teachersList.filter(t => allowedIds.includes(t));
                        console.log(`教师用户 ${currentUser.value.name} 可查看的数据:`, filteredTeachers);
                    }

                    // Remove other teachers if they exist in tableData (cleanup)
                    // qq (琪琪老师) 现在所有人都可见
                    Object.keys(tableData).forEach(key => {
                        // 其他老师的清理逻辑
                        if (key !== '小花老师' && key !== 'qq' && !filteredTeachers.includes(key) && !['xh_la', 'xh_ch'].includes(key)) {
                             delete tableData[key];
                        }
                    });

                    // Initialize salary data based on work data
                    // 确保所有老师（包括琪琪老师）都被处理
                    const allTeacherIds = [...new Set([...filteredTeachers, 'qq'])];
                    
                    allTeacherIds.forEach(id => {
                        // 琪琪老师特殊处理
                        if (id === 'qq') {
                            const qiqiId = 'qq';
                            const qiqiWork = workData[qiqiId] || {};
                            const qiqiManual = manualData[qiqiId] || {};
                            
                            const qiqiHours = Number(qiqiWork.classHours || qiqiManual.classHours || 0);
                            const qiqiRate = Number(qiqiWork.hourlyRate || qiqiManual.hourlyRate || 0);
                            const qiqiCommission = qiqiRate * 0.5;

                            tableData[qiqiId] = {
                                id: qiqiId,
                                name: '琪琪老师',
                                isPartTime: true,
                                shouldAttend: 0,
                                actualAttend: 0,
                                classHours: qiqiHours,
                                hourlyRate: qiqiRate,
                                classCommission: qiqiCommission,
                                baseSalary: 0,
                                inviteBonus: 0,
                                conversionBonus: 0,
                                salesCommission: 0,
                                performanceBonus: 0,
                                socialSecurity: 0,
                                adjustments: qiqiWork.adjustments || qiqiManual.adjustments || 0,
                                adjustmentList: qiqiWork.adjustmentList || qiqiManual.adjustmentList || [],
                                get grossPay() { return this.classCommission; },
                                get netPay() { return this.classCommission + Number(this.adjustments || 0); }
                            };
                            return;
                        }
                        
                        // 其他老师正常处理
                        const work = workData[id] || { name: id, demoInvites: 0, demoEnrollments: 0, attendance: 0, totalSales: 0 };
                        const baseSalary = baseSalaryMap[id] || 0;
                        
                        // 1. 体验课奖金 (直接取工作数据中的邀约和转化数)
                        // 如果老师禁用了教学相关提成（如小草老师），则转化奖金和课时提成应为 0
                        const isTeachingDisabled = work.isTeachingDisabled || false;
                        const inviteBonus = Number(work.demoInvites || 0) * 20;
                        const conversionBonus = isTeachingDisabled ? 0 : Number(work.demoEnrollments || 0) * 50;
                        
                        // 2. 课时提成
                        const regularHours = Number(work.regularHours || 0); // 常规课消课时 (以此为准计算课时费)
                        
                        let classRate = 10;
                        if (regularHours > 200) classRate = 15;
                        else if (regularHours > 150) classRate = 12;
                        
                        const regularClassCommission = regularHours * classRate;
                        const oneOnOneAmount = Number(work.oneOnOneAmount || 0);
                        const oneOnOneCommission = oneOnOneAmount * 0.3; // 一对一金额 * 30%
                        
                        const classCommission = isTeachingDisabled ? 0 : (regularClassCommission + oneOnOneCommission);
                        
                        // 3. 销售提成
                        const totalSales = Number(work.totalSales || (Number(work.newSales || 0) + Number(work.renewalSales || 0)));
                        let salesRate = 0.03;
                        if (totalSales > 30000) salesRate = 0.07;
                        else if (totalSales > 10000) salesRate = 0.05;
                        const salesCommission = totalSales * salesRate;

                        // 4. 绩效奖金 (暂不执行)
                        let performanceBonus = 0;
                        
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
                            // 存储原始计算指标用于弹窗显示
                            regularHours,
                            oneOnOneAmount,
                            totalSales,
                            demoInvites: work.demoInvites || 0,
                            demoEnrollments: work.demoEnrollments || 0,
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
                const num = Number(val || 0);
                return num.toFixed(2);
            };

            const getFormula = (id, colKey) => {
                const row = tableData[id];
                if (!row) return '';

                const f = (val) => formatMoney(val);
                const originalBase = row.originalBaseSalary || baseSalaryMap[id] || 0;

                switch (colKey) {
                    case 'attendance':
                        if (row.isSummary) return '汇总校区出勤情况';
                        if (id === 'xc') {
                            return `出勤/缺勤/请假/补课: ${row.actualAttend || 0} / ${row.absence || 0} / ${row.leave || 0} / ${row.makeup || 0}`;
                        }
                        return `出勤天数: ${row.actualAttend} / ${row.shouldAttend} (工作日)`;

                    case 'baseSalary':
                        if (row.isPartTime) return `上课课时: ${row.classHours} 课时 | 课时金额: ${row.hourlyRate} × 50% (分成) = ${f(row.classCommission)}`;
                        if (row.isSummary) {
                            if (id === '小花老师') {
                                const xh_la = tableData['xh_la'];
                                const xh_ch = tableData['xh_ch'];
                                if (xh_la && xh_ch) {
                                    return `基本工资总计 = 临安(${f(xh_la.baseSalary)}) + 昌化(${f(xh_ch.baseSalary)}) = ${f(row.baseSalary)}`;
                                }
                            }
                            return '汇总各校区老师的基本工资（已扣除缺勤）';
                        }
                        if (row.shouldAttend > 0 && row.actualAttend < row.shouldAttend) {
                            return `出勤折算: ${f(originalBase)} (原薪) - (${f(originalBase)} / ${row.shouldAttend}天 × ${row.shouldAttend - row.actualAttend}天缺勤) = ${f(row.baseSalary)}`;
                        }
                        return `全勤基本工资: ${f(row.baseSalary)}`;

                    case 'inviteBonus':
                        if (row.isSummary) {
                            if (id === '小花老师') {
                                const xh_la = tableData['xh_la'];
                                const xh_ch = tableData['xh_ch'];
                                if (xh_la && xh_ch) {
                                    return `邀约奖金总计 = 临安(${f(xh_la.inviteBonus)}) + 昌化(${f(xh_ch.inviteBonus)}) = ${f(row.inviteBonus)}`;
                                }
                            }
                            return '汇总各校区邀约奖金';
                        }
                        if (row.isPartTime) return '';
                        return `邀约到店: ${row.demoInvites || 0} 人次 × 20 元/人 = ${f(row.inviteBonus)}`;

                    case 'conversionBonus':
                        if (row.isSummary) {
                            if (id === '小花老师') {
                                const xh_la = tableData['xh_la'];
                                const xh_ch = tableData['xh_ch'];
                                if (xh_la && xh_ch) {
                                    return `转化奖金总计 = 临安(${f(xh_la.conversionBonus)}) + 昌化(${f(xh_ch.conversionBonus)}) = ${f(row.conversionBonus)}`;
                                }
                            }
                            return '汇总各校区转化奖金';
                        }
                        if (row.isPartTime) return '';
                        if (row.isTeachingDisabled) return '教务老师不计转化奖金';
                        return `报课转化: ${row.demoEnrollments || 0} 人次 × 50 元/人 = ${f(row.conversionBonus)}`;

                    case 'classCommission':
                        if (row.isPartTime) return `课时费: ${row.hourlyRate} (课时金额) × 50% = ${f(row.classCommission)}`;
                        if (row.isSummary) {
                            if (id === '小花老师') {
                                const xh_la = tableData['xh_la'];
                                const xh_ch = tableData['xh_ch'];
                                if (xh_la && xh_ch) {
                                    return `课时提成总计 = 临安(${f(xh_la.classCommission)}) + 昌化(${f(xh_ch.classCommission)}) = ${f(row.classCommission)}`;
                                }
                            }
                            return '汇总各校区老师的课时提成';
                        }
                        
                        if (row.isTeachingDisabled) return '教务老师不计课时提成';
                        const regHours = row.regularHours || 0;
                        const oneOnOne = row.oneOnOneAmount || 0;
                        
                        let rate = 10;
                        if (regHours > 200) rate = 15;
                        else if (regHours > 150) rate = 12;
                        
                        const regTotal = regHours * rate;
                        const oneTotal = oneOnOne * 0.3;
                        
                        return `常规课: ${regHours} 课时 × ${rate} 元/课时 (${f(regTotal)}) + 1对1提成: ${f(oneOnOne)} × 30% (${f(oneTotal)}) = ${f(regTotal + oneTotal)}`;

                    case 'salesCommission':
                        if (row.isPartTime) return '';
                        if (row.isSummary) {
                            if (id === '小花老师') {
                                const xh_la = tableData['xh_la'];
                                const xh_ch = tableData['xh_ch'];
                                if (xh_la && xh_ch) {
                                    return `业绩提成总计 = 临安(${f(xh_la.salesCommission)}) + 昌化(${f(xh_ch.salesCommission)}) = ${f(row.salesCommission)}`;
                                }
                            }
                            return '';
                        }
                        const sales = row.totalSales || 0;
                        let sRate = 0.03;
                        if (sales > 30000) sRate = 0.07;
                        else if (sales > 10000) sRate = 0.05;
                        const sTotal = sales * sRate;
                        return `业绩提成: ${f(sales)} × ${(sRate * 100).toFixed(0)}% = ${f(sTotal)}`;

                    case 'performanceBonus':
                        if (row.isPartTime || row.isSummary) return '';
                        return `绩效工资暂不执行`;

                    case 'grossPay':
                        if (row.isPartTime) return `应发工资 = 课时费 (${f(row.classCommission)})`;
                        if (row.isSummary) {
                            if (id === '小花老师') {
                                const xh_la = tableData['xh_la'];
                                const xh_ch = tableData['xh_ch'];
                                if (xh_la && xh_ch) {
                                    return `应发总额 = 临安校区(${f(xh_la.grossPay)}) + 昌化校区(${f(xh_ch.grossPay)}) = ${f(row.grossPay)}`;
                                }
                            }
                            return '应发总额 = 汇总各校区应发工资之和';
                        }
                        
                        // 动态构建公式，只包含金额大于 0 的项
                        const parts = [];
                        if (row.baseSalary > 0) parts.push(`基本工资 (${f(row.baseSalary)})`);
                        if (row.inviteBonus > 0) parts.push(`邀约 (${f(row.inviteBonus)})`);
                        if (row.conversionBonus > 0) parts.push(`转化 (${f(row.conversionBonus)})`);
                        if (row.classCommission > 0) parts.push(`课时 (${f(row.classCommission)})`);
                        if (row.salesCommission > 0) parts.push(`销售 (${f(row.salesCommission)})`);
                        if (row.performanceBonus > 0) parts.push(`绩效 (${f(row.performanceBonus)})`);
                        
                        const formulaStr = parts.length > 0 ? parts.join(' + ') : '0.00';
                        return `应发工资 = ${formulaStr} = ${f(row.grossPay)}`;

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
                
                // 重新计算琪琪老师（兼职）的逻辑
                if (row.isPartTime) {
                    row.classCommission = Number(row.hourlyRate || 0) * 0.5;
                    row.grossPay = row.classCommission;
                }
                
                // 重新计算常规老师的基本工资和总额
                else if (!row.isSummary) {
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

            const copySalaryDetails = (id) => {
                const row = tableData[id];
                if (!row) return;

                // 设置正在复制的 ID，触发展示隐藏的模板
                copyingId.value = id;
                saveStatus.value = 'saving';

                // 等待 Vue 渲染模板并给图片一点加载时间
                Vue.nextTick(() => {
                    setTimeout(() => {
                        const element = document.getElementById('salary-card-content');
                        if (!element) {
                            copyingId.value = null;
                            saveStatus.value = 'error';
                            return;
                        }

                        // 使用 html2canvas 生成图片
                        html2canvas(element, {
                            backgroundColor: null,
                            scale: 2.5,
                            useCORS: true,
                            logging: false,
                            allowTaint: true,
                            letterRendering: true,
                            onclone: (clonedDoc) => {
                                // 确保克隆的文档中模板是可见的且位置正确
                                const clonedElement = clonedDoc.getElementById('salary-card-content');
                                if (clonedElement) {
                                    clonedElement.style.position = 'static';
                                    clonedElement.style.display = 'flex';
                                    clonedElement.style.width = '420px';
                                }
                            }
                        }).then(canvas => {
                        canvas.toBlob(blob => {
                            if (!blob) {
                                console.error('Canvas to Blob failed');
                                saveStatus.value = 'error';
                                copyingId.value = null;
                                return;
                            }

                            // 复制到剪贴板
                            if (navigator.clipboard && navigator.clipboard.write) {
                                const data = [new ClipboardItem({ 'image/png': blob })];
                                navigator.clipboard.write(data).then(() => {
                                    saveStatus.value = 'saved';
                                    setTimeout(() => { saveStatus.value = ''; }, 2000);
                                    copyingId.value = null;
                                }).catch(err => {
                                    console.error('Clipboard write failed:', err);
                                    saveStatus.value = 'error';
                                    copyingId.value = null;
                                    // 如果图片复制失败，回退到文本复制
                                    copyTextFallback(id);
                                });
                            } else {
                                // 不支持 ClipboardItem 的环境
                                saveStatus.value = 'error';
                                copyingId.value = null;
                                copyTextFallback(id);
                            }
                        }, 'image/png');
                    }).catch(err => {
                            console.error('html2canvas failed:', err);
                            saveStatus.value = 'error';
                            copyingId.value = null;
                        });
                    }, 300); // 给 300ms 确保渲染和图片加载
                });
            };

            const copyTextFallback = (id) => {
                const row = tableData[id];
                if (!row) return;

                const f = (val) => formatMoney(val);
                const month = currentMonth.value;
                const title = `【工资核算明细】 ${month}`;
                const teacherName = row.name;

                let details = `${title}\n老师：${teacherName}\n\n`;

                columns.forEach(col => {
                    if (!shouldShowInCard(id, col.key)) return;

                    const value = row[col.key];
                    const formula = getFormula(id, col.key);
                    
                    details += `${col.label}: ${f(value)}\n`;
                    if (formula && !row.isSummary) {
                        details += `计算公式: ${formula}\n`;
                    }
                    details += `\n`;
                });

                details += `------------------\n`;
                details += `核对无误后请回复，谢谢！`;

                fallbackCopyTextToClipboard(details);
            };

            const fallbackCopyTextToClipboard = (text) => {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    saveStatus.value = 'saved';
                    setTimeout(() => { saveStatus.value = ''; }, 2000);
                } catch (err) {
                    console.error('Fallback: Oops, unable to copy', err);
                }
                document.body.removeChild(textArea);
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
                copySalaryDetails,
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
                copyingId,
                teacherImages,
                shouldShowInCard,
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

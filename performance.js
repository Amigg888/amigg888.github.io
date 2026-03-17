console.log('Performance script loading...');
const initApp = () => {
    console.log('Performance initApp starting...');
    if (typeof Vue === 'undefined') {
        console.error('Vue is not loaded!');
        return;
    }
    const { createApp, ref, reactive, computed, watch, onMounted } = Vue;

createApp({
    setup() {
        const teachers = ref(['小花老师', '桃子老师', '柚子老师', '小草老师']);
        const teacherName = ref('小花老师');

        const normalizeTeacherName = (name) => {
            if (!name) return '未知老师';
            if (name === '许鹤丽') return '桃子老师';
            if (name === '许俊梅') return '小花老师';
            return name;
        };

        // RBAC logic
        onMounted(() => {
            const user = JSON.parse(localStorage.getItem('user'));
            if (user && user.role === 'teacher') {
                teachers.value = [user.name];
                teacherName.value = user.name;
            }
        });
        const currentMonth = ref(localStorage.getItem('selected_month') || '2026-01');
        const showDatePicker = ref(false);
        const pickerTempYear = ref(currentMonth.value.split('-')[0]);

        const selectMonth = (year, month) => {
            currentMonth.value = `${year}-${String(month).padStart(2, '0')}`;
            showDatePicker.value = false;
        };

        const saveStatus = ref(''); // 'saving', 'saved', 'error'
        const isMobileMenuOpen = ref(false);
        
        // History Management
        const showHistory = ref(false);
        const historyRecords = ref([]);
        const historyNote = ref('');
        const currentVersionId = ref(null);

        const currentDimId = ref('renewal');
        // 教学老师维度状态
        const teacherCollapsedRules = reactive({
            renewal: false, attendance: false, conversion: false, followup: false, punctuality: false, promotion: false, bonus: false
        });
        const teacherErrors = reactive({
            renewal: {}, attendance: {}, conversion: {}, followup: {}, punctuality: {}, promotion: {}, bonus: {}
        });
        const teacherCalculationSteps = reactive({
            renewal: [], attendance: [], conversion: [], followup: [], punctuality: [], promotion: [], bonus: []
        });

        // 小草老师（运营）维度状态
        const operationCollapsedRules = reactive({
            invite: false, conversion: false, video: false, promotion: false, live: false, punctuality: false, bonus: false
        });
        const operationErrors = reactive({
            invite: {}, conversion: {}, video: {}, promotion: {}, live: {}, punctuality: {}, bonus: {}
        });
        const operationCalculationSteps = reactive({
            invite: [], conversion: [], video: [], promotion: [], live: [], punctuality: [], bonus: []
        });

        // 根据老师类型获取对应状态
        const collapsedRules = computed(() => {
            return teacherName.value === '小草老师' ? operationCollapsedRules : teacherCollapsedRules;
        });
        const errors = computed(() => {
            return teacherName.value === '小草老师' ? operationErrors : teacherErrors;
        });
        const calculationSteps = computed(() => {
            return teacherName.value === '小草老师' ? operationCalculationSteps : teacherCalculationSteps;
        });

        // 切换老师时重置或加载数据
        const loadTeacherData = (name) => {
            const saved = localStorage.getItem(`eval_${name}_${currentMonth.value}`);
            const isXiaoCao = name === '小草老师';
            const currentDimData = isXiaoCao ? operationDimData : teacherDimData;
            const currentScores = isXiaoCao ? operationScores : teacherScores;
            const currentDimensions = isXiaoCao ? operationDimensions : teacherDimensions;
            
            // 默认重置
            Object.keys(currentDimData).forEach(id => {
                Object.keys(currentDimData[id]).forEach(key => currentDimData[id][key] = 0);
                currentScores[id] = 0;
            });

            if (saved) {
                const data = JSON.parse(saved);
                Object.keys(data.dimData).forEach(id => {
                    if (currentDimData[id]) {
                        Object.assign(currentDimData[id], data.dimData[id]);
                    }
                });
            } else {
                // 如果没有保存的数据，则尝试从全局数据中同步
                syncFromGlobalData(name, currentMonth.value);
            }
            
            // 重新触发所有维度的计算
            currentDimensions.forEach(dim => validateAndCalculate(dim.id));
        };

        // 从全局数据同步核心指标
        const syncFromGlobalData = (name, month) => {
            const year = month.split('-')[0];
            const consumptionData = year === '2026' ? (window.consumptionData2026 || []) : (window.consumptionData2025 || []);
            const experienceData = year === '2026' ? (window.experienceDetails2026 || []) : (window.experienceDetails2025 || []);
            const enrollmentData = year === '2026' ? (window.enrollmentDetails2026 || []) : (window.enrollmentDetails2025 || []);
            const attendanceData = year === '2026' ? (window.attendanceData2026 || []) : (window.attendanceData2025 || []);
            
            const isXiaoCao = name === '小草老师';
            const currentDimData = isXiaoCao ? operationDimData : teacherDimData;

            if (isXiaoCao) {
                // 小草老师：同步运营相关数据
                
                // 1. 同步考勤数据（打卡维度）
                const teacherAttendance = attendanceData.filter(d => normalizeTeacherName(d.姓名) === name && d.月份 === month);
                if (teacherAttendance.length > 0) {
                    const totalLateWithin30 = teacherAttendance.reduce((sum, r) => sum + (r.迟到30分钟内次数 || 0), 0);
                    const totalLateOver30 = teacherAttendance.reduce((sum, r) => sum + (r.迟到超30分钟次数 || 0), 0);
                    const totalEarlyLeave = teacherAttendance.reduce((sum, r) => sum + (r.早退次数 || 0), 0);
                    const totalAbsentDays = teacherAttendance.reduce((sum, r) => sum + (r.旷工天数 || 0), 0);
                    
                    currentDimData.punctuality.lateCount = totalLateWithin30;
                    currentDimData.punctuality.seriousLateCount = totalLateOver30;
                    currentDimData.punctuality.earlyLeaveCount = totalEarlyLeave;
                    currentDimData.punctuality.absentDays = totalAbsentDays;
                }

                // 2. 同步整体体验课数据（所有体验课，非个人）
                const monthExperiences = experienceData.filter(d => 
                    d.体验课时间 && d.体验课时间.startsWith(month)
                );
                if (monthExperiences.length > 0) {
                    currentDimData.conversion.trialStudents = monthExperiences.length;
                    currentDimData.conversion.enrolledStudents = monthExperiences.filter(d => d.状态 === '已报课').length;
                }

                // 3. 同步转介绍数据
                const referralRecords = enrollmentData.filter(d => 
                    normalizeTeacherName(d.业绩归属人) === name && 
                    d.报课时间 && d.报课时间.startsWith(month) &&
                    d.报课属性 && d.报课属性.includes('转介绍')
                );
                if (referralRecords.length > 0) {
                    currentDimData.bonus.referrals = referralRecords.length;
                }
            } else {
                // 教学老师：同步教学相关数据
                
                // 1. 同步出勤数据（课时维度）
                const teacherRecords = consumptionData.filter(d => normalizeTeacherName(d.姓名) === name && d.月份 === month);
                if (teacherRecords.length > 0) {
                    const totalActual = teacherRecords.reduce((sum, r) => sum + (r.出勤人次 || 0), 0);
                    const totalAbsent = teacherRecords.reduce((sum, r) => sum + (r.缺勤人次 || 0), 0);
                    const totalLeave = teacherRecords.reduce((sum, r) => sum + (r.请假人次 || 0), 0);
                    
                    currentDimData.attendance.actualClasses = totalActual;
                    currentDimData.attendance.dueClasses = totalActual + totalAbsent + totalLeave;
                }

                // 2. 同步考勤数据（打卡维度）
                const teacherAttendance = attendanceData.filter(d => normalizeTeacherName(d.姓名) === name && d.月份 === month);
                if (teacherAttendance.length > 0) {
                    const totalLateWithin30 = teacherAttendance.reduce((sum, r) => sum + (r.迟到30分钟内次数 || 0), 0);
                    const totalLateOver30 = teacherAttendance.reduce((sum, r) => sum + (r.迟到超30分钟次数 || 0), 0);
                    const totalEarlyLeave = teacherAttendance.reduce((sum, r) => sum + (r.早退次数 || 0), 0);
                    const totalAbsentDays = teacherAttendance.reduce((sum, r) => sum + (r.旷工天数 || 0), 0);
                    
                    currentDimData.punctuality.lateCount = totalLateWithin30;
                    currentDimData.punctuality.seriousLateCount = totalLateOver30;
                    currentDimData.punctuality.earlyLeaveCount = totalEarlyLeave;
                    currentDimData.punctuality.absentDays = totalAbsentDays;
                }

                // 3. 同步体验课转化数据（个人上课）
                const teacherExperiences = experienceData.filter(d => 
                    normalizeTeacherName(d.体验课老师) === name && 
                    d.体验课时间 && d.体验课时间.startsWith(month)
                );
                if (teacherExperiences.length > 0) {
                    currentDimData.conversion.trialStudents = teacherExperiences.length;
                    currentDimData.conversion.enrolledStudents = teacherExperiences.filter(d => d.状态 === '已报课').length;
                }

                // 4. 同步续费数据
                const renewalRecords = enrollmentData.filter(d => 
                    normalizeTeacherName(d.业绩归属人) === name && 
                    d.报课时间 && d.报课时间.startsWith(month) &&
                    d.报课属性 && d.报课属性.includes('续费')
                );
                if (renewalRecords.length > 0) {
                    currentDimData.renewal.paidStudents = renewalRecords.length;
                    if (currentDimData.renewal.dueStudents === 0) {
                        currentDimData.renewal.dueStudents = renewalRecords.length;
                    }
                }

                // 5. 同步加分项 - 转介绍
                const referralRecords = enrollmentData.filter(d => 
                    normalizeTeacherName(d.业绩归属人) === name && 
                    d.报课时间 && d.报课时间.startsWith(month) &&
                    d.报课属性 && d.报课属性.includes('转介绍')
                );
                if (referralRecords.length > 0) {
                    currentDimData.bonus.referrals = referralRecords.length;
                }
            }
        };

        // 监听老师和月份变化并存储到本地，以便跨页面同步
        watch([teacherName, currentMonth], ([newName, newMonth]) => {
            if (newMonth) localStorage.setItem('selected_month', newMonth);
            currentVersionId.value = null; // 重置当前版本ID
            loadTeacherData(newName);
            loadHistoryRecords();
        });

        // History Methods
        const loadHistoryRecords = () => {
            const saved = localStorage.getItem(`history_eval_${teacherName.value}_${currentMonth.value}`);
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
                data: {
                    dimData: JSON.parse(JSON.stringify(dimData)),
                    scores: JSON.parse(JSON.stringify(scores))
                }
            };

            if (isReplace && currentVersionId.value) {
                const index = historyRecords.value.findIndex(r => r.id === currentVersionId.value);
                if (index !== -1) {
                    historyRecords.value[index] = newRecord;
                }
            } else {
                historyRecords.value.unshift(newRecord);
            }

            localStorage.setItem(`history_eval_${teacherName.value}_${currentMonth.value}`, JSON.stringify(historyRecords.value));
            historyNote.value = '';
            if (!isReplace) currentVersionId.value = newRecord.id;
            
            // 使用状态提示代替弹窗
            saveStatus.value = 'saved';
            setTimeout(() => { saveStatus.value = ''; }, 2000);
        };

        const loadVersion = (record) => {
            // 加载数据
            const isXiaoCao = teacherName.value === '小草老师';
            const currentDimData = isXiaoCao ? operationDimData : teacherDimData;
            const currentDimensions = isXiaoCao ? operationDimensions : teacherDimensions;
            
            Object.keys(record.data.dimData).forEach(id => {
                if (currentDimData[id]) {
                    Object.assign(currentDimData[id], record.data.dimData[id]);
                }
            });
            
            currentVersionId.value = record.id;
            // 重新触发所有维度的计算
            currentDimensions.forEach(dim => validateAndCalculate(dim.id));
            
            showHistory.value = false;
            // 无感加载，仅通过状态提示
            saveStatus.value = 'saved';
            setTimeout(() => { saveStatus.value = ''; }, 2000);
        };

        const deleteVersion = (id) => {
            historyRecords.value = historyRecords.value.filter(r => r.id !== id);
            localStorage.setItem(`history_eval_${teacherName.value}_${currentMonth.value}`, JSON.stringify(historyRecords.value));
            if (currentVersionId.value === id) currentVersionId.value = null;
            // 无感提示
            saveStatus.value = 'saved';
            setTimeout(() => { saveStatus.value = ''; }, 2000);
        };

        // 教学老师绩效维度
        const teacherDimensions = [
            { id: 'renewal', name: '学员续费率', weight: 30, status: 'pending', rules: `学员续费率得分\n基础分：30分\n核心规则：\n应续费人数 0人 (无续费任务)：保底分 10分；\n应续费人数 1人 (<3人)：未续费 8分，全额续费 18分；\n应续费人数 2人 (<3人)：未续费 6分，部分续费 (1人) 15分，全额续费 24分；\n应续费人数 >=3人 (正常规模)：\n>=100% 续费率：30分 [基础满分]；\n85%-99% 续费率：30分 [基础满分]；\n70%-84% 续费率：22分；\n50%-69% 续费率：15分；\n<50% 续费率：0分。\n超额加分：应续费人数 >=3人且续费率 >=100%时，加5分 (上限)。合计满分 35分。` },
            { id: 'attendance', name: '学员出勤率', weight: 25, status: 'pending', rules: `学员出勤率得分\n基础分：25分\n核心规则：\n>=95% 出勤率 (达成目标)：25分 [满分]；\n75%-94% 出勤率 (含75%, 不含95%)：按实际出勤率线性计分，每 1% 得 1.25分 (得分 = (实际出勤率 - 75%) * 100 * 1.25)；\n<75% 出勤率：0分。\n补充说明：无超额加分，合计满分 25分 (目标出勤率 95%，75%-95% 区间按每 1% 线性计分)。` },
            { id: 'conversion', name: '体验课转化率', weight: 20, status: 'pending', rules: `体验课报转化率得分\n基础分：20分\n核心规则：\n体验课人数 = 0：保底得 5分；\n体验课人数 <3人：转化率 >60% 得 20分 [基础满分]，转化率处于 40%-59% 之间得 12分，转化率处于 20%-39% 之间得 6分，转化率 <20% 得 0分；\n体验课人数 >=3人：转化率 >60% 得 25分 (基础分 20分 + 加分项 5分，满分)，转化率处于 40%-59% 之间得 20分，转化率处于 20%-39% 之间得 10分，转化率 <20% 得 0分。\n补充说明：5分为额外加分项，仅体验课人数 >=3人且转化率 >60% 时可获得，合计满分 25分 (核心目标转化率 >60%，按体验课人数及转化率阶梯计分)。` },
            { id: 'followup', name: '学员定期沟通', weight: 10, status: 'pending', rules: `学员定期沟通得分\n基础分：10分\n核心规则：\n沟通次数 <= 9次：得 0分；\n10 <= 沟通次数 <= 14次：得 5分；\n15 <= 沟通次数 <= 19次：得 8分；\n沟通次数 >= 20次：得 10分 [满分]。\n补充说明：满分 10分，核心目标沟通次数 >=20次。无额外加分项。` },
            { id: 'punctuality', name: '考勤数据', weight: 10, status: 'pending', rules: `考勤得分\n基础分：10分\n核心规则：\n全勤（0迟到、0早退、0旷工）：10分 [满分]；\n普通迟到(≤30分钟)≤3次 且 无严重迟到/早退/旷工：8分（在允许范围内）；\n普通迟到4-5次 或 早退1-2次：5分；\n严重迟到(>30分钟,每次按2次计) 或 普通迟到+早退合计>5次 或 旷工1天：0分；\n旷工>1天：直接判定为"需帮扶"等级。\n补充说明：每月允许3次普通迟到(≤30分钟)，不影响满分。严重迟到每次按2次计算。` },
            { id: 'promotion', name: '朋友圈宣传', weight: 5, status: 'pending', rules: `朋友圈宣传得分\n基础分：5分\n核心规则：\n基准 24条/月，完成量 >=24 条得 5分 [满分]；\n不足则按 (实际量 / 24) * 5 线性计分。\n补充说明：仅考核朋友圈，小红书不参与绩效考核。` },
            { id: 'bonus', name: '加分项', weight: 0, status: 'pending', rules: `加分项\n累计上限：15分\n核心规则：\n转介绍：每成功推荐 1名学员报名，得 1分；\n参赛获奖：按学员晋级层级计分，可赛事叠加，同赛事不同层级不重复计分 —— 校区级面级 +1分，临安区级晋级 +2分，杭州市级晋级 +3分，浙江省级晋级 +4分，国家级赛事晋级 +5分；\n视频拍摄：每完成 1条符合机构要求的宣传视频，得 1分。\n补充说明：各加分项无单独上限，加分项总分累计达 15分后，超额部分不再计入绩效考核总分。` }
        ];

        // 小草老师（教务运营）绩效维度
        const operationDimensions = [
            { id: 'invite', name: '体验课邀约', weight: 25, status: 'pending', rules: `体验课邀约得分\n基础分：25分\n核心规则：\n邀约人数 = 0：保底得 5分；\n邀约人数 1-4人：5分；\n邀约人数 5-9人：10分；\n邀约人数 10-14人：15分；\n邀约人数 15-19人：20分；\n邀约人数 20-24人：25分 [基础满分]；\n邀约人数 >=25人：30分 (基础分 25分 + 超额加分 5分，满分)。\n补充说明：基础量要求每月至少邀约10人。超额完成（>=25人）可获得额外5分加分，合计满分 30分。` },
            { id: 'conversion', name: '整体转化率', weight: 25, status: 'pending', rules: `整体转化率得分\n基础分：25分\n核心规则：\n体验人数 = 0：保底得 5分；\n体验人数 <5人：转化率 >60% 得 25分 [基础满分]，转化率处于 40%-59% 之间得 15分，转化率处于 20%-39% 之间得 8分，转化率 <20% 得 0分；\n体验人数 >=5人：转化率 >70% 得 30分 (基础分 25分 + 超额加分 5分，满分)，转化率 60-70% 得 25分，转化率处于 40%-59% 之间得 15分，转化率处于 20%-39% 之间得 8分，转化率 <20% 得 0分。\n补充说明：考核所有体验课的整体转化情况（非个人上课转化）。超额完成（转化率>70%）可获得额外5分加分，合计满分 30分。` },
            { id: 'video', name: '短视频制作', weight: 20, status: 'pending', rules: `短视频制作得分\n基础分：20分\n核心规则：\n视频数量 = 0：保底得 5分；\n视频数量 1-3条：8分；\n视频数量 4-6条：12分；\n视频数量 7-9条：16分；\n视频数量 >=10条：20分 [满分]。\n补充说明：基准为每月10条符合机构要求的宣传视频。视频需发布至抖音/视频号等平台。` },
            { id: 'promotion', name: '朋友圈宣传', weight: 10, status: 'pending', rules: `朋友圈宣传得分\n基础分：10分\n核心规则：\n发布数量 = 0：保底得 2分；\n发布数量 1-5条：4分；\n发布数量 6-11条：6分；\n发布数量 12-17条：8分；\n发布数量 18-23条：9分；\n发布数量 >=24条：10分 [满分]。\n补充说明：基准为每月24条朋友圈宣传内容。权重10%。` },
            { id: 'live', name: '直播考核', weight: 10, status: 'pending', rules: `直播考核得分\n基础分：10分\n核心规则：\n直播场次 = 0：保底得 2分；\n直播场次 1-2场：4分；\n直播场次 3-4场：6分；\n直播场次 5-6场：8分；\n直播场次 7场：9分；\n直播场次 >=8场：10分 [满分]。\n补充说明：基准为每月8场直播。直播需为有效直播（时长≥30分钟，有实质内容）。权重10%。` },
            { id: 'punctuality', name: '考勤数据', weight: 10, status: 'pending', rules: `考勤得分\n基础分：10分\n核心规则：\n全勤（0迟到、0早退、0旷工）：10分 [满分]；\n普通迟到(≤30分钟)≤3次 且 无严重迟到/早退/旷工：8分（在允许范围内）；\n普通迟到4-5次 或 早退1-2次：5分；\n严重迟到(>30分钟,每次按2次计) 或 普通迟到+早退合计>5次 或 旷工1天：0分；\n旷工>1天：直接判定为"需帮扶"等级。\n补充说明：每月允许3次普通迟到(≤30分钟)，不影响满分。严重迟到每次按2次计算。` },
            { id: 'bonus', name: '加分项', weight: 0, status: 'pending', rules: `加分项（额外加分，不计入权重）\n累计上限：15分\n核心规则：\n1. 转介绍：每成功推荐1名学员报名，得1分；\n2. 爆款短视频：单条播放量≥1000，得2分/条；\n3. 新渠道开拓：每成功开拓1个有效渠道（带来≥3个体验学员），得3分。\n补充说明：各加分项无单独上限，加分项总分累计达15分后，超额部分不再计入绩效考核总分。` }
        ];

        // 根据老师类型获取对应维度
        const dimensions = computed(() => {
            if (teacherName.value === '小草老师') {
                return operationDimensions;
            }
            return teacherDimensions;
        });

        // 统一绩效等级标准（按分数划分，所有老师通用）
        const performanceStandards = [
            { level: '标杆', score: '≥120分', coefficient: '2.0', description: '表现卓越，超额完成目标' },
            { level: '卓越', score: '100-119分', coefficient: '1.7', description: '表现优秀，达到预期目标' },
            { level: '优秀', score: '80-99分', coefficient: '1.4', description: '表现良好，基本完成目标' },
            { level: '良好', score: '60-79分', coefficient: '1.0', description: '表现一般，需要继续努力' },
            { level: '待改进', score: '40-59分', coefficient: '0.8', description: '表现欠佳，需要改进提升' },
            { level: '需帮扶', score: '<40分或旷工>1天', coefficient: '0.6', description: '表现不足，需要重点帮扶' }
        ];

        // 教学老师数据模型
        const teacherDimData = reactive({
            renewal: { dueStudents: 0, paidStudents: 0 },
            attendance: { dueClasses: 0, actualClasses: 0 },
            conversion: { trialStudents: 0, enrolledStudents: 0 },
            followup: { count: 0 },
            punctuality: { lateCount: 0, seriousLateCount: 0, earlyLeaveCount: 0, absentDays: 0 },
            promotion: { q15Count: 0 },
            bonus: { referrals: 0, competitionLevel: 0, videos: 0 }
        });

        // 小草老师（运营）数据模型
        const operationDimData = reactive({
            invite: { inviteCount: 0 },
            conversion: { trialStudents: 0, enrolledStudents: 0 },
            video: { videoCount: 0 },
            promotion: { q15Count: 0 },
            live: { liveCount: 0 },
            punctuality: { lateCount: 0, seriousLateCount: 0, earlyLeaveCount: 0, absentDays: 0 },
            bonus: { referrals: 0, viralVideos: 0, newChannels: 0 }
        });

        // 根据老师类型获取对应数据模型
        const dimData = computed(() => {
            if (teacherName.value === '小草老师') {
                return operationDimData;
            }
            return teacherDimData;
        });

        // 教学老师分数
        const teacherScores = reactive({
            renewal: 0,
            attendance: 0,
            conversion: 0,
            followup: 0,
            punctuality: 0,
            promotion: 0,
            bonus: 0
        });

        // 小草老师（运营）分数
        const operationScores = reactive({
            invite: 0,
            conversion: 0,
            video: 0,
            promotion: 0,
            live: 0,
            punctuality: 0,
            bonus: 0
        });

        // 根据老师类型获取对应分数
        const scores = computed(() => {
            if (teacherName.value === '小草老师') {
                return operationScores;
            }
            return teacherScores;
        });

        // 教学老师字段映射
        const teacherFieldsMap = {
            renewal: [
                { key: 'dueStudents', label: '应续费人数', suffix: '人' },
                { key: 'paidStudents', label: '实际续费人数', suffix: '人' }
            ],
            attendance: [
                { key: 'dueClasses', label: '应到课时', suffix: '课时' },
                { key: 'actualClasses', label: '实到课时', suffix: '课时' }
            ],
            conversion: [
                { key: 'trialStudents', label: '体验人数', suffix: '人' },
                { key: 'enrolledStudents', label: '报名人数', suffix: '人' }
            ],
            followup: [
                { key: 'count', label: '沟通次数', suffix: '次' }
            ],
            punctuality: [
                { key: 'lateCount', label: '迟到次数(≤30分钟)', suffix: '次', placeholder: '每月允许3次，得8分' },
                { key: 'seriousLateCount', label: '严重迟到次数(>30分钟)', suffix: '次', placeholder: '每次按2次计算' },
                { key: 'earlyLeaveCount', label: '早退次数', suffix: '次' },
                { key: 'absentDays', label: '旷工天数', suffix: '天' }
            ],
            promotion: [
                { key: 'q15Count', label: '朋友圈数量', suffix: '条' }
            ],
            bonus: [
                { key: 'referrals', label: '转介绍人数', suffix: '人' },
                { key: 'competitionLevel', label: '参赛获奖总得分', suffix: '分', placeholder: '校+1, 区+2, 市+3, 省+4, 国+5' },
                { key: 'videos', label: '宣传视频拍摄', suffix: '条' }
            ]
        };

        // 小草老师（运营）字段映射
        const operationFieldsMap = {
            invite: [
                { key: 'inviteCount', label: '邀约到店人数', suffix: '人', placeholder: '基础量要求≥10人/月' }
            ],
            conversion: [
                { key: 'trialStudents', label: '总体验人数', suffix: '人' },
                { key: 'enrolledStudents', label: '总报名人数', suffix: '人' }
            ],
            video: [
                { key: 'videoCount', label: '短视频发布数量', suffix: '条', placeholder: '基准10条/月' }
            ],
            promotion: [
                { key: 'q15Count', label: '朋友圈发布数量', suffix: '条', placeholder: '基准24条/月' }
            ],
            live: [
                { key: 'liveCount', label: '直播场次', suffix: '场', placeholder: '基准8场/月，每场≥30分钟' }
            ],
            punctuality: [
                { key: 'lateCount', label: '迟到次数(≤30分钟)', suffix: '次', placeholder: '每月允许3次，得8分' },
                { key: 'seriousLateCount', label: '严重迟到次数(>30分钟)', suffix: '次', placeholder: '每次按2次计算' },
                { key: 'earlyLeaveCount', label: '早退次数', suffix: '次' },
                { key: 'absentDays', label: '旷工天数', suffix: '天' }
            ],
            bonus: [
                { key: 'referrals', label: '转介绍成功人数', suffix: '人', placeholder: '1分/人' },
                { key: 'viralVideos', label: '爆款短视频数量', suffix: '条', placeholder: '播放量≥1000，2分/条' },
                { key: 'newChannels', label: '新渠道开拓数量', suffix: '个', placeholder: '带来≥3个体验学员，3分/个' }
            ]
        };

        // 根据老师类型获取对应字段映射
        const fieldsMap = computed(() => {
            if (teacherName.value === '小草老师') {
                return operationFieldsMap;
            }
            return teacherFieldsMap;
        });

        const currentDimName = computed(() => {
            if (currentDimId.value === 'summary') return '考核汇总报告';
            const currentDimensions = teacherName.value === '小草老师' ? operationDimensions : teacherDimensions;
            const dim = currentDimensions.find(d => d.id === currentDimId.value);
            return dim ? dim.name : '';
        });

        const currentDimWeight = computed(() => {
            if (currentDimId.value === 'summary') return 100;
            const currentDimensions = teacherName.value === '小草老师' ? operationDimensions : teacherDimensions;
            const dim = currentDimensions.find(d => d.id === currentDimId.value);
            return dim ? dim.weight : 0;
        });

        const currentDimRules = computed(() => {
            if (currentDimId.value === 'summary') return '';
            const currentDimensions = teacherName.value === '小草老师' ? operationDimensions : teacherDimensions;
            const dim = currentDimensions.find(d => d.id === currentDimId.value);
            return dim ? dim.rules : '';
        });

        const currentFields = computed(() => {
            const currentFieldsMap = teacherName.value === '小草老师' ? operationFieldsMap : teacherFieldsMap;
            return currentFieldsMap[currentDimId.value] || [];
        });
        const currentScore = computed(() => {
            const currentScores = teacherName.value === '小草老师' ? operationScores : teacherScores;
            return currentScores[currentDimId.value] || 0;
        });

        const validateAndCalculate = (id) => {
            if (!id || id === 'summary') return;
            const currentDimData = teacherName.value === '小草老师' ? operationDimData : teacherDimData;
            const data = currentDimData[id];
            const currentCalculationSteps = teacherName.value === '小草老师' ? operationCalculationSteps : teacherCalculationSteps;
            currentCalculationSteps[id] = [];
            
            // Basic validation
            const currentErrors = teacherName.value === '小草老师' ? operationErrors : teacherErrors;
            Object.keys(data).forEach(key => {
                if (data[key] < 0) {
                    currentErrors[id][key] = '数值不能为负数';
                } else {
                    delete currentErrors[id][key];
                }
            });

            if (Object.keys(currentErrors[id]).length > 0) return;

            let score = 0;
            const steps = currentCalculationSteps[id];
            
            if (id === 'renewal') {
                const { dueStudents, paidStudents } = data;
                if (dueStudents === 0) {
                    score = 10;
                    steps.push('应续费人数为0，获得保底分 10分');
                } else if (dueStudents === 1) {
                    score = paidStudents >= 1 ? 18 : 8;
                    steps.push(`应续费1人，实际续费${paidStudents}人，得分 ${score}分`);
                } else if (dueStudents === 2) {
                    if (paidStudents >= 2) score = 24;
                    else if (paidStudents === 1) score = 15;
                    else score = 6;
                    steps.push(`应续费2人，实际续费${paidStudents}人，得分 ${score}分`);
                } else {
                    const rate = paidStudents / dueStudents;
                    if (rate >= 1) score = 30 + (dueStudents >= 3 ? 5 : 0);
                    else if (rate >= 0.85) score = 30;
                    else if (rate >= 0.70) score = 22;
                    else if (rate >= 0.50) score = 15;
                    else score = 0;
                    steps.push(`续费率 ${(rate * 100).toFixed(1)}%，基础计分阶梯匹配得分 ${score}分`);
                    if (rate >= 1 && dueStudents >= 3) steps.push('满足"应续费>=3人且续费率100%"，获得额外加分 5分');
                }
            } else if (id === 'attendance') {
                const { dueClasses, actualClasses } = data;
                if (dueClasses > 0) {
                    const rate = actualClasses / dueClasses;
                    if (rate >= 0.95) score = 25;
                    else if (rate >= 0.75) score = (rate - 0.75) * 100 * 1.25;
                    else score = 0;
                    steps.push(`实际出勤率 ${(rate * 100).toFixed(1)}%`);
                    if (rate >= 0.95) steps.push('出勤率 >= 95%，获得满分 25分');
                    else if (rate >= 0.75) steps.push(`计算过程：(${ (rate * 100).toFixed(1) }% - 75%) * 1.25 = ${score.toFixed(1)}分`);
                    else steps.push('出勤率 < 75%，得分 0分');
                }
            } else if (id === 'conversion') {
                const { trialStudents, enrolledStudents } = data;
                const rate = trialStudents > 0 ? enrolledStudents / trialStudents : 0;
                const isXiaoCao = teacherName.value === '小草老师';
                
                if (trialStudents === 0) {
                    score = 5;
                    steps.push('体验人数为0，获得保底分 5分');
                } else if (isXiaoCao) {
                    // 小草老师：整体转化率（基础量要求>=5人）
                    if (trialStudents < 5) {
                        if (rate > 0.6) score = 25;
                        else if (rate >= 0.4) score = 15;
                        else if (rate >= 0.2) score = 8;
                        else score = 0;
                        steps.push(`体验人数 < 5，转化率 ${(rate * 100).toFixed(1)}%，得分 ${score}分`);
                    } else {
                        if (rate > 0.7) {
                            score = 30;
                            steps.push(`体验人数 >= 5，转化率 ${(rate * 100).toFixed(1)}%，得分 ${score}分`);
                            steps.push('转化率 > 70%，超额完成，包含 5分额外加分');
                        } else if (rate >= 0.6) {
                            score = 25;
                            steps.push(`体验人数 >= 5，转化率 ${(rate * 100).toFixed(1)}%，得分 ${score}分 [基础满分]`);
                        } else if (rate >= 0.4) {
                            score = 15;
                            steps.push(`体验人数 >= 5，转化率 ${(rate * 100).toFixed(1)}%，得分 ${score}分`);
                        } else if (rate >= 0.2) {
                            score = 8;
                            steps.push(`体验人数 >= 5，转化率 ${(rate * 100).toFixed(1)}%，得分 ${score}分`);
                        } else {
                            score = 0;
                            steps.push(`体验人数 >= 5，转化率 ${(rate * 100).toFixed(1)}%，得分 ${score}分`);
                        }
                    }
                } else {
                    // 教学老师：个人转化率
                    if (trialStudents < 3) {
                        if (rate > 0.6) score = 20;
                        else if (rate >= 0.4) score = 12;
                        else if (rate >= 0.2) score = 6;
                        else score = 0;
                        steps.push(`体验人数 < 3，转化率 ${(rate * 100).toFixed(1)}%，得分 ${score}分`);
                    } else {
                        if (rate > 0.6) score = 25;
                        else if (rate >= 0.4) score = 20;
                        else if (rate >= 0.2) score = 10;
                        else score = 0;
                        steps.push(`体验人数 >= 3，转化率 ${(rate * 100).toFixed(1)}%，得分 ${score}分`);
                        if (rate > 0.6) steps.push('转化率 > 60%，包含 5分额外加分');
                    }
                }
            } else if (id === 'followup') {
                const { count } = data;
                const isXiaoCao = teacherName.value === '小草老师';
                
                if (isXiaoCao) {
                    // 小草老师：学员定期沟通（满分10分，>=20次满分）
                    if (count <= 9) score = 0;
                    else if (count <= 14) score = 5;
                    else if (count <= 19) score = 8;
                    else score = 10;
                    steps.push(`沟通次数 ${count}次`);
                    if (count <= 9) steps.push('沟通次数 <= 9，得分 0分');
                    else if (count <= 14) steps.push('沟通次数 10-14次，得分 5分');
                    else if (count <= 19) steps.push('沟通次数 15-19次，得分 8分');
                    else steps.push('沟通次数 >= 20，获得满分 10分');
                } else {
                    // 教学老师：学员定期沟通（满分10分，>=20次满分）
                    if (count <= 9) score = 0;
                    else if (count <= 14) score = 5;
                    else if (count <= 19) score = 8;
                    else score = 10;
                    steps.push(`沟通次数 ${count}次`);
                    if (count <= 9) steps.push('沟通次数 <= 9，得分 0分');
                    else if (count <= 14) steps.push('沟通次数 10-14次，得分 5分');
                    else if (count <= 19) steps.push('沟通次数 15-19次，得分 8分');
                    else steps.push('沟通次数 >= 20，获得满分 10分');
                }
            } else if (id === 'punctuality') {
                const { lateCount, seriousLateCount, earlyLeaveCount, absentDays } = data;
                // 严重迟到(>30分钟)每次按2次计算
                const effectiveSeriousLate = (seriousLateCount || 0) * 2;
                const totalLateEarly = (lateCount || 0) + effectiveSeriousLate + (earlyLeaveCount || 0);
                
                steps.push(`普通迟到(≤30分钟): ${lateCount || 0}次`);
                steps.push(`严重迟到(>30分钟): ${seriousLateCount || 0}次 (按${effectiveSeriousLate}次计)`);
                steps.push(`早退: ${earlyLeaveCount || 0}次`);
                steps.push(`有效违规次数: ${totalLateEarly}次`);
                
                if (absentDays > 1) {
                    score = 0;
                    steps.push(`旷工 ${absentDays} 天，超过1天`);
                    steps.push('【警告】直接判定为"需帮扶"等级');
                } else if (absentDays === 1 || totalLateEarly > 5) {
                    score = 0;
                    steps.push('有效违规次数>5次或有旷工，考勤得分：0分');
                } else if (totalLateEarly >= 4 && totalLateEarly <= 5) {
                    score = 5;
                    steps.push(`有效违规次数4-5次，考勤得分：5分`);
                } else if (totalLateEarly >= 1 && totalLateEarly <= 3) {
                    score = 8;
                    steps.push(`有效违规次数1-3次（在允许范围内），考勤得分：8分`);
                } else {
                    score = 10;
                    steps.push(`全勤，考勤得分：10分（满分）`);
                }
            } else if (id === 'promotion') {
                const { q15Count } = data;
                const isXiaoCao = teacherName.value === '小草老师';
                
                if (isXiaoCao) {
                    // 小草老师：朋友圈宣传（满分10分，>=24条满分）
                    if (q15Count === 0) score = 2;
                    else if (q15Count <= 5) score = 4;
                    else if (q15Count <= 11) score = 6;
                    else if (q15Count <= 17) score = 8;
                    else if (q15Count <= 23) score = 9;
                    else score = 10;
                    steps.push(`朋友圈发布数量：${q15Count || 0} 条`);
                    if (q15Count === 0) steps.push('发布数量为0，保底得分 2分');
                    else if (q15Count <= 5) steps.push('发布数量 1-5条，得分 4分');
                    else if (q15Count <= 11) steps.push('发布数量 6-11条，得分 6分');
                    else if (q15Count <= 17) steps.push('发布数量 12-17条，得分 8分');
                    else if (q15Count <= 23) steps.push('发布数量 18-23条，得分 9分');
                    else steps.push('发布数量 >=24条，获得满分 10分');
                } else {
                    // 教学老师：朋友圈宣传（满分5分，>=24条满分）
                    score = Math.min(5, ((q15Count || 0) / 24) * 5);
                    steps.push(`朋友圈发布数量：${q15Count || 0} 条`);
                    steps.push(`计算：(${q15Count || 0}/24) * 5 = ${score.toFixed(2)}分`);
                    if (score >= 5) steps.push('达到基准24条，获得满分5分');
                }
            } else if (id === 'live') {
                // 小草老师：直播考核
                const { liveCount } = data;
                if (liveCount === 0) {
                    score = 2;
                    steps.push('直播场次为0，获得保底分 2分');
                } else if (liveCount <= 2) {
                    score = 4;
                    steps.push(`直播场次 ${liveCount}场（1-2场区间），得分 4分`);
                } else if (liveCount <= 4) {
                    score = 6;
                    steps.push(`直播场次 ${liveCount}场（3-4场区间），得分 6分`);
                } else if (liveCount <= 6) {
                    score = 8;
                    steps.push(`直播场次 ${liveCount}场（5-6场区间），得分 8分`);
                } else if (liveCount === 7) {
                    score = 9;
                    steps.push(`直播场次 ${liveCount}场（7场），得分 9分`);
                } else {
                    score = 10;
                    steps.push(`直播场次 ${liveCount}场（>=8场），获得满分 10分`);
                }
            } else if (id === 'bonus') {
                const isXiaoCao = teacherName.value === '小草老师';
                
                if (isXiaoCao) {
                    // 小草老师：运营加分项
                    const { referrals, viralVideos, newChannels } = data;
                    const referralsScore = (referrals || 0) * 1;
                    const viralScore = (viralVideos || 0) * 2;
                    const channelScore = (newChannels || 0) * 3;

                    score = Math.min(15, referralsScore + viralScore + channelScore);

                    steps.push(`转介绍：${referrals || 0}人 × 1分 = ${referralsScore}分`);
                    steps.push(`爆款短视频：${viralVideos || 0}条 × 2分 = ${viralScore}分`);
                    steps.push(`新渠道开拓：${newChannels || 0}个 × 3分 = ${channelScore}分`);
                    steps.push(`原始总计：${referralsScore + viralScore + channelScore}分`);
                    if (score >= 15) steps.push('达到满分15分');
                } else {
                    // 教学老师：加分项
                    const { referrals, competitionLevel, videos } = data;
                    score = Math.min(15, referrals * 1 + competitionLevel + videos * 1);
                    steps.push(`转介绍：${referrals} * 1 = ${referrals}分`);
                    steps.push(`参赛获奖：${competitionLevel}分`);
                    steps.push(`视频拍摄：${videos} * 1 = ${videos}分`);
                    steps.push(`原始总计：${referrals + competitionLevel + videos}分`);
                    if (referrals + competitionLevel + videos > 15) steps.push('超过上限，按15分计入');
                }
            } else if (id === 'invite') {
                // 小草老师：体验课邀约
                const { inviteCount } = data;
                if (inviteCount === 0) {
                    score = 5;
                    steps.push('邀约人数为0，获得保底分 5分');
                } else if (inviteCount <= 4) {
                    score = 5;
                    steps.push(`邀约人数 ${inviteCount}人（1-4人区间），得分 5分`);
                } else if (inviteCount <= 9) {
                    score = 10;
                    steps.push(`邀约人数 ${inviteCount}人（5-9人区间），得分 10分`);
                } else if (inviteCount <= 14) {
                    score = 15;
                    steps.push(`邀约人数 ${inviteCount}人（10-14人区间），得分 15分`);
                } else if (inviteCount <= 19) {
                    score = 20;
                    steps.push(`邀约人数 ${inviteCount}人（15-19人区间），得分 20分`);
                } else if (inviteCount <= 24) {
                    score = 25;
                    steps.push(`邀约人数 ${inviteCount}人（20-24人区间），获得基础满分 25分`);
                } else {
                    score = 30;
                    steps.push(`邀约人数 ${inviteCount}人（>=25人），超额完成，获得满分 30分（含5分额外加分）`);
                }
                if (inviteCount < 10) {
                    steps.push('【提示】基础量要求≥10人/月，当前未达标');
                }
            } else if (id === 'video') {
                // 小草老师：短视频制作
                const { videoCount } = data;
                if (videoCount === 0) {
                    score = 5;
                    steps.push('视频数量为0，获得保底分 5分');
                } else if (videoCount <= 3) {
                    score = 8;
                    steps.push(`视频数量 ${videoCount}条（1-3条区间），得分 8分`);
                } else if (videoCount <= 6) {
                    score = 12;
                    steps.push(`视频数量 ${videoCount}条（4-6条区间），得分 12分`);
                } else if (videoCount <= 9) {
                    score = 16;
                    steps.push(`视频数量 ${videoCount}条（7-9条区间），得分 16分`);
                } else {
                    score = 20;
                    steps.push(`视频数量 ${videoCount}条（>=10条），获得满分 20分`);
                }
            }

            // 根据老师类型更新对应分数
            if (teacherName.value === '小草老师') {
                operationScores[id] = score;
            } else {
                teacherScores[id] = score;
            }
            // 动态判断是否填写：只要任意一个输入项大于 0，即视为已填写
            const isFilled = Object.values(data).some(val => val > 0);
            const currentDimensions = teacherName.value === '小草老师' ? operationDimensions : teacherDimensions;
            currentDimensions.find(d => d.id === id).status = isFilled ? 'completed' : 'pending';
        };

        const totalScore = computed(() => {
            const currentDimensions = teacherName.value === '小草老师' ? operationDimensions : teacherDimensions;
            const currentScores = teacherName.value === '小草老师' ? operationScores : teacherScores;
            // 基础绩效分数（不含加分项）
            const baseScore = currentDimensions
                .filter(dim => dim.id !== 'bonus')
                .reduce((acc, dim) => acc + (currentScores[dim.id] || 0), 0);
            // 加分项（额外）
            const bonusScore = currentScores['bonus'] || 0;
            // 总分 = 基础分 + 加分项
            return baseScore + bonusScore;
        });

        // 检查是否有严重考勤问题（旷工超过1天）
        const hasSeriousPunctualityIssue = computed(() => {
            const currentDimData = teacherName.value === '小草老师' ? operationDimData : teacherDimData;
            return currentDimData.punctuality.absentDays > 1;
        });

        const performanceLevel = computed(() => {
            // 如果旷工超过1天，直接判定为"需帮扶"
            if (hasSeriousPunctualityIssue.value) return '需帮扶';
            
            const s = totalScore.value;
            
            // 统一按分数划分等级（所有老师通用）
            if (s >= 120) return '标杆';
            if (s >= 100) return '卓越';
            if (s >= 80) return '优秀';
            if (s >= 60) return '良好';
            if (s >= 40) return '待改进';
            return '需帮扶';
        });

        const performanceCoefficient = computed(() => {
            // 如果旷工超过1天，系数为0.6
            if (hasSeriousPunctualityIssue.value) return '0.6';
            
            const s = totalScore.value;
            
            // 统一按分数划分等级
            if (s >= 120) return '2.0';
            if (s >= 100) return '1.7';
            if (s >= 80) return '1.4';
            if (s >= 60) return '1.0';
            if (s >= 40) return '0.8';
            return '0.6';
        });

        const levelColor = computed(() => {
            // 如果有严重考勤问题，显示红色
            if (hasSeriousPunctualityIssue.value) return 'text-red-600';
            
            const s = totalScore.value;
            
            // 统一按分数划分等级
            if (s >= 120) return 'text-purple-600';
            if (s >= 100) return 'text-blue-600';
            if (s >= 80) return 'text-emerald-600';
            if (s >= 60) return 'text-amber-600';
            if (s >= 40) return 'text-orange-600';
            return 'text-red-600';
        });

        const saveEvaluation = (isAuto = false) => {
            saveStatus.value = 'saving';
            try {
                const data = {
                    teacherName: teacherName.value,
                    month: currentMonth.value,
                    dimData: teacherName.value === '小草老师' ? operationDimData : teacherDimData,
                    scores: teacherName.value === '小草老师' ? operationScores : teacherScores,
                    date: dayjs().format('YYYY-MM-DD HH:mm:ss')
                };
                localStorage.setItem(`eval_${teacherName.value}_${currentMonth.value}`, JSON.stringify(data));
                
                setTimeout(() => {
                    saveStatus.value = 'saved';
                    setTimeout(() => { saveStatus.value = ''; }, 2000);
                }, 500);
            } catch (e) {
                saveStatus.value = 'error';
                console.error('Save failed:', e);
            }
        };

        // 监听数据变化以实现自动保存
        watch(() => teacherName.value === '小草老师' ? operationDimData : teacherDimData, () => {
            saveEvaluation(true);
        }, { deep: true });

        const exportReport = () => {
            window.print();
        };

        const resetEvaluation = () => {
            const currentDimData = teacherName.value === '小草老师' ? operationDimData : teacherDimData;
            const currentScores = teacherName.value === '小草老师' ? operationScores : teacherScores;
            const currentDimensions = teacherName.value === '小草老师' ? operationDimensions : teacherDimensions;
            
            Object.keys(currentDimData).forEach(id => {
                Object.keys(currentDimData[id]).forEach(key => currentDimData[id][key] = 0);
                currentScores[id] = 0;
            });
            currentDimensions.forEach(d => d.status = 'pending');
            // 无感提示
            saveStatus.value = 'saved';
            setTimeout(() => { saveStatus.value = ''; }, 2000);
        };

        // Initialize
        onMounted(() => {
            showHistory.value = false;
            loadTeacherData(teacherName.value);
            loadHistoryRecords();
            
            // 初始化计算所有维度
            const initialDimensions = teacherName.value === '小草老师' ? operationDimensions : teacherDimensions;
            initialDimensions.forEach(dim => validateAndCalculate(dim.id));

            // Setup Intersection Observer for active navigation
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const id = entry.target.id.replace('dim-', '');
                        // 只有当元素占据视口上半部分时才更新
                        currentDimId.value = id;
                    }
                });
            }, {
                threshold: 0,
                rootMargin: '-100px 0px -70% 0px' // 触发区域集中在屏幕顶部附近
            });

            initialDimensions.forEach(dim => {
                const el = document.getElementById(`dim-${dim.id}`);
                if (el) observer.observe(el);
            });
            const summaryEl = document.getElementById('dim-summary');
            if (summaryEl) observer.observe(summaryEl);
        });

        const scrollTo = (id) => {
            const el = document.getElementById(`dim-${id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
                currentDimId.value = id;
            }
        };

        // Watch currentDimId to sync sidebar scroll
        watch(currentDimId, (newId) => {
            const navItem = document.getElementById(`nav-${newId}`);
            const navContainer = document.getElementById('sidebar-nav');
            if (navItem && navContainer) {
                const containerRect = navContainer.getBoundingClientRect();
                const itemRect = navItem.getBoundingClientRect();
                
                // If item is outside the container's view, scroll it in
                if (itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom) {
                    navItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        });

        return {
            teachers, teacherName, currentMonth, saveStatus, currentDimId, collapsedRules, dimensions, dimData, scores, errors,
            fieldsMap, calculationSteps, totalScore, performanceLevel,
            performanceCoefficient, levelColor, performanceStandards,
            validateAndCalculate, saveEvaluation, exportReport, resetEvaluation,
            scrollTo, isMobileMenuOpen,
            showDatePicker, pickerTempYear, selectMonth,
            // History
            showHistory, historyRecords, historyNote, currentVersionId, saveHistoryRecord, loadVersion, deleteVersion
        };
    }
}).mount('#app');
};

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

const { createApp, ref, reactive, computed, watch, onMounted } = Vue;

createApp({
    setup() {
        const teachers = ['小花老师', '桃子老师', '柚子老师'];
        const teacherName = ref('小花老师');
        const currentMonth = ref(localStorage.getItem('selected_month') || '2026-01');
        const saveStatus = ref(''); // 'saving', 'saved', 'error'
        
        // History Management
        const showHistory = ref(false);
        const historyRecords = ref([]);
        const historyNote = ref('');
        const currentVersionId = ref(null);

        const currentDimId = ref('renewal');
        const collapsedRules = reactive({
            renewal: false, attendance: false, conversion: false, followup: false, promotion: false, bonus: false
        });
        const errors = reactive({
            renewal: {}, attendance: {}, conversion: {}, followup: {}, promotion: {}, bonus: {}
        });
        const calculationSteps = reactive({
            renewal: [], attendance: [], conversion: [], followup: [], promotion: [], bonus: []
        });

        // 切换老师时重置或加载数据
        const loadTeacherData = (name) => {
            const saved = localStorage.getItem(`eval_${name}_${currentMonth.value}`);
            if (saved) {
                const data = JSON.parse(saved);
                // 深度合并或替换数据
                Object.keys(data.dimData).forEach(id => {
                    if (dimData[id]) {
                        Object.assign(dimData[id], data.dimData[id]);
                    }
                });
                // 重新触发所有维度的计算
                dimensions.forEach(dim => validateAndCalculate(dim.id));
            } else {
                // 如果没有保存的数据，则尝试从工作数据中预填（可选，此处先重置）
                Object.keys(dimData).forEach(id => {
                    Object.keys(dimData[id]).forEach(key => dimData[id][key] = 0);
                    scores[id] = 0;
                });
                dimensions.forEach(d => d.status = 'pending');
                // 也要重新计算以更新状态
                dimensions.forEach(dim => validateAndCalculate(dim.id));
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
            Object.keys(record.data.dimData).forEach(id => {
                if (dimData[id]) {
                    Object.assign(dimData[id], record.data.dimData[id]);
                }
            });
            
            currentVersionId.value = record.id;
            // 重新触发所有维度的计算
            dimensions.forEach(dim => validateAndCalculate(dim.id));
            
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

        const dimensions = [
            { id: 'renewal', name: '续费率', weight: 35, status: 'pending', rules: `续费率得分\n基础分：35分\n核心规则：\n应续费人数 0人 (无续费任务)：保底分 12分；\n应续费人数 1人 (<3人)：未续费 10分，全额续费 20分；\n应续费人数 2人 (<3人)：未续费 8分，部分续费 (1人) 18分，全额续费 28分；\n应续费人数 >=3人 (正常规模)：\n>=100% 续费率：35分 [基础满分]；\n85%-99% 续费率：35分 [基础满分]；\n70%-84% 续费率：26分；\n50%-69% 续费率：18分；\n<50% 续费率：0分。\n超额加分：应续费人数 >=3人且续费率 >=100%时，加5分 (上限)。合计满分 40分。` },
            { id: 'attendance', name: '出勤率', weight: 30, status: 'pending', rules: `出勤率得分\n基础分：30分\n核心规则：\n>=95% 出勤率 (达成目标)：30分 [满分]；\n75%-94% 出勤率 (含75%, 不含95%)：按实际出勤率线性计分，每 1% 得 1.5分 (得分 = (实际出勤率 - 75%) * 100 * 1.5)；\n<75% 出勤率：0分。\n补充说明：无超额加分，合计满分 30分 (目标出勤率 95%，75%-95% 区间按每 1% 线性计分)。` },
            { id: 'conversion', name: '体验课转化率', weight: 15, status: 'pending', rules: `体验课报转化率得分\n基础分：15分\n核心规则：\n体验课人数 = 0：保底得 5分；\n体验课人数 <3人：转化率 >70% 得 15分 [基础满分]，转化率处于 50%-69% 之间得 10分，转化率处于 30%-49% 之间得 5分，转化率 <30% 得 0分；\n体验课人数 >=3人：转化率 >70% 得 20分 (基础分 15分 + 加分项 5分，满分)，转化率处于 50%-69% 之间得 15分，转化率处于 30%-49% 之间得 8分，转化率 <30% 得 0分。\n补充说明：5分为额外加分项，仅体验课人数 >3人且转化率 >=70% 时可获得，合计满分 20分 (核心目标转化率 >=70%，按体验课人数及转化率阶梯计分)。` },
            { id: 'followup', name: '回访数', weight: 10, status: 'pending', rules: `回访数得分\n基础分：10分\n核心规则：\n回访数 <= 9次：得 0分；\n10 <= 回访数 <= 19次：得分 = 回访数 * 0.5；\n20 < 回访数 <= 24次：得分 = 10 + (回访数 - 20)；\n回访数 >= 25次：得 15分 (基础分 10分 + 加分项 5分，满分)。\n补充说明：满分 15分，其中 5分为加分项，核心目标回访数 >=25次。按照访次数阶梯精确计分。10-19次区间得分按 0.5 倍系数核算，无额外超额加分。` },
            { id: 'promotion', name: '宣传数量', weight: 10, status: 'pending', rules: `宣传数量得分\n基础分：10分\n核心规则：\n宣传任务分两类，得分相加为总分，每类最高 5分，按完成比例线性计分，超量不加分。\n第一类任务：基准 24条，完成量 >=24 条得 5分，不足则按 (实际量 / 24) * 5 计分；\n第二类任务：基准 16条，完成量 >=16 条得 5分，不足则按 (实际量 / 16) * 5 计分。\n补充说明：合计满分 10分，按实际完成比例精确计分，无超额加分。` },
            { id: 'bonus', name: '加分项', weight: 0, status: 'pending', rules: `加分项\n累计上限：15分\n核心规则：\n转介绍：每成功推荐 1名学员报名，得 1分，无单项目加分上限；\n参赛获奖：按学员晋级层级计分，可赛事叠加，同赛事不同层级不重复计分 —— 校区级面级 +1分，临安区级晋级 +2分，杭州市级晋级 +3分，浙江省级晋级 +4分，国家级赛事晋级 +5分；\n视频拍摄：每完成 1条符合机构要求的宣传视频，得 1分，无单项目加分上限。\n补充说明：本加分项为独立激励分值，不占用出勤率、转化率等基础考核分值，三项加分累计达 15分后，超额部分不再计入绩效考核总分。` }
        ];

        const performanceStandards = [
            { level: '标杆', score: '120分及以上', coefficient: '2.0' },
            { level: '卓越', score: '100 - 119分', coefficient: '1.7' },
            { level: '优秀', score: '80 - 99分', coefficient: '1.4' },
            { level: '良好', score: '60 - 79分', coefficient: '1.0' },
            { level: '待改进', score: '40 - 59分', coefficient: '0.8' },
            { level: '需帮扶', score: '40分以下', coefficient: '0.6' }
        ];

        const dimData = reactive({
            renewal: { dueStudents: 0, paidStudents: 0 },
            attendance: { dueClasses: 0, actualClasses: 0 },
            conversion: { trialStudents: 0, enrolledStudents: 0 },
            followup: { count: 0 },
            promotion: { q15Count: 0, r15Count: 0 },
            bonus: { referrals: 0, competitionLevel: 0, videos: 0 }
        });

        const scores = reactive({
            renewal: 0,
            attendance: 0,
            conversion: 0,
            followup: 0,
            promotion: 0,
            bonus: 0
        });

        const fieldsMap = {
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
                { key: 'count', label: '回访总数', suffix: '次' }
            ],
            promotion: [
            { key: 'q15Count', label: '朋友圈数量', suffix: '条' },
            { key: 'r15Count', label: '小红书数量', suffix: '条' }
        ],
            bonus: [
                { key: 'referrals', label: '转介绍人数', suffix: '人' },
                { key: 'competitionLevel', label: '参赛获奖总得分', suffix: '分', placeholder: '校+1, 区+2, 市+3, 省+4, 国+5' },
                { key: 'videos', label: '宣传视频拍摄', suffix: '条' }
            ]
        };

        const currentDimName = computed(() => {
            if (currentDimId.value === 'summary') return '考核汇总报告';
            return dimensions.find(d => d.id === currentDimId.value).name;
        });

        const currentDimWeight = computed(() => {
            if (currentDimId.value === 'summary') return 100;
            return dimensions.find(d => d.id === currentDimId.value).weight;
        });

        const currentDimRules = computed(() => {
            if (currentDimId.value === 'summary') return '';
            return dimensions.find(d => d.id === currentDimId.value).rules;
        });

        const currentFields = computed(() => fieldsMap[currentDimId.value] || []);
        const currentScore = computed(() => scores[currentDimId.value] || 0);

        const validateAndCalculate = (id) => {
            if (!id || id === 'summary') return;
            const data = dimData[id];
            calculationSteps[id] = [];
            
            // Basic validation
            Object.keys(data).forEach(key => {
                if (data[key] < 0) {
                    errors[id][key] = '数值不能为负数';
                } else {
                    delete errors[id][key];
                }
            });

            if (Object.keys(errors[id]).length > 0) return;

            let score = 0;
            if (id === 'renewal') {
                const { dueStudents, paidStudents } = data;
                if (dueStudents === 0) {
                    score = 12;
                    calculationSteps[id].push('应续费人数为0，获得保底分 12分');
                } else if (dueStudents === 1) {
                    score = paidStudents >= 1 ? 20 : 10;
                    calculationSteps[id].push(`应续费1人，实际续费${paidStudents}人，得分 ${score}分`);
                } else if (dueStudents === 2) {
                    if (paidStudents >= 2) score = 28;
                    else if (paidStudents === 1) score = 18;
                    else score = 8;
                    calculationSteps[id].push(`应续费2人，实际续费${paidStudents}人，得分 ${score}分`);
                } else {
                    const rate = paidStudents / dueStudents;
                    if (rate >= 1) score = 35 + (dueStudents >= 3 ? 5 : 0);
                    else if (rate >= 0.85) score = 35;
                    else if (rate >= 0.70) score = 26;
                    else if (rate >= 0.50) score = 18;
                    else score = 0;
                    calculationSteps[id].push(`续费率 ${(rate * 100).toFixed(1)}%，基础计分阶梯匹配得分 ${score}分`);
                    if (rate >= 1 && dueStudents >= 3) calculationSteps[id].push('满足“应续费>=3人且续费率100%”，获得额外加分 5分');
                }
            } else if (id === 'attendance') {
                const { dueClasses, actualClasses } = data;
                if (dueClasses > 0) {
                    const rate = actualClasses / dueClasses;
                    if (rate >= 0.95) score = 30;
                    else if (rate >= 0.75) score = (rate - 0.75) * 100 * 1.5;
                    else score = 0;
                    calculationSteps[id].push(`实际出勤率 ${(rate * 100).toFixed(1)}%`);
                    if (rate >= 0.95) calculationSteps[id].push('出勤率 >= 95%，获得满分 30分');
                    else if (rate >= 0.75) calculationSteps[id].push(`计算过程：(${ (rate * 100).toFixed(1) }% - 75%) * 1.5 = ${score.toFixed(1)}分`);
                    else calculationSteps[id].push('出勤率 < 75%，得分 0分');
                }
            } else if (id === 'conversion') {
                const { trialStudents, enrolledStudents } = data;
                const rate = trialStudents > 0 ? enrolledStudents / trialStudents : 0;
                if (trialStudents === 0) {
                    score = 5;
                    calculationSteps[id].push('体验人数为0，获得保底分 5分');
                } else if (trialStudents < 3) {
                    if (rate > 0.7) score = 15;
                    else if (rate >= 0.5) score = 10;
                    else if (rate >= 0.3) score = 5;
                    else score = 0;
                    calculationSteps[id].push(`体验人数 < 3，转化率 ${(rate * 100).toFixed(1)}%，得分 ${score}分`);
                } else {
                    if (rate > 0.7) score = 20;
                    else if (rate >= 0.5) score = 15;
                    else if (rate >= 0.3) score = 8;
                    else score = 0;
                    calculationSteps[id].push(`体验人数 >= 3，转化率 ${(rate * 100).toFixed(1)}%，得分 ${score}分`);
                    if (rate > 0.7) calculationSteps[id].push('转化率 > 70%，包含 5分额外加分');
                }
            } else if (id === 'followup') {
                const { count } = data;
                if (count <= 9) score = 0;
                else if (count <= 19) score = count * 0.5;
                else if (count <= 24) score = 10 + (count - 20);
                else score = 15;
                calculationSteps[id].push(`回访次数 ${count}次`);
                if (count <= 9) calculationSteps[id].push('回访数 <= 9，得分 0分');
                else if (count <= 19) calculationSteps[id].push(`10-19次区间：${count} * 0.5 = ${score}分`);
                else if (count <= 24) calculationSteps[id].push(`20-24次区间：10 + (${count} - 20) = ${score}分`);
                else calculationSteps[id].push('回访数 >= 25，获得满分 15分 (含5分加分)');
            } else if (id === 'promotion') {
                const { q15Count, r15Count } = data;
                const s1 = Math.min(5, (q15Count / 24) * 5);
                const s2 = Math.min(5, (r15Count / 16) * 5);
                score = s1 + s2;
                calculationSteps[id].push(`朋友圈完成度：(${q15Count}/24) * 5 = ${s1.toFixed(2)}分`);
                calculationSteps[id].push(`小红书完成度：(${r15Count}/16) * 5 = ${s2.toFixed(2)}分`);
                calculationSteps[id].push(`总分：${s1.toFixed(2)} + ${s2.toFixed(2)} = ${score.toFixed(2)}分`);
            } else if (id === 'bonus') {
                const { referrals, competitionLevel, videos } = data;
                score = Math.min(15, referrals * 1 + competitionLevel + videos * 1);
                calculationSteps[id].push(`转介绍：${referrals} * 1 = ${referrals}分`);
                calculationSteps[id].push(`参赛获奖：${competitionLevel}分`);
                calculationSteps[id].push(`视频拍摄：${videos} * 1 = ${videos}分`);
                calculationSteps[id].push(`原始总计：${referrals + competitionLevel + videos}分`);
                if (referrals + competitionLevel + videos > 15) calculationSteps[id].push('超过上限，按15分计入');
            }

            scores[id] = score;
            // 动态判断是否填写：只要任意一个输入项大于 0，即视为已填写
            const isFilled = Object.values(data).some(val => val > 0);
            dimensions.find(d => d.id === id).status = isFilled ? 'completed' : 'pending';
        };

        const totalScore = computed(() => {
            return dimensions.reduce((acc, dim) => {
                return acc + (scores[dim.id] || 0);
            }, 0);
        });

        const performanceLevel = computed(() => {
            const s = totalScore.value;
            if (s >= 120) return '标杆';
            if (s >= 100) return '卓越';
            if (s >= 80) return '优秀';
            if (s >= 60) return '良好';
            if (s >= 40) return '待改进';
            return '需帮扶';
        });

        const performanceCoefficient = computed(() => {
            const s = totalScore.value;
            if (s >= 120) return '2.0';
            if (s >= 100) return '1.7';
            if (s >= 80) return '1.4';
            if (s >= 60) return '1.0';
            if (s >= 40) return '0.8';
            return '0.6';
        });

        const levelColor = computed(() => {
            const s = totalScore.value;
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
                    dimData: dimData,
                    scores: scores,
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
        watch(dimData, () => {
            saveEvaluation(true);
        }, { deep: true });

        const exportReport = () => {
            window.print();
        };

        const resetEvaluation = () => {
            Object.keys(dimData).forEach(id => {
                Object.keys(dimData[id]).forEach(key => dimData[id][key] = 0);
                scores[id] = 0;
            });
            dimensions.forEach(d => d.status = 'pending');
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
            dimensions.forEach(dim => validateAndCalculate(dim.id));

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

            dimensions.forEach(dim => {
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
            scrollTo,
            // History
            showHistory, historyRecords, historyNote, saveHistoryRecord, loadVersion, deleteVersion
        };
    }
}).mount('#app');

const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

createApp({
    setup() {
        const currentTime = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'));
        const lastUpdateTime = ref(window.ONLINE_SYNC_TIME || dayjs().format('YYYY/MM/DD HH:mm'));
        const timeRange = ref('year'); // 'year', 'quarter', 'month'
        const selectedYear = ref('2026');
        const selectedQuarterValue = ref('2026-1');
        const selectedMonthValue = ref('2026-01');
        const isSyncing = ref(false);

        const effectiveYear = computed(() => {
            if (timeRange.value === 'year') return selectedYear.value;
            if (timeRange.value === 'quarter') return selectedQuarterValue.value.split('-')[0];
            if (timeRange.value === 'month') return selectedMonthValue.value.split('-')[0];
            return selectedYear.value;
        });

        const selectedQuarter = computed(() => {
            if (!selectedQuarterValue.value) return '';
            const parts = selectedQuarterValue.value.split('-');
            if (parts.length < 2 || parts[1] === 'all') return '';
            return parts[1];
        });

        const selectedMonth = computed(() => {
            if (!selectedMonthValue.value) return '';
            const parts = selectedMonthValue.value.split('-');
            if (parts.length < 2 || parts[1] === 'all') return '';
            return parts[1];
        });

        const showDatePicker = ref(false);
        const pickerTempYear = ref(effectiveYear.value || '2026');

        const selectYear = (year) => {
            timeRange.value = 'year';
            selectedYear.value = year;
            showDatePicker.value = false;
        };

        const selectMonth = (year, month) => {
            timeRange.value = 'month';
            selectedMonthValue.value = `${year}-${String(month).padStart(2, '0')}`;
            showDatePicker.value = false;
        };

        const selectQuarter = (year, quarter) => {
            timeRange.value = 'quarter';
            selectedQuarterValue.value = `${year}-${quarter}`;
            showDatePicker.value = false;
        };

        // --- 学生数据处理逻辑 ---
        const rawStudentData = ref([]);
        
        const loadStudentData = async () => {
            try {
                // 加载本地处理好的学员数据
                const response = await fetch('student_data.json');
                if (response.ok) {
                    rawStudentData.value = await response.json();
                    console.log('成功加载学员数据:', rawStudentData.value.length, '人');
                } else {
                    console.warn('未找到 student_data.json，使用预设空数据');
                }
            } catch (e) {
                console.error('加载学员数据失败:', e);
            }
        };
        
        // 计算年龄
        const calculateAge = (birthday) => {
            if (!birthday) return '未知';
            const birth = dayjs(birthday);
            if (!birth.isValid()) return '未知';
            return dayjs().diff(birth, 'year');
        };

        // 处理剩余课时（直接使用原始数据，不再按周递减）
        const processedStudents = computed(() => {
            return rawStudentData.value.map(s => {
                // 提取剩余课时数字
                let remaining = 0;
                if (s.总剩余课时) {
                    const match = String(s.总剩余课时).match(/(\d+\.?\d*)/);
                    if (match) remaining = parseFloat(match[1]);
                }
                
                return {
                    ...s,
                    name: s.姓名,
                    age: calculateAge(s.生日),
                    gender: s.性别,
                    teacher: s.班级老师,
                    totalLessons: s.总购买课时,
                    remainingLessons: remaining.toFixed(1)
                };
            });
        });

        // 预警学员列表 (课时最少的5位学员，排除沉睡学员)
        const warningStudents = computed(() => {
            const sleepingStudents = ['章博涛', '郑欣泽', '赵泽峰', '章泽熠', '刘锦诺', '徐子宸', '黄晨轩', '陆盛轩', '郑佳乐'];
            console.log('正在过滤学员，沉睡名单:', sleepingStudents);
            
            const filtered = processedStudents.value.filter(s => {
                const isSleeping = sleepingStudents.some(name => 
                    s.name && (s.name.includes(name) || name.includes(s.name))
                );
                return !isSleeping;
            });
            
            console.log('过滤后学员数量:', filtered.length);
            
            return filtered
                .slice()
                .sort((a, b) => parseFloat(a.remainingLessons) - parseFloat(b.remainingLessons))
                .slice(0, 5);
        });

        // --- 结束学生数据处理 ---

        // Update clock every second
        onMounted(() => {
            setInterval(() => {
                currentTime.value = dayjs().format('YYYY-MM-DD HH:mm:ss');
            }, 1000);
            
            // 加载学员数据
            loadStudentData();
            
            // Initial data update
            updateDashboardData();

            // Ensure DOM is ready and layout is calculated
            nextTick(() => {
                setTimeout(() => {
                    initCharts();
                }, 100);
            });

            window.addEventListener('resize', () => {
                charts.forEach(chart => chart.resize());
            });
        });

        // Watchers for filter changes
        watch([timeRange, selectedYear, selectedQuarterValue, selectedMonthValue], () => {
            updateDashboardData();
        });

        // Reset sub-filters when timeRange changes
        watch(timeRange, (newRange) => {
            const currentYear = effectiveYear.value;
            if (newRange === 'year') {
                selectedYear.value = currentYear;
            } else if (newRange === 'quarter') {
                selectedQuarterValue.value = `${currentYear}-1`;
            } else if (newRange === 'month') {
                selectedMonthValue.value = `${currentYear}-01`;
            }
        });

        // Data Source
        const rawEnrollmentData2025 = window.enrollmentDetails2025 || [];
        const rawExperienceData2025 = window.experienceDetails2025 || [];
        const rawConsumptionData2025 = (window.consumptionData2025 || []).filter(i => i.姓名 !== '汇总');

        const rawEnrollmentData2026 = window.enrollmentDetails2026 || [];
        const rawExperienceData2026 = window.experienceDetails2026 || [];
        const rawConsumptionData2026 = (window.consumptionData2026 || []).filter(i => i.姓名 !== '汇总');

        // Reactive Data
        const enrollmentData = ref([]);
        const experienceData = ref([]);
        const consumptionData = ref([]);

        // Real Campus Stats
        const realCampusStats = {
            '昌化校区': { 
                active: 65, 
                history: 52,
                teachers: {
                    active: [
                        { name: '琪琪老师', count: 6 }, 
                        { name: '小花老师', count: 14 },
                        { name: '小龙老师', count: 15 },
                        { name: '大龙老师', count: 30 }
                    ]
                }
            },
            '河桥校区': { 
                active: 55, 
                history: 48,
                teachers: {
                    active: [
                        { name: '桃子老师', count: 12 }, 
                        { name: '橘子老师', count: 18 },
                        { name: '苹果老师', count: 25 }
                    ]
                }
            }
        };

        const normalizeTeacherName = (name) => {
            if (!name) return '未知老师';
            if (name === '许鹤丽') return '桃子老师';
            if (name === '许俊梅') return '小花老师';
            return name;
        };

        const updateDashboardData = () => {
            const year = effectiveYear.value;
            const range = timeRange.value;
            const currentMonthPart = selectedMonth.value;
            const currentQuarter = selectedQuarter.value;

            // 根据年份选择数据源
            const rawEnrollmentData = year === '2026' ? rawEnrollmentData2026 : rawEnrollmentData2025;
            const rawExperienceData = year === '2026' ? rawExperienceData2026 : rawExperienceData2025;
            const rawConsumptionData = year === '2026' ? rawConsumptionData2026 : rawConsumptionData2025;

            const filterByTime = (data, dateField) => {
                return data.filter(item => {
                    const dateStr = item[dateField];
                    if (!dateStr) return false;
                    
                    const itemDate = dayjs(dateStr);
                    if (itemDate.format('YYYY') !== year) return false;

                    if (range === 'month') {
                        if (!currentMonthPart) return true;
                        return itemDate.format('MM') === currentMonthPart;
                    } else if (range === 'quarter') {
                        if (!currentQuarter) return true;
                        const itemQuarter = Math.floor(itemDate.month() / 3) + 1;
                        return itemQuarter === parseInt(currentQuarter);
                    }
                    return true;
                });
            };

            enrollmentData.value = filterByTime(rawEnrollmentData, '报课时间').sort((a, b) => dayjs(b.报课时间).unix() - dayjs(a.报课时间).unix());
            experienceData.value = filterByTime(rawExperienceData, '体验课时间');
            
            consumptionData.value = rawConsumptionData.filter(item => {
                const monthStr = item['月份'];
                if (!monthStr) return false;
                
                const itemDate = dayjs(monthStr + "-01");
                if (itemDate.format('YYYY') !== year) return false;

                if (range === 'month') {
                    if (!currentMonthPart) return true;
                    return itemDate.format('MM') === currentMonthPart;
                } else if (range === 'quarter') {
                    if (!currentQuarter) return true;
                    const itemQuarter = Math.floor(itemDate.month() / 3) + 1;
                    return itemQuarter === parseInt(currentQuarter);
                }
                return true;
            });

            initCharts();
        };

        // KPIs Calculation
        const MONTHLY_REVENUE_TARGET = 100000;
        const MONTHLY_CONSUMPTION_TARGET = 80000;

        const kpis = reactive({
            active_students: computed(() => processedStudents.value.length || 125),
            new_enrollments: computed(() => enrollmentData.value.filter(i => i.报课属性 === '新报').length),
            total_history: computed(() => {
                return Object.values(realCampusStats).reduce((sum, c) => sum + (c.history || 0), 0);
            }),
            leads_count: computed(() => {
                const baseLeads = 206;
                const newLeadsSince2026 = rawExperienceData2026.length;
                return baseLeads + newLeadsSince2026;
            }),
            new_leads: computed(() => experienceData.value.length),
            new_conversion: computed(() => {
                return experienceData.value.filter(i => i.状态 === '已报课').length;
            }),
            lead_to_exp_rate: computed(() => {
                const newLeads = experienceData.value.length; 
                const newEnrolled = experienceData.value.filter(i => i.状态 === '已报课').length; 
                return newLeads > 0 ? ((newEnrolled / newLeads) * 100).toFixed(2) : "0.00";
            }),
            exp_invited: computed(() => experienceData.value.length),
            exp_attended: computed(() => experienceData.value.filter(i => i.状态 === '已体验' || i.状态 === '已报课').length),
            exp_enrolled: computed(() => experienceData.value.filter(i => i.状态 === '已报课').length),
            total_revenue: computed(() => enrollmentData.value.reduce((sum, i) => sum + (Number(i.归属业绩金额) || 0), 0)),
            revenue_target: computed(() => {
                if (timeRange.value === 'year') return MONTHLY_REVENUE_TARGET * 12;
                if (timeRange.value === 'quarter') return MONTHLY_REVENUE_TARGET * 3;
                return MONTHLY_REVENUE_TARGET;
            }),
            consumption_target: computed(() => {
                if (timeRange.value === 'year') return MONTHLY_CONSUMPTION_TARGET * 12;
                if (timeRange.value === 'quarter') return MONTHLY_CONSUMPTION_TARGET * 3;
                return MONTHLY_CONSUMPTION_TARGET;
            }),
            revenue_mom: computed(() => {
                return 15; // Placeholder
            }),
            revenue_yoy: computed(() => {
                return 25; // Placeholder
            }),
            order_count: computed(() => enrollmentData.value.length),
            total_consumption_count: computed(() => consumptionData.value.reduce((sum, i) => sum + (Number(i.出勤人次) || 0), 0)),
            total_consumption_amount: computed(() => consumptionData.value.reduce((sum, i) => sum + (Number(i.消课金额) || 0), 0))
        });

        const latestEnrollmentMsgs = computed(() => {
            return enrollmentData.value.slice(0, 10).map(item => {
                const teacher = item.业绩归属人 || '未知老师';
                return `热烈祝贺 ${item.学员姓名} 同学成功报课 ${item.实收金额}元 (业绩归属: ${teacher})`;
            });
        });

        const formatNumber = (num) => {
            if (!num && num !== 0) return '0';
            return Math.floor(num).toLocaleString();
        };

        const teacherRevenueRankings = computed(() => {
            const map = {};
            enrollmentData.value.forEach(item => {
                const teacher = normalizeTeacherName(item.业绩归属人);
                map[teacher] = (map[teacher] || 0) + (Number(item.归属业绩金额) || 0);
            });
            return Object.entries(map)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
        });

        const teacherConsumptionRankings = computed(() => {
            const map = {};
            consumptionData.value.forEach(item => {
                const teacher = normalizeTeacherName(item.姓名 || item.教师);
                if (!map[teacher]) map[teacher] = { count: 0, amount: 0 };
                map[teacher].count += (Number(item.出勤人次) || 0);
                map[teacher].amount += (Number(item.消课金额) || 0);
            });
            return Object.entries(map)
                .map(([name, data]) => ({ name, count: data.count, amount: data.amount }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
        });

        const charts = [];
        const initCharts = () => {
            // Dispose existing charts
            charts.forEach(c => {
                try { c.dispose(); } catch(e) {}
            });
            charts.length = 0;

            const initChartIfExist = (id) => {
                const el = document.getElementById(id);
                if (el) {
                    const chart = echarts.init(el);
                    charts.push(chart);
                    return chart;
                }
                return null;
            };

            // Global Chart Theme Configuration
            const chartTheme = {
                color: ['#00d2ff', '#00ffc6', '#6366f1', '#ec4899', '#f59e0b'],
                textStyle: { fontFamily: 'Inter, PingFang SC, sans-serif' },
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderColor: 'rgba(0, 210, 255, 0.3)',
                    borderWidth: 1,
                    textStyle: { color: '#f8fafc', fontSize: 12 },
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.5)',
                    padding: [8, 12],
                    borderRadius: 6,
                    backdropFilter: 'blur(4px)',
                    confine: true
                }
            };

            const revenueTrendChart = initChartIfExist('revenueTrendChart');
            const enrollmentRatioChart = initChartIfExist('enrollmentRatioChart');
            const activeStudentChart = initChartIfExist('activeStudentChart');
            const leadsChart = initChartIfExist('leadsChart');
            const consumptionChart = initChartIfExist('consumptionChart');

            // --- 1. Revenue Trend Chart (Professional Line) ---
            if (revenueTrendChart) {
                const year = effectiveYear.value;
                const range = timeRange.value;
                let xAxisLabels = [];
                let dateFilterPrefixes = [];
                const currentQuarter = selectedQuarter.value;

                if (range === 'year') {
                    xAxisLabels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
                    dateFilterPrefixes = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
                } else if (range === 'quarter' && currentQuarter) {
                    const months = [(currentQuarter - 1) * 3 + 1, (currentQuarter - 1) * 3 + 2, (currentQuarter - 1) * 3 + 3];
                    xAxisLabels = months.map(m => `${m}月`);
                    dateFilterPrefixes = months.map(m => `${year}-${String(m).padStart(2, '0')}`);
                } else if (range === 'month') {
                    const daysInMonth = dayjs(selectedMonthValue.value).daysInMonth();
                    xAxisLabels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}日`);
                    dateFilterPrefixes = Array.from({ length: daysInMonth }, (_, i) => `${selectedMonthValue.value}-${String(i + 1).padStart(2, '0')}`);
                }

                const revenueDataPoints = dateFilterPrefixes.map(prefix => {
                    const rawData = year === '2026' ? rawEnrollmentData2026 : rawEnrollmentData2025;
                    return rawData
                        .filter(item => item.报课时间 && item.报课时间.startsWith(prefix))
                        .reduce((sum, item) => sum + (Number(item.归属业绩金额) || 0), 0);
                });

                // 计算累计实际和累计目标
                let cumulativeSum = 0;
                const cumulativeActualPoints = revenueDataPoints.map(v => {
                    cumulativeSum += v;
                    return cumulativeSum;
                });

                const totalPeriodTarget = range === 'year' ? MONTHLY_REVENUE_TARGET * 12 : 
                                        range === 'quarter' ? MONTHLY_REVENUE_TARGET * 3 : 
                                        MONTHLY_REVENUE_TARGET;
                
                const cumulativeTargetPoints = dateFilterPrefixes.map((_, index) => {
                    return Math.round((totalPeriodTarget / dateFilterPrefixes.length) * (index + 1));
                });

                revenueTrendChart.setOption({
                    ...chartTheme,
                    tooltip: {
                        ...chartTheme.tooltip,
                        trigger: 'axis',
                        formatter: (params) => {
                            let res = `<div class="font-bold mb-2 text-white border-b border-white/10 pb-1">${params[0].name}</div>`;
                            params.forEach(p => {
                                const val = typeof p.value === 'number' ? p.value.toLocaleString() : p.value;
                                let icon = p.marker;
                                let label = p.seriesName;
                                res += `<div class="flex justify-between gap-8 mb-1">
                                            <span class="text-slate-400 flex items-center gap-1">${icon}${label}:</span>
                                            <span class="text-white font-mono">¥${val}</span>
                                        </div>`;
                            });
                            
                            // 计算进度百分比
                            const actual = cumulativeActualPoints[params[0].dataIndex];
                            const target = cumulativeTargetPoints[params[0].dataIndex];
                            const percent = ((actual / target) * 100).toFixed(2);
                            const colorClass = actual >= target ? 'text-emerald-400' : 'text-orange-400';
                            
                            res += `<div class="mt-2 pt-2 border-t border-white/10 flex justify-between gap-8">
                                        <span class="text-slate-400">总体进度:</span>
                                        <span class="${colorClass} font-mono font-bold">${percent}%</span>
                                    </div>`;
                            return res;
                        }
                    },
                    legend: {
                        show: true,
                        top: 5,
                        right: 20,
                        textStyle: { color: '#94a3b8', fontSize: 10 },
                        itemWidth: 12,
                        itemHeight: 4,
                        itemGap: 15
                    },
                    animationDuration: 2000,
                    grid: { top: 50, left: 45, right: 45, bottom: 35 },
                    xAxis: { 
                        type: 'category', 
                        data: xAxisLabels, 
                        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, 
                        axisLabel: { color: '#64748b', fontSize: 10, margin: 15 },
                        axisTick: { show: false }
                    },
                    yAxis: [
                        { 
                            type: 'value', 
                            name: '单期业绩',
                            nameTextStyle: { color: '#64748b', fontSize: 10, padding: [0, 0, 0, -30] },
                            axisLine: { show: false }, 
                            axisLabel: { color: '#64748b', fontSize: 10, formatter: (v) => v >= 1000 ? (v/1000).toFixed(0) + 'k' : v }, 
                            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)', type: 'dashed' } } 
                        },
                        { 
                            type: 'value', 
                            name: '累计进度',
                            nameTextStyle: { color: '#64748b', fontSize: 10, padding: [0, -30, 0, 0] },
                            axisLine: { show: false }, 
                            axisLabel: { color: '#64748b', fontSize: 10, formatter: (v) => v >= 1000 ? (v/1000).toFixed(0) + 'k' : v }, 
                            splitLine: { show: false } 
                        }
                    ],
                    series: [
                        {
                            name: '实际业绩',
                            data: revenueDataPoints,
                            type: 'bar',
                            barWidth: '25%',
                            itemStyle: {
                                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                    { offset: 0, color: '#00d2ff' },
                                    { offset: 1, color: 'rgba(0, 210, 255, 0.1)' }
                                ]),
                                borderRadius: [4, 4, 0, 0]
                            },
                            emphasis: {
                                itemStyle: {
                                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                        { offset: 0, color: '#00fbff' },
                                        { offset: 1, color: 'rgba(0, 210, 255, 0.3)' }
                                    ])
                                }
                            }
                        },
                        {
                            name: '累计实际',
                            data: cumulativeActualPoints,
                            type: 'line',
                            yAxisIndex: 1,
                            smooth: true,
                            symbol: 'circle',
                            symbolSize: 8,
                            showSymbol: false,
                            itemStyle: { color: '#34d399', borderWidth: 2, borderColor: '#0f172a' },
                            lineStyle: { width: 3, shadowBlur: 15, shadowColor: 'rgba(52, 211, 153, 0.4)' },
                            emphasis: { showSymbol: true }
                        },
                        {
                            name: '累计目标',
                            data: cumulativeTargetPoints,
                            type: 'line',
                            yAxisIndex: 1,
                            smooth: true,
                            symbol: 'none',
                            lineStyle: { width: 2, type: 'dashed', color: 'rgba(239, 68, 68, 0.3)' }
                        }
                    ]
                });
            }

            // --- 2. Active Student Chart (Modern Sparkline) ---
            if (activeStudentChart) {
                const year = effectiveYear.value;
                const range = timeRange.value;
                let xAxisLabels = [];
                let dateFilterPrefixes = [];

                if (range === 'year') {
                    xAxisLabels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
                    dateFilterPrefixes = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
                } else if (range === 'quarter') {
                    const q = parseInt(selectedQuarter.value);
                    const months = [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3];
                    xAxisLabels = months.map(m => `${m}月`);
                    dateFilterPrefixes = months.map(m => `${year}-${String(m).padStart(2, '0')}`);
                } else if (range === 'month') {
                    const daysInMonth = dayjs(selectedMonthValue.value).daysInMonth();
                    xAxisLabels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}日`);
                    dateFilterPrefixes = Array.from({ length: daysInMonth }, (_, i) => `${selectedMonthValue.value}-${String(i + 1).padStart(2, '0')}`);
                }

                let baseCount = 120;
                let cumulativeNew = 0;
                const activeTrendData = dateFilterPrefixes.map(prefix => {
                    const rawData = year === '2026' ? rawEnrollmentData2026 : rawEnrollmentData2025;
                    const monthlyNew = rawData.filter(item => item.报课时间 && item.报课时间.startsWith(prefix) && item.报课属性 === '新报').length;
                    cumulativeNew += monthlyNew;
                    return baseCount + cumulativeNew;
                });

                activeStudentChart.setOption({
                    ...chartTheme,
                    grid: { top: 10, bottom: 5, left: 10, right: 10 },
                    xAxis: { type: 'category', data: xAxisLabels, show: false },
                    yAxis: { show: false, min: 'dataMin' },
                    series: [{
                        data: activeTrendData,
                        type: 'line',
                        smooth: 0.5,
                        symbol: 'none',
                        emphasis: { disabled: true },
                        lineStyle: { 
                            width: 3, 
                            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                                { offset: 0, color: '#6366f1' },
                                { offset: 0.5, color: '#00d2ff' },
                                { offset: 1, color: '#34d399' }
                            ]),
                            shadowBlur: 15,
                            shadowColor: 'rgba(99, 102, 241, 0.4)'
                        },
                        areaStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: 'rgba(99, 102, 241, 0.15)' },
                                { offset: 1, color: 'rgba(99, 102, 241, 0)' }
                            ])
                        }
                    }]
                });
            }

            // --- 3. Enrollment Ratio Chart (Enhanced Donut) ---
            if (enrollmentRatioChart) {
                const getEnrollmentPieData = () => {
                    const map = { '新签': 0, '续报': 0, '转介绍': 0 };
                    enrollmentData.value.forEach(item => {
                        const attr = item.报课属性 || '';
                        if (attr.includes('新报') || attr.includes('新签')) map['新签'] += (Number(item.归属业绩金额) || 0);
                        else if (attr.includes('续报') || attr.includes('续费')) map['续报'] += (Number(item.归属业绩金额) || 0);
                        else if (attr.includes('转介绍')) map['转介绍'] += (Number(item.归属业绩金额) || 0);
                    });
                    
                    const data = Object.entries(map).map(([name, value]) => ({ name, value }));
                    if (data.every(d => d.value === 0)) {
                        return [{ value: 1, name: '暂无数据', itemStyle: { color: 'rgba(255,255,255,0.05)' } }];
                    }
                    const colors = { 
                        '新签': new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#8b5cf6' }]),
                        '续报': new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#06b6d4' }, { offset: 1, color: '#0891b2' }]),
                        '转介绍': new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#ec4899' }, { offset: 1, color: '#d946ef' }])
                    };
                    return data.filter(d => d.value > 0).map(d => ({ ...d, itemStyle: { color: colors[d.name] } }));
                };

                enrollmentRatioChart.setOption({
                    ...chartTheme,
                    tooltip: { 
                        ...chartTheme.tooltip,
                        trigger: 'item', 
                        formatter: (params) => {
                            if (params.name === '暂无数据') {
                                return `<div class="text-slate-400">当前时间段暂无报课数据</div>`;
                            }
                            return `<div class="font-bold mb-1 text-white">${params.name}</div>
                                    <div class="flex justify-between gap-6">
                                        <span class="text-slate-400">业绩金额:</span>
                                        <span class="text-white font-mono font-bold">¥${params.value.toLocaleString()}</span>
                                    </div>
                                    <div class="flex justify-between gap-6">
                                        <span class="text-slate-400">营收占比:</span>
                                        <span class="text-cyan-400 font-mono font-bold">${params.percent}%</span>
                                    </div>`;
                        }
                    },
                    legend: { 
                        orient: 'vertical', 
                        right: '0%', 
                        top: 'center', 
                        itemWidth: 8, 
                        itemHeight: 8, 
                        textStyle: { color: '#94a3b8', fontSize: 10 }, 
                        icon: 'circle',
                        itemGap: 10
                    },
                    series: [{
                        type: 'pie',
                        radius: ['60%', '85%'],
                        center: ['35%', '50%'],
                        avoidLabelOverlap: false,
                        itemStyle: { borderRadius: 8, borderColor: '#0f172a', borderWidth: 2 },
                        label: { show: false },
                        emphasis: {
                            scale: true,
                            scaleSize: 5,
                            itemStyle: { shadowBlur: 15, shadowColor: 'rgba(0,0,0,0.5)' }
                        },
                        data: getEnrollmentPieData()
                    }]
                });
            }

            // --- 4. Leads Chart (Vibrant Sparkline) ---
            if (leadsChart) {
                const year = effectiveYear.value;
                const range = timeRange.value;
                let dateFilterPrefixes = [];

                if (range === 'year') {
                    dateFilterPrefixes = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
                } else if (range === 'quarter') {
                    const qValue = selectedQuarter.value;
                    const q = qValue ? parseInt(qValue) : 1;
                    const months = [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3];
                    dateFilterPrefixes = months.map(m => `${year}-${String(m).padStart(2, '0')}`);
                } else if (range === 'month') {
                    const daysInMonth = dayjs(selectedMonthValue.value).daysInMonth();
                    dateFilterPrefixes = Array.from({ length: daysInMonth }, (_, i) => `${selectedMonthValue.value}-${String(i + 1).padStart(2, '0')}`);
                }

                const leadsTrendData = dateFilterPrefixes.map(prefix => {
                    const rawData = year === '2026' ? rawExperienceData2026 : rawExperienceData2025;
                    return rawData.filter(item => item.体验课时间 && item.体验课时间.startsWith(prefix)).length;
                });

                leadsChart.setOption({
                    ...chartTheme,
                    grid: { top: 10, bottom: 5, left: 10, right: 10 },
                    xAxis: { type: 'category', show: false },
                    yAxis: { show: false },
                    series: [{
                        data: leadsTrendData.length > 0 ? leadsTrendData : [0],
                        type: 'line',
                        smooth: 0.5,
                        symbol: 'none',
                        emphasis: { disabled: true },
                        lineStyle: { 
                            width: 3, 
                            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                                { offset: 0, color: '#f59e0b' },
                                { offset: 0.5, color: '#ec4899' },
                                { offset: 1, color: '#8b5cf6' }
                            ]),
                            shadowBlur: 15,
                            shadowColor: 'rgba(245, 158, 11, 0.4)'
                        },
                        areaStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: 'rgba(245, 158, 11, 0.15)' },
                                { offset: 1, color: 'rgba(245, 158, 11, 0)' }
                            ])
                        }
                    }]
                });
            }

            // --- 5. Conversion Funnel Chart ---
            // ECharts conversion funnel is removed and replaced by CSS glass funnel in HTML.
            // Keeping the code commented out for reference if needed.
            /*
            if (conversionFunnel) {
                // ... original code ...
            }
            */

            // --- 6. Consumption Chart (Modern Progress Ring) ---
            if (consumptionChart) {
                const target = kpis.consumption_target;
                const progress = target > 0 ? (kpis.total_consumption_amount / target * 100) : 0;
                consumptionChart.setOption({
                    ...chartTheme,
                    tooltip: {
                        ...chartTheme.tooltip,
                        trigger: 'item',
                        formatter: (params) => {
                            const label = params.name === '已消' ? '已消耗业绩' : '剩余目标业绩';
                            const colorClass = params.name === '已消' ? 'text-cyan-400' : 'text-slate-400';
                            return `<div class="font-bold mb-1 text-white">课消进度</div>
                                    <div class="flex justify-between gap-6">
                                        <span class="text-slate-400">${label}:</span>
                                        <span class="${colorClass} font-mono font-bold">¥${params.value.toLocaleString()}</span>
                                    </div>`;
                        }
                    },
                    series: [{
                        type: 'pie',
                        radius: ['75%', '90%'],
                        center: ['50%', '50%'],
                        avoidLabelOverlap: false,
                        label: {
                            show: true,
                            position: 'center',
                            formatter: () => `{val|${progress.toFixed(2)}%}\n{label|完成率}`,
                            rich: {
                                val: { fontSize: 20, fontWeight: '800', color: '#06b6d4', padding: [0, 0, 5, 0] },
                                label: { fontSize: 10, color: '#64748b' }
                            }
                        },
                        itemStyle: { borderRadius: 10 },
                        emphasis: { scale: false },
                        data: [
                            { 
                                value: kpis.total_consumption_amount, name: '已消', 
                                itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#06b6d4' }, { offset: 1, color: '#6366f1' }]) } 
                            },
                            { 
                                value: Math.max(0, target - kpis.total_consumption_amount), name: '剩余', 
                                itemStyle: { color: 'rgba(255,255,255,0.05)' } 
                            }
                        ]
                    }]
                });
            }

            // Force resize
            setTimeout(() => {
                charts.forEach(chart => {
                    try { chart.resize(); } catch(e) {}
                });
            }, 200);
        };

        const getLineAreaOption = (xAxisData, seriesData, color) => ({
            animationDuration: 2000,
            grid: { top: 10, left: 10, right: 10, bottom: 0, containLabel: false },
            xAxis: { type: 'category', data: xAxisData, show: false },
            yAxis: { type: 'value', show: false },
            series: [{
                data: seriesData,
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 4,
                itemStyle: { color: color },
                lineStyle: { color: color, width: 2 },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: color + '44' },
                        { offset: 1, color: color + '00' }
                    ])
                }
            }]
        });

        const syncOnlineData = async () => {
            if (isSyncing.value) return;
            isSyncing.value = true;
            
            // 添加 UI 反馈提示
            const originalTitle = document.title;
            document.title = "正在同步数据...";
            
            try {
                // 使用灵活的 API 域名判断
                let apiHost = window.location.hostname;
                if (!apiHost || apiHost === '::1') apiHost = '127.0.0.1';
                
                const apiPath = `${window.location.protocol}//${apiHost}:5001/sync`;
                console.log('Attempting sync to:', apiPath);

                const response = await fetch(apiPath, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    mode: 'cors'
                });
                
                const data = await response.json();
                if (data.status === 'success') {
                    // 同步成功后先更新本地显示
                    lastUpdateTime.value = dayjs().format('HH:mm:ss');
                    alert('同步成功！页面将刷新以加载最新数据。');
                    location.reload(); 
                } else {
                    alert('同步失败: ' + (data.message || '未知错误'));
                }
            } catch (error) {
                console.error('Sync error details:', error);
                alert('连接同步服务器失败！\n\n请检查：\n1. server.py 是否已启动\n2. 5001 端口是否被占用\n3. 浏览器是否拦截了请求');
            } finally {
                isSyncing.value = false;
                document.title = originalTitle;
            }
        };

        const teacherAttendanceRankings = computed(() => {
            const map = {};
            consumptionData.value.forEach(item => {
                const teacher = normalizeTeacherName(item.姓名 || item.教师);
                if (!map[teacher]) map[teacher] = { attended: 0, total: 0 };
                
                const attended = Number(item.出勤人次) || 0;
                const absent = Number(item.缺勤人次) || 0;
                const leave = Number(item.请假人次) || 0;
                
                map[teacher].attended += attended;
                map[teacher].total += (attended + absent + leave);
            });
            
            return Object.entries(map)
                .map(([name, data]) => ({
                    name,
                    rate: data.total > 0 ? (data.attended / data.total) * 100 : 0,
                    attended: data.attended,
                    total: data.total
                }))
                .sort((a, b) => b.rate - a.rate)
                .slice(0, 5)
                .map(item => ({
                    ...item,
                    rate: item.rate.toFixed(1)
                }));
        });

        return {
            currentTime,
            lastUpdateTime,
            timeRange,
            selectedYear,
            selectedQuarterValue,
            selectedMonthValue,
            selectedQuarter,
            selectedMonth,
            effectiveYear,
            isSyncing,
            showDatePicker,
            pickerTempYear,
            selectYear,
            selectMonth,
            selectQuarter,
            enrollmentData,
            experienceData,
            consumptionData,
            kpis,
            latestEnrollmentMsgs,
            formatNumber,
            teacherRevenueRankings,
            teacherConsumptionRankings,
            teacherAttendanceRankings,
            realCampusStats,
            syncOnlineData,
            initCharts,
            // 学生相关
            processedStudents,
            warningStudents
        };
    },
    mounted() {
        // 初始化 Lucide 图标
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}).mount('#app');

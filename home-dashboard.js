
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

        const goToTab = (tab) => {
            window.location.href = `index.html?tab=${tab}`;
        };

        // --- 学生数据处理逻辑 ---
        const rawStudentData = ref([]);
        
        // 加载学生数据
        const loadStudentData = async () => {
            // 优先从 window.studentData 加载（由 student-data.js 提供，解决 GitHub Pages 不支持 json 的问题）
            if (window.studentData && Array.isArray(window.studentData)) {
                rawStudentData.value = window.studentData;
                console.log('从全局变量加载学员数据:', rawStudentData.value.length, '人');
                return;
            }

            try {
                const response = await fetch('student_data.json');
                if (response.ok) {
                    rawStudentData.value = await response.json();
                    console.log('从 JSON 加载学员数据:', rawStudentData.value.length, '人');
                } else {
                    console.warn('未找到学员数据源 (student_data.json)');
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
                    source: s.学员来源 || '未知',
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
        const getRawEnrollmentData = (y) => {
            const yearStr = String(y || effectiveYear.value);
            return yearStr === '2026' ? (window.enrollmentDetails2026 || []) : (window.enrollmentDetails2025 || []);
        };
        const getRawExperienceData = (y) => {
            const yearStr = String(y || effectiveYear.value);
            return yearStr === '2026' ? (window.experienceDetails2026 || []) : (window.experienceDetails2025 || []);
        };
        const getRawConsumptionData = (y) => {
            const yearStr = String(y || effectiveYear.value);
            const data = yearStr === '2026' ? (window.consumptionData2026 || []) : (window.consumptionData2025 || []);
            return data.filter(i => i.姓名 !== '汇总');
        };

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
            const rawEnrollmentData = getRawEnrollmentData(year);
            const rawExperienceData = getRawExperienceData(year);
            const rawConsumptionData = getRawConsumptionData(year);

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

        // 计算体验转化的辅助函数
        const getEnrolledCountByTime = () => {
            const year = effectiveYear.value;
            const range = timeRange.value;
            const currentMonthPart = selectedMonth.value;
            const currentQuarter = selectedQuarter.value;
            const rawEnrollmentData = getRawEnrollmentData(year);
            const rawExpData = getRawExperienceData(year);
            
            const enrolledStudents = rawExpData.filter(i => i.状态 === '已报课');
            return enrolledStudents.filter(exp => {
                const enrollment = rawEnrollmentData.find(e => e.学员姓名 === exp.学员姓名);
                if (!enrollment) return false;
                const enrollDate = dayjs(enrollment.报课时间);
                if (enrollDate.format('YYYY') !== year) return false;
                if (range === 'month' && currentMonthPart) {
                    return enrollDate.format('MM') === currentMonthPart;
                }
                if (range === 'quarter' && currentQuarter) {
                    const itemQuarter = Math.floor(enrollDate.month() / 3) + 1;
                    return itemQuarter === parseInt(currentQuarter);
                }
                return true;
            }).length;
        };

        const kpis = reactive({
            active_students: computed(() => processedStudents.value.length || 125),
            new_enrollments: computed(() => enrollmentData.value.filter(i => i.报课属性 === '新报').length),
            total_history: computed(() => {
                return Object.values(realCampusStats).reduce((sum, c) => sum + (c.history || 0), 0);
            }),
            leads_count: computed(() => {
                const baseLeads = 206;
                const newLeadsSince2026 = getRawExperienceData('2026').length;
                return baseLeads + newLeadsSince2026;
            }),
            new_leads: computed(() => experienceData.value.length),
            new_conversion: computed(() => getEnrolledCountByTime()),
            lead_to_exp_rate: computed(() => {
                const newLeads = experienceData.value.length; 
                const newEnrolled = getEnrolledCountByTime();
                return newLeads > 0 ? ((newEnrolled / newLeads) * 100).toFixed(2) : "0.00";
            }),
            exp_invited: computed(() => experienceData.value.length),
            exp_attended: computed(() => experienceData.value.filter(i => i.状态 === '已体验' || i.状态 === '已报课').length),
            exp_enrolled: computed(() => getEnrolledCountByTime()),
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
                    try {
                        const chart = echarts.init(el);
                        charts.push(chart);
                        return chart;
                    } catch (e) {
                        console.error(`Failed to init chart ${id}:`, e);
                    }
                }
                return null;
            };

            // Global Chart Theme Configuration - 稳定版
            const chartTheme = {
                color: ['#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
                textStyle: { fontFamily: 'Inter, PingFang SC, sans-serif' },
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    borderWidth: 1,
                    textStyle: { color: '#f8fafc', fontSize: 12 },
                    padding: [8, 12],
                    borderRadius: 6,
                    confine: true
                }
            };

            // Initialize available charts
            const revenueTrendChart = initChartIfExist('revenueTrendChart');
            const activeStudentChart = initChartIfExist('activeStudentChart');
            const enrollmentRatioChart = initChartIfExist('enrollmentRatioChart');
            const leadsChart = initChartIfExist('leadsChart');
            const consumptionChart = initChartIfExist('consumptionChart');
            const experienceFunnelChart = initChartIfExist('experienceFunnelChart');

            console.log('[Charts] Initialized:', { 
                revenueTrendChart: !!revenueTrendChart, 
                experienceFunnelChart: !!experienceFunnelChart,
                expData: experienceData.value.length,
                kpis: { invited: kpis.exp_invited, attended: kpis.exp_attended, enrolled: kpis.exp_enrolled }
            });

            // --- 0. Experience Funnel Chart (Funnel Style) ---
            if (experienceFunnelChart) {
                try {
                    const expInvited = kpis.exp_invited || 0;
                    const expAttended = kpis.exp_attended || 0;
                    const expEnrolled = kpis.exp_enrolled || 0;
                    
                    const attendedRate = expInvited > 0 ? Math.round(expAttended / expInvited * 100) : 0;
                    const enrolledRate = expAttended > 0 ? Math.round(expEnrolled / expAttended * 100) : 0;
                    
                    experienceFunnelChart.setOption({
                        color: ['#3b82f6', '#06b6d4', '#00d4ff'],
                        tooltip: {
                            trigger: 'item',
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            borderColor: 'rgba(59, 130, 246, 0.4)',
                            textStyle: { color: '#f8fafc', fontSize: 12 },
                            formatter: function(params) {
                                return `<div style="font-weight:bold;margin-bottom:4px;color:${params.color}">${params.name}</div>
                                        <div>人数: <span style="font-weight:bold">${params.value}人</span></div>
                                        <div>转化率: <span style="color:#06b6d4;font-weight:bold">${params.data.rate}</span></div>`;
                            }
                        },
                        series: [{
                            type: 'funnel',
                            left: '10%',
                            right: '10%',
                            top: '10%',
                            bottom: '10%',
                            min: 0,
                            max: expInvited || 1,
                            minSize: '20%',
                            maxSize: '100%',
                            sort: 'descending',
                            gap: 4,
                            label: {
                                show: true,
                                position: 'inside',
                                formatter: function(params) {
                                    return `{name|${params.name}}\n{value|${params.value}人} {rate|${params.data.rate}}`;
                                },
                                rich: {
                                    name: {
                                        color: '#94a3b8',
                                        fontSize: 11,
                                        lineHeight: 16
                                    },
                                    value: {
                                        color: '#fff',
                                        fontSize: 14,
                                        fontWeight: 'bold',
                                        lineHeight: 20
                                    },
                                    rate: {
                                        color: '#06b6d4',
                                        fontSize: 13,
                                        fontWeight: 'bold',
                                        backgroundColor: 'rgba(6, 182, 212, 0.2)',
                                        padding: [2, 8],
                                        borderRadius: 10,
                                        lineHeight: 18
                                    }
                                }
                            },
                            labelLine: { show: false },
                            itemStyle: {
                                borderWidth: 0,
                                shadowBlur: 10,
                                shadowColor: 'rgba(59, 130, 246, 0.3)'
                            },
                            emphasis: {
                                label: { fontSize: 14 }
                            },
                            data: [
                                { 
                                    value: expInvited, 
                                    name: '邀约',
                                    rate: '100%',
                                    itemStyle: { color: '#3b82f6' }
                                },
                                { 
                                    value: expAttended, 
                                    name: '到访',
                                    rate: attendedRate + '%',
                                    itemStyle: { color: '#06b6d4' }
                                },
                                { 
                                    value: expEnrolled, 
                                    name: '转化',
                                    rate: enrolledRate + '%',
                                    itemStyle: { color: '#00d4ff' }
                                }
                            ]
                        }]
                    });
                } catch (e) {
                    console.error('Experience funnel chart error:', e);
                }
            }

            // --- 1. Revenue Trend Chart (Professional Line) - 升级版 ---
            if (revenueTrendChart) {
                try {
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

                    const rawData = getRawEnrollmentData(year);
                    console.log(`[RevenueTrend] Year: ${year}, Range: ${range}, Prefix Sample: ${dateFilterPrefixes[0]}, Data length: ${rawData.length}`);

                    const revenueDataPoints = dateFilterPrefixes.map(prefix => {
                        const filtered = rawData.filter(item => {
                            const date = (item.报课时间 || '').trim();
                            return date.startsWith(prefix);
                        });
                        const total = filtered.reduce((sum, item) => sum + (Number(item.归属业绩金额) || Number(item.实收金额) || 0), 0);
                        return total;
                    });

                    const isMonthView = range === 'month';
                    const seriesData = isMonthView ? revenueDataPoints : (() => {
                        let cumulativeSum = 0;
                        return revenueDataPoints.map(v => {
                            cumulativeSum += v;
                            return cumulativeSum;
                        });
                    })();

                    const totalPeriodTarget = range === 'year' ? MONTHLY_REVENUE_TARGET * 12 : 
                                            range === 'quarter' ? MONTHLY_REVENUE_TARGET * 3 : 
                                            MONTHLY_REVENUE_TARGET;
                    
                    const cumulativeTargetPoints = dateFilterPrefixes.map((_, index) => {
                        const monthTarget = totalPeriodTarget / dateFilterPrefixes.length;
                        return Math.round(monthTarget * (index + 1));
                    });

                    revenueTrendChart.setOption({
                        ...chartTheme,
                        legend: { 
                            show: true, 
                            top: 10, 
                            right: 20, 
                            textStyle: { color: '#94a3b8', fontSize: 11 },
                            icon: 'roundRect',
                            itemWidth: 14,
                            itemHeight: 4,
                            itemGap: 20,
                            data: isMonthView ? ['当日实收', '平均目标'] : ['单月业绩', '累计实收', '累计目标']
                        },
                        animationDuration: 2000,
                        grid: { top: 55, left: 50, right: 50, bottom: 40 },
                        xAxis: { 
                            type: 'category', 
                            data: xAxisLabels, 
                            axisLine: { 
                                lineStyle: { 
                                    color: 'rgba(59, 130, 246, 0.2)',
                                    width: 2
                                } 
                            }, 
                            axisLabel: { 
                                color: '#94a3b8', 
                                fontSize: 11, 
                                margin: 15,
                                interval: isMonthView ? 1 : 0 
                            },
                            axisTick: { 
                                show: true,
                                lineStyle: { color: 'rgba(59, 130, 246, 0.3)' }
                            }
                        },
                        yAxis: [
                            { 
                                type: 'value', 
                                name: isMonthView ? '当日实收' : '累计实收',
                                nameTextStyle: { color: '#64748b', fontSize: 10, align: 'right', padding: [0, 0, 10, 0] },
                                axisLabel: { color: '#94a3b8', fontSize: 10 }, 
                                splitLine: { 
                                    lineStyle: { 
                                        color: 'rgba(59, 130, 246, 0.08)', 
                                        type: 'dashed' 
                                    } 
                                }
                            },
                            {
                                type: 'value',
                                name: isMonthView ? '' : '单月实收',
                                show: !isMonthView,
                                nameTextStyle: { color: '#64748b', fontSize: 10, align: 'left', padding: [0, 0, 10, 0] },
                                axisLabel: { color: '#94a3b8', fontSize: 10 },
                                splitLine: { show: false }
                            }
                        ],
                        series: [
                            {
                                name: isMonthView ? '当日实收' : '单月业绩',
                                type: 'bar',
                                data: revenueDataPoints,
                                barWidth: '35%',
                                yAxisIndex: isMonthView ? 0 : 1,
                            itemStyle: { 
                                color: '#3b82f6',
                                borderRadius: [4, 4, 0, 0]
                            },
                                z: 1
                            },
                            {
                                name: '累计实收',
                                type: 'line', 
                                data: seriesData,
                                showSymbol: true,
                                tooltip: { show: true },
                                smooth: true,
                                symbol: 'circle',
                                symbolSize: isMonthView ? 5 : 8,
                            itemStyle: { 
                                color: '#06b6d4'
                            },
                            lineStyle: { 
                                width: 3, 
                                color: '#06b6d4'
                            },
                            areaStyle: {
                                color: 'rgba(6, 182, 212, 0.2)'
                            },
                                z: 3
                            },
                            {
                                name: isMonthView ? '平均目标' : '累计目标',
                                type: 'line',
                                data: isMonthView ? dateFilterPrefixes.map(() => Math.round(totalPeriodTarget / dateFilterPrefixes.length)) : cumulativeTargetPoints,
                                smooth: true,
                                symbol: 'none',
                                lineStyle: { 
                                    color: 'rgba(148, 163, 184, 0.4)', 
                                    width: 2, 
                                    type: 'dashed' 
                                },
                                z: 2
                            }
                        ]
                    });
                } catch (e) {
                    console.error("Error setting revenueTrendChart:", e);
                }
            }

            // --- 2. Active Student Chart (Modern Sparkline) - 升级版 ---
            if (activeStudentChart) {
                try {
                    const year = effectiveYear.value;
                    const range = timeRange.value;
                    let xAxisLabels = [];
                    let dateFilterPrefixes = [];

                    if (range === 'year') {
                        xAxisLabels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
                        dateFilterPrefixes = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
                    } else if (range === 'quarter') {
                        const qValue = selectedQuarter.value;
                        const q = qValue ? parseInt(qValue) : 1;
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
                    const rawData = getRawEnrollmentData(year);
                    
                    const activeTrendData = dateFilterPrefixes.map(prefix => {
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
                                color: '#3b82f6'
                            },
                            areaStyle: {
                                color: 'rgba(59, 130, 246, 0.2)'
                            }
                        }]
                    });
                } catch (e) {
                    console.error("Error setting activeStudentChart:", e);
                }
            }

            // --- 3. Enrollment Ratio Chart (Donut Style) ---
            if (enrollmentRatioChart) {
                try {
                    const getEnrollmentPieData = () => {
                        const map = { '新签': 0, '续报': 0, '扩科': 0, '其他': 0 };
                        enrollmentData.value.forEach(item => {
                            const attr = item.报课属性 || '';
                            if (attr.includes('新报') || attr.includes('新签')) map['新签'] += (Number(item.归属业绩金额) || 0);
                            else if (attr.includes('续报') || attr.includes('续费')) map['续报'] += (Number(item.归属业绩金额) || 0);
                            else if (attr.includes('扩科')) map['扩科'] += (Number(item.归属业绩金额) || 0);
                            else map['其他'] += (Number(item.归属业绩金额) || 0);
                        });
                        
                        const data = Object.entries(map).map(([name, value]) => ({ name, value }));
                        if (data.every(d => d.value === 0)) {
                            return [{ value: 1, name: '暂无数据', itemStyle: { color: 'rgba(255,255,255,0.05)' } }];
                        }
                        const colors = { 
                            '新签': '#3b82f6',
                            '续报': '#8b5cf6',
                            '扩科': '#f59e0b',
                            '其他': '#64748b'
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
                                    return `<div style="color:#64748b">当前时间段暂无报课数据</div>`;
                                }
                                return `<div style="font-weight:bold;margin-bottom:4px;color:${params.color}">${params.name}</div>
                                        <div>业绩金额: <span style="font-weight:bold">¥${params.value.toLocaleString()}</span></div>
                                        <div>营收占比: <span style="color:#06b6d4;font-weight:bold">${params.percent}%</span></div>`;
                            }
                        },
                        legend: { 
                            orient: 'vertical', 
                            right: '5%', 
                            top: 'center', 
                            itemWidth: 10, 
                            itemHeight: 10, 
                            textStyle: { color: '#94a3b8', fontSize: 11 }, 
                            icon: 'circle',
                            itemGap: 12
                        },
                        series: [{
                            type: 'pie',
                            radius: ['40%', '65%'],
                            center: ['35%', '50%'],
                            avoidLabelOverlap: false,
                            itemStyle: { 
                                borderRadius: 6, 
                                borderColor: '#0f172a', 
                                borderWidth: 2 
                            },
                            label: { 
                                show: true,
                                position: 'center',
                                formatter: () => `{total|¥${formatNumber(kpis.total_revenue)}\n}{label|总业绩}`,
                                rich: {
                                    total: { 
                                        fontSize: 16, 
                                        fontWeight: 700, 
                                        color: '#fff',
                                        lineHeight: 22
                                    },
                                    label: { 
                                        fontSize: 10, 
                                        color: '#64748b',
                                        lineHeight: 14
                                    }
                                }
                            },
                            emphasis: {
                                scale: true,
                                scaleSize: 5
                            },
                            data: getEnrollmentPieData()
                        }]
                    });
                } catch (e) {
                    console.error("Error setting enrollmentRatioChart:", e);
                }
            }

            // --- 4. Leads Chart (Vibrant Sparkline) - 升级版 ---
            if (leadsChart) {
                try {
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
                        const rawData = getRawExperienceData(year);
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
                                color: '#f59e0b'
                            },
                            areaStyle: {
                                color: 'rgba(245, 158, 11, 0.2)'
                            }
                        }]
                    });
                } catch (e) {
                    console.error("Error setting leadsChart:", e);
                }
            }

            // --- 5. Consumption Chart - 升级版 ---
            if (consumptionChart) {
                try {
                    const target = kpis.consumption_target;
                    const progress = target > 0 ? (kpis.total_consumption_amount / target * 100) : 0;
                    consumptionChart.setOption({
                        ...chartTheme,
                        tooltip: {
                            ...chartTheme.tooltip,
                            trigger: 'item',
                            formatter: (params) => {
                                const label = params.name === '已消' ? '已消耗金额' : '剩余目标金额';
                                const colorClass = params.name === '已消' ? 'text-cyan-400' : 'text-slate-400';
                                return `<div class="font-bold mb-2 text-white text-base">课消进度</div>
                                        <div class="flex justify-between gap-8 mb-1">
                                            <span class="text-slate-400">${label}:</span>
                                            <span class="${colorClass} font-mono font-bold">¥${params.value.toLocaleString()}</span>
                                        </div>`;
                            }
                        },
                        series: [{
                            type: 'pie',
                            radius: ['70%', '85%'],
                            center: ['50%', '50%'],
                            avoidLabelOverlap: false,
                            label: {
                                show: true,
                                position: 'center',
                                formatter: () => `{val|${progress.toFixed(1)}%}\n{label|完成率}`,
                                rich: {
                                    val: { 
                                        fontSize: 20, 
                                        fontWeight: 700, 
                                        color: '#06b6d4',
                                        padding: [0, 0, 5, 0] 
                                    },
                                    label: { fontSize: 11, color: '#64748b' }
                                }
                            },
                            itemStyle: { 
                                borderRadius: 8,
                                borderColor: '#0f172a',
                                borderWidth: 2
                            },
                            emphasis: { 
                                scale: true,
                                scaleSize: 5
                            },
                            data: [
                                { 
                                    value: kpis.total_consumption_amount, name: '已消', 
                                    itemStyle: { color: '#06b6d4' } 
                                },
                                { 
                                    value: Math.max(0, target - kpis.total_consumption_amount), name: '剩余', 
                                    itemStyle: { color: 'rgba(255,255,255,0.1)' } 
                                }
                            ]
                        }]
                    });
                } catch (e) {
                    console.error("Error setting consumptionChart:", e);
                }
            }

            // Force resize
            setTimeout(() => {
                charts.forEach(chart => {
                    try { chart.resize(); } catch(e) {}
                });
            }, 200);
        };

        // Watch for data changes and re-render charts
        watch([enrollmentData, experienceData, consumptionData], () => {
            nextTick(() => {
                initCharts();
            });
        }, { deep: true });

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
            
            const originalTitle = document.title;
            document.title = "正在同步数据...";
            
            try {
                const apiPath = 'http://127.0.0.1:3001/sync';
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
                    lastUpdateTime.value = dayjs().format('HH:mm:ss');
                    alert('同步成功！页面将刷新以加载最新数据。');
                    location.reload(); 
                } else {
                    alert('同步失败: ' + (data.message || '未知错误'));
                }
            } catch (error) {
                console.error('Sync error details:', error);
                alert('连接同步服务器失败！\n\n请检查：\n1. server.py 是否已启动（运行 python3 server.py）\n2. 3001 端口是否被占用\n3. 浏览器是否拦截了请求');
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
            goToTab,
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

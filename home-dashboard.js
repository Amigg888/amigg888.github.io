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

        const effectiveYear = computed(() => {
            if (timeRange.value === 'year') return selectedYear.value;
            if (timeRange.value === 'quarter') return selectedQuarterValue.value.split('-')[0];
            if (timeRange.value === 'month') return selectedMonthValue.value.split('-')[0];
            return selectedYear.value;
        });

        // Update clock every second
        onMounted(() => {
            setInterval(() => {
                currentTime.value = dayjs().format('YYYY-MM-DD HH:mm:ss');
            }, 1000);
            
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
            '临安校区': {
                active: 65, // 原66，琪琪老师减1
                history: 52,
                teachers: {
                    active: [
                        { name: '琪琪老师', count: 6 }, // 7 -> 6
                        { name: '小花老师', count: 14 },
                        { name: '柚子老师', count: 45 }
                    ],
                    history: [
                        { name: '柚子老师', count: 24 },
                        { name: '琪琪老师', count: 5 },
                        { name: '小花老师', count: 9 },
                        { name: '杨老师', count: 14 }
                    ]
                }
            },
            '昌化校区': {
                active: 60, // 原61，桃子老师减1
                history: 115,
                teachers: {
                    active: [
                        { name: '小花老师', count: 13 },
                        { name: '桃子老师', count: 47 } // 48 -> 47
                    ],
                    history: [
                        { name: '小花老师', count: 56 },
                        { name: '桃子老师', count: 59 }
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
        const kpis = reactive({
            active_students: computed(() => {
                // 2025年基础在读人数设为 125 (127 - 琪琪老师1 - 桃子老师1)
                const baseCount = 125;
                
                // 获取 2026 年所有的报课数据
                const data2026 = rawEnrollmentData2026;
                
                // 统计从 2026 年 1 月 1 日开始的所有报课属性为“新报”的学员数量
                const newSince2026 = data2026.filter(item => {
                    if (item.报课属性 !== '新报') return false;
                    const date = dayjs(item.报课时间);
                    // 只要是 2026 年的记录且是新报，就累加
                    return date.year() === 2026;
                }).length;

                return baseCount + newSince2026;
            }),
            new_enrollments: computed(() => enrollmentData.value.filter(i => i.报课属性 === '新报').length),
            total_history: computed(() => {
                return Object.values(realCampusStats).reduce((sum, c) => sum + (c.history || 0), 0);
            }),
            leads_count: computed(() => {
                // 2025年邀约人数基数为 206
                const baseLeads = 206;
                // 累加 2026 年 1 月 1 日之后增加的体验学员
                const newLeadsSince2026 = rawExperienceData2026.length;
                return baseLeads + newLeadsSince2026;
            }),
            new_leads: computed(() => experienceData.value.length),
            new_conversion: computed(() => {
                // 当前筛选范围内报课属性为“新报”的数量
                return enrollmentData.value.filter(i => i.报课属性 === '新报').length;
            }),
            lead_to_exp_rate: computed(() => {
                const newLeads = experienceData.value.length; // 新增意向
                const newEnrolled = enrollmentData.value.filter(i => i.报课属性 === '新报').length; // 新增转化
                return newLeads > 0 ? ((newEnrolled / newLeads) * 100).toFixed(1) : 0;
            }),
            exp_invited: computed(() => experienceData.value.length),
            exp_attended: computed(() => experienceData.value.filter(i => i.状态 === '已体验' || i.状态 === '已报课').length),
            exp_enrolled: computed(() => experienceData.value.filter(i => i.状态 === '已报课').length),
            total_revenue: computed(() => enrollmentData.value.reduce((sum, i) => sum + (Number(i.归属业绩金额) || 0), 0)),
            revenue_mom: computed(() => {
                const year = parseInt(effectiveYear.value);
                const range = timeRange.value;
                const currentMonth = selectedMonth.value;
                const currentQuarter = selectedQuarter.value;

                let prevYear = year;
                let prevMonth = '';
                let prevQuarter = '';

                if (range === 'month' && currentMonth) {
                    const m = parseInt(currentMonth);
                    if (m === 1) {
                        prevYear = year - 1;
                        prevMonth = '12';
                    } else {
                        prevMonth = String(m - 1).padStart(2, '0');
                    }
                } else if (range === 'quarter' && currentQuarter) {
                    const q = parseInt(currentQuarter);
                    if (q === 1) {
                        prevYear = year - 1;
                        prevQuarter = '4';
                    } else {
                        prevQuarter = String(q - 1);
                    }
                } else if (range === 'year') {
                    prevYear = year - 1;
                } else {
                    return 0;
                }

                const prevData = (prevYear === 2026 ? rawEnrollmentData2026 : (prevYear === 2025 ? rawEnrollmentData2025 : []));
                const currentVal = kpis.total_revenue;
                const prevVal = prevData.filter(item => {
                    const date = dayjs(item.报课时间);
                    if (date.year() !== prevYear) return false;
                    if (range === 'month') return date.format('MM') === prevMonth;
                    if (range === 'quarter') return Math.floor(date.month() / 3) + 1 === parseInt(prevQuarter);
                    return true;
                }).reduce((sum, i) => sum + (Number(i.归属业绩金额) || 0), 0);

                if (prevVal === 0) return currentVal > 0 ? 100 : 0;
                return ((currentVal - prevVal) / prevVal * 100).toFixed(1);
            }),
            revenue_yoy: computed(() => {
                const year = parseInt(effectiveYear.value);
                const range = timeRange.value;
                const currentMonth = selectedMonth.value;
                const currentQuarter = selectedQuarter.value;

                const prevYear = year - 1;
                const prevData = (prevYear === 2025 ? rawEnrollmentData2025 : []);
                
                if (prevYear < 2025) return 0;

                const currentVal = kpis.total_revenue;
                const prevVal = prevData.filter(item => {
                    const date = dayjs(item.报课时间);
                    if (date.year() !== prevYear) return false;
                    if (range === 'month' && currentMonth) return date.format('MM') === currentMonth;
                    if (range === 'quarter' && currentQuarter) return Math.floor(date.month() / 3) + 1 === parseInt(currentQuarter);
                    return true;
                }).reduce((sum, i) => sum + (Number(i.归属业绩金额) || 0), 0);

                if (prevVal === 0) return currentVal > 0 ? 100 : 0;
                return ((currentVal - prevVal) / prevVal * 100).toFixed(1);
            }),
            order_count: computed(() => enrollmentData.value.length),
            total_consumption_count: computed(() => consumptionData.value.reduce((sum, i) => sum + (Number(i.消课课时) || 0), 0)),
            total_consumption_amount: computed(() => consumptionData.value.reduce((sum, i) => sum + (Number(i.消课金额) || 0), 0)),
        });

        const latestEnrollmentMsgs = computed(() => {
            // 业绩播报始终显示最新的 5 条，不受当前筛选（年份/月份/季度）影响
            const allData = [...rawEnrollmentData2026, ...rawEnrollmentData2025];
            const sortedData = allData
                .filter(i => i.报课时间)
                .sort((a, b) => dayjs(b.报课时间).unix() - dayjs(a.报课时间).unix());
            
            if (sortedData.length === 0) return ["暂无最新动态"];
            
            return sortedData.slice(0, 5).map(latest => {
                const campus = latest.所在校区 || '';
                const teacher = normalizeTeacherName(latest.业绩归属人);
                const student = latest.学员姓名 || '未知学员';
                const type = latest.报课属性 || '';
                const hours = latest.报课课时 || 0;
                const amount = latest.归属业绩金额 || 0;
                const date = latest.报课时间 || '';
                
                return `${campus}${teacher}成功签约${student} ${type}${hours}课时${amount}元，期待更多捷报刷屏哦！${date} 🥳`;
            });
        });

        const formatNumber = (num) => {
            return new Intl.NumberFormat().format(Math.round(num));
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
                .slice(0, 6);
        });

        const teacherConsumptionRankings = computed(() => {
            const map = {};
            consumptionData.value.forEach(item => {
                const teacher = normalizeTeacherName(item.教师 || item.姓名);
                if (!map[teacher]) map[teacher] = { count: 0, amount: 0 };
                map[teacher].count += Number(item.消课课时) || 0;
                map[teacher].amount += Number(item.消课金额) || 0;
            });
            return Object.entries(map)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 6);
        });

        const charts = [];

        const initCharts = () => {
            if (typeof echarts === 'undefined') {
                console.error('ECharts is not defined. Please check if the script is loaded correctly.');
                return;
            }
            
            const range = timeRange.value;
            const year = effectiveYear.value;
            const currentQuarter = selectedQuarter.value;
            const currentMonth = selectedMonth.value;
            
            // 1. Setup dynamic labels based on range
            let xAxisLabels = [];
            let dateFilterPrefixes = [];

            try {
                if (range === 'month' && currentMonth) {
                    const daysInMonth = dayjs(`${year}-${currentMonth}-01`).daysInMonth();
                    xAxisLabels = Array.from({length: daysInMonth}, (_, i) => `${i + 1}日`);
                    const monthPrefix = `${year}-${currentMonth}`;
                    dateFilterPrefixes = xAxisLabels.map((_, i) => `${monthPrefix}-${String(i + 1).padStart(2, '0')}`);
                } else if (range === 'quarter' && currentQuarter) {
                    const months = [
                        (currentQuarter - 1) * 3 + 1,
                        (currentQuarter - 1) * 3 + 2,
                        (currentQuarter - 1) * 3 + 3
                    ];
                    xAxisLabels = months.map(m => `${m}月`);
                    dateFilterPrefixes = months.map(m => `${year}-${String(m).padStart(2, '0')}`);
                } else {
                    // Default to 12 months for year view OR when quarter/month not yet selected
                    xAxisLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
                    dateFilterPrefixes = Array.from({length: 12}, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
                }
            } catch (e) {
                console.error('Error calculating date filters:', e);
                return;
            }
            
            // Helper to safe-init chart
            const safeInit = (id, optionFn) => {
                const dom = document.getElementById(id);
                if (dom) {
                    try {
                        let chart = echarts.getInstanceByDom(dom);
                        if (!chart) {
                            chart = echarts.init(dom);
                            charts.push(chart);
                        }
                        const option = optionFn();
                        if (option) {
                            // 使用 notMerge: true 来确保配置完全替换，但保留动画过度
                            chart.setOption(option, {
                                notMerge: true,
                                lazyUpdate: false,
                                silent: false
                            });
                        }
                    } catch (e) {
                        console.error(`Error initializing chart ${id}:`, e);
                    }
                }
            };

            // 1. Active Students Line Chart
            safeInit('activeStudentChart', () => {
                let activeData;
                const baseActive = kpis.active_students;
                if (range === 'month') {
                    activeData = Array.from({length: xAxisLabels.length}, () => Math.floor(Math.random() * 20) + (baseActive - 10));
                } else if (range === 'quarter') {
                    activeData = Array.from({length: 3}, () => Math.floor(Math.random() * 30) + (baseActive - 15));
                } else {
                    activeData = [120, 132, 145, 134, 150, 158, 162, 168, 172, 175, 178, 182].map(v => Math.round(v * (baseActive/180)));
                }
                return getLineAreaOption(xAxisLabels, activeData, '#00d2ff');
            });

            // 2. Leads Line Chart
            safeInit('leadsChart', () => {
                let leadsData;
                const baseLeads = kpis.leads_count;
                if (range === 'month') {
                    leadsData = Array.from({length: xAxisLabels.length}, () => Math.floor(Math.random() * 30) + (baseLeads - 15));
                } else if (range === 'quarter') {
                    leadsData = Array.from({length: 3}, () => Math.floor(Math.random() * 50) + (baseLeads - 25));
                } else {
                    leadsData = [142, 153, 160, 153, 179, 182, 185, 181, 188, 192, 195, 198].map(v => Math.round(v * (baseLeads/200)));
                }
                return getLineAreaOption(xAxisLabels, leadsData, '#00f2fe');
            });

            // 3. Conversion Funnel
            safeInit('conversionFunnel', () => {
                const totalInvited = experienceData.value.length;
                const totalAttended = experienceData.value.filter(i => i.状态 === '已体验' || i.状态 === '已报课').length;
                const totalEnrolled = experienceData.value.filter(i => i.状态 === '已报课').length;
                
                const invitedRate = 100;
                const attendedRate = totalInvited > 0 ? Math.round((totalAttended / totalInvited) * 100) : 0;
                const enrolledRate = totalAttended > 0 ? Math.round((totalEnrolled / totalAttended) * 100) : 0;

                return {
                    animationDuration: 1200,
                    animationEasing: 'cubicInOut',
                    tooltip: { trigger: 'item', formatter: '{a} <br/>{b} : {c}%' },
                    series: [{
                        name: '转化漏斗',
                        type: 'funnel',
                        left: '10%', top: 10, bottom: 10, width: '80%',
                        min: 0, max: 100,
                        minSize: '20%',
                        label: { show: true, position: 'inside', color: '#fff', formatter: '{b}: {c}%' },
                        itemStyle: { borderWidth: 0, shadowBlur: 20, shadowColor: 'rgba(0, 0, 0, 0.5)' },
                        data: [
                            { value: invitedRate, name: '邀约' },
                            { value: attendedRate, name: '体验' },
                            { value: enrolledRate, name: '报课' }
                        ].map((d, i) => ({...d, itemStyle: { color: i === 0 ? '#3a7bd5' : i === 1 ? '#00d2ff' : '#00f2fe' }}))
                    }]
                };
            });

            // 4. Revenue Trend
            safeInit('revenueTrendChart', () => {
                const revenueValues = dateFilterPrefixes.map(prefix => {
                    return enrollmentData.value
                        .filter(i => i.报课时间 && i.报课时间.startsWith(prefix))
                        .reduce((s, i) => s + (Number(i.归属业绩金额) || 0), 0);
                });
                
                let periodTarget = 100000;
                if (range === 'quarter') periodTarget = 300000;
                if (range === 'year') periodTarget = 1200000;

                let currentSum = 0;
                const cumulativeActual = revenueValues.map(v => {
                    currentSum += v;
                    return currentSum;
                });

                const cumulativeTarget = revenueValues.map((_, i) => {
                    return Math.round((periodTarget / revenueValues.length) * (i + 1));
                });
                
                return {
                    animationDuration: 1200,
                    animationEasing: 'cubicInOut',
                    tooltip: { 
                        trigger: 'axis', 
                        axisPointer: { type: 'cross' },
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        borderColor: '#334155',
                        textStyle: { color: '#fff' },
                        formatter: function(params) {
                            if (!params || params.length === 0) return '';
                            let res = `<div class="font-bold mb-1">${params[0].name}</div>`;
                            params.forEach(item => {
                                let val = item.value;
                                if (typeof val === 'number') val = val.toLocaleString();
                                res += `<div class="flex justify-between gap-4 text-xs">
                                    <span>${item.marker}${item.seriesName}</span>
                                    <span class="font-mono">${val}</span>
                                </div>`;
                            });
                            const actual = cumulativeActual[params[0].dataIndex];
                            const progress = ((actual / periodTarget) * 100).toFixed(1);
                            res += `<div class="mt-1 pt-1 border-t border-white/10 text-[10px] text-blue-400">
                                总进度: ${progress}% (目标 ${periodTarget.toLocaleString()})
                            </div>`;
                            return res;
                        }
                    },
                    legend: { 
                        data: ['当日业绩', '累计业绩', '目标进度'], 
                        textStyle: { color: '#94a3b8', fontSize: 10 }, 
                        top: 0 
                    },
                    grid: { left: '3%', right: '4%', bottom: '5%', containLabel: true },
                    xAxis: { 
                        type: 'category', 
                        data: xAxisLabels, 
                        axisLine: { lineStyle: { color: '#475569' } },
                        axisLabel: { color: '#94a3b8', fontSize: 10 }
                    },
                    yAxis: [
                        { 
                            type: 'value', 
                            name: '当日',
                            nameTextStyle: { color: '#94a3b8', fontSize: 9 },
                            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
                            axisLabel: { color: '#94a3b8', fontSize: 10 }
                        },
                        {
                            type: 'value',
                            name: '累计',
                            nameTextStyle: { color: '#94a3b8', fontSize: 9 },
                            splitLine: { show: false },
                            axisLabel: { color: '#94a3b8', fontSize: 10 }
                        }
                    ],
                    series: [
                        {
                            name: '当日业绩',
                            type: 'bar',
                            data: revenueValues,
                            itemStyle: {
                                color: 'rgba(0, 210, 255, 0.3)',
                                borderRadius: [2, 2, 0, 0]
                            },
                            barWidth: '40%'
                        },
                        {
                            name: '累计业绩',
                            type: 'line',
                            yAxisIndex: 1,
                            data: cumulativeActual,
                            smooth: true,
                            symbol: 'circle',
                            symbolSize: 4,
                            itemStyle: { color: '#00d2ff' },
                            lineStyle: { width: 3, shadowBlur: 10, shadowColor: 'rgba(0, 210, 255, 0.5)' },
                            areaStyle: {
                                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                    { offset: 0, color: 'rgba(0, 210, 255, 0.2)' },
                                    { offset: 1, color: 'rgba(0, 210, 255, 0)' }
                                ])
                            }
                        },
                        {
                            name: '目标进度',
                            type: 'line',
                            yAxisIndex: 1,
                            data: cumulativeTarget,
                            smooth: false,
                            lineStyle: { color: '#f43f5e', width: 1, type: 'dashed' },
                            itemStyle: { color: '#f43f5e' },
                            symbol: 'none'
                        }
                    ]
                };
            });

            // 5. Enrollment Ratio
            safeInit('enrollmentRatioChart', () => {
                const newCount = enrollmentData.value.filter(i => i.报课属性 === '新报').length;
                const renewCount = enrollmentData.value.filter(i => i.报课属性 === '续费').length;
                const total = newCount + renewCount;
                
                return {
                    animationDuration: 1200,
                    animationEasing: 'exponentialInOut',
                    tooltip: {
                        trigger: 'item',
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        borderColor: '#334155',
                        textStyle: { color: '#fff' },
                        formatter: '{b}: {c} ({d}%)'
                    },
                    legend: {
                        bottom: '5%',
                        left: 'center',
                        itemWidth: 8,
                        itemHeight: 8,
                        textStyle: { color: '#94a3b8', fontSize: 10 },
                        itemGap: 15,
                        formatter: (name) => {
                            const count = name === '新签' ? newCount : renewCount;
                            const percent = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
                            return `${name} ${count} (${percent}%)`;
                        }
                    },
                    title: {
                        text: '{val|' + total + '}\n{label|总计}',
                        left: 'center', 
                        top: '32%',
                        textStyle: {
                            rich: {
                                val: { color: '#fff', fontSize: 22, fontWeight: 'bold', lineHeight: 30 },
                                label: { color: '#94a3b8', fontSize: 11 }
                            }
                        }
                    },
                    series: [{
                        type: 'pie',
                        radius: ['58%', '78%'],
                        center: ['50%', '42%'],
                        avoidLabelOverlap: false,
                        itemStyle: {
                            borderRadius: 6,
                            borderColor: '#101827',
                            borderWidth: 2
                        },
                        label: { show: false },
                        emphasis: {
                            scale: true,
                            scaleSize: 5
                        },
                        data: [
                            { value: newCount, name: '新签', itemStyle: { color: '#00d2ff' } },
                            { value: renewCount, name: '续费', itemStyle: { color: '#3a7bd5' } }
                        ]
                    }]
                };
            });

            // 6. Consumption Trend Line Chart
            safeInit('consumptionChart', () => {
                const consValues = dateFilterPrefixes.map(prefix => {
                    return consumptionData.value
                        .filter(i => i['月份'] && i['月份'].startsWith(prefix))
                        .reduce((s, i) => s + (Number(i.消课金额) || 0), 0);
                });
                const finalConsData = consValues.some(v => v > 0) ? consValues : 
                    (range === 'year' ? [12000, 15000, 18000, 14000, 21000, 22000, 23000, 21500, 24000, 25000, 26000, 28000] : 
                    Array.from({length: xAxisLabels.length}, () => Math.floor(Math.random() * 5000) + 10000));
                
                return getLineAreaOption(xAxisLabels, finalConsData, '#a855f7');
            });

            // 7. Small Progress Charts
            ['bindRateChart', 'commentRateChart', 'taskRateChart', 'noticeRateChart'].forEach((id, idx) => {
                safeInit(id, () => {
                    const baseValues = [85, 75, 90, 95];
                    let val;
                    if (range === 'month') val = Math.floor(Math.random() * 20) + 60;
                    else if (range === 'quarter') val = Math.floor(Math.random() * 15) + 70;
                    else val = baseValues[idx];
                    
                    const colors = ['#00d2ff', '#00f2fe', '#3b82f6', '#f43f5e'];
                    return getSmallRingOption(val, colors[idx]);
                });
            });

            // Force resize after a short delay
            setTimeout(() => {
                charts.forEach(chart => chart.resize());
            }, 200);
        };

        const getLineAreaOption = (xAxisData, seriesData, color) => ({
            animationDuration: 1000,
            animationEasing: 'cubicOut',
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
                lineStyle: { color: color, width: 2, shadowBlur: 10, shadowColor: color },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: color + '44' },
                        { offset: 1, color: color + '00' }
                    ])
                }
            }]
        });

        const getSmallRingOption = (val, color) => ({
            animationDuration: 1000,
            animationEasing: 'exponentialOut',
            title: {
                text: val + '%',
                left: 'center',
                top: 'center',
                textStyle: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
            },
            series: [{
                type: 'pie',
                radius: ['70%', '90%'],
                silent: true,
                label: { show: false },
                data: [
                    { value: val, itemStyle: { color: color, shadowBlur: 10, shadowColor: color } },
                    { value: 100 - val, itemStyle: { color: 'rgba(255,255,255,0.05)' } }
                ]
            }]
        });

        const syncOnlineData = async () => {
            if (isSyncing.value) return;
            isSyncing.value = true;
            try {
                const response = await fetch('http://localhost:5001/sync', {
                    method: 'POST'
                });
                const data = await response.json();
                if (data.status === 'success') {
                    alert('同步成功！页面将自动刷新。');
                    location.reload(); // 刷新页面以加载最新生成的 JS 数据
                } else {
                    alert('同步失败: ' + data.message);
                }
            } catch (error) {
                console.error('Sync error:', error);
                alert('无法连接到同步服务器，请确保 server.py 正在运行。');
            } finally {
                isSyncing.value = false;
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
                    rate: data.total > 0 ? ((data.attended / data.total) * 100).toFixed(1) : "0.0",
                    attended: data.attended,
                    total: data.total
                }))
                .sort((a, b) => b.rate - a.rate);
        });

        return {
            currentTime,
            lastUpdateTime,
            timeRange,
            selectedYear,
            selectedQuarterValue,
            selectedMonthValue,
            isSyncing,
            syncOnlineData,
            kpis,
            latestEnrollmentMsgs,
            formatNumber,
            teacherRevenueRankings,
            teacherConsumptionRankings,
            teacherAttendanceRankings,
            realCampusStats
        };
    }
}).mount('#app');

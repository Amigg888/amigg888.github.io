const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

createApp({
    setup() {
        const normalizeTeacherName = (name) => {
            if (!name) return '未知老师';
            if (name === '许鹤丽') return '桃子老师';
            if (name === '许俊梅') return '小花老师';
            return name;
        };

        const currentTab = ref('experience');
        const enrSearch = ref('');
        const enrTableExpanded = ref(false); // 报课明细表格折叠状态，默认折叠
        const expSearch = ref('');
        const expTableExpanded = ref(false); // 体验课明细表格折叠状态，默认折叠
        const conSearch = ref('');
        const conTableExpanded = ref(false); // 课消明细表格折叠状态，默认折叠
        const churnSearch = ref('');
        const churnTableExpanded = ref(false);
        const enrollmentDetails = ref([...(window.enrollmentDetails2025 || []), ...(window.enrollmentDetails2026 || [])]);
        const experienceDetails = ref([...(window.experienceDetails2025 || []), ...(window.experienceDetails2026 || [])]);
        const consumptionDetails = ref([...(window.consumptionData2025 || []), ...(window.consumptionData2026 || [])]);
        const churnDetails = ref(window.churnData2026 || []);

        // Global Date Filter
        const globalFilter = reactive({
            type: 'year', // 'year' or 'month'
            year: '2026',
            month: '2026-01'
        });

        const showDatePicker = ref(false);
        const pickerTempYear = ref(globalFilter.year);

        const selectYear = (year) => {
            globalFilter.type = 'year';
            globalFilter.year = year;
            showDatePicker.value = false;
        };

        const selectMonth = (year, month) => {
            globalFilter.type = 'month';
            globalFilter.month = `${year}-${String(month).padStart(2, '0')}`;
            globalFilter.year = year;
            showDatePicker.value = false;
        };

        const filteredEnrollmentDetails = computed(() => {
            let data = enrollmentDetails.value;
            
            // Filter by global date
            if (globalFilter.type === 'year') {
                data = data.filter(item => item.报课时间 && item.报课时间.startsWith(globalFilter.year));
            } else {
                data = data.filter(item => item.报课时间 && item.报课时间.startsWith(globalFilter.month));
            }
            // Normalize teacher names in the returned data
            return data.map(item => ({
                ...item,
                业绩归属人: normalizeTeacherName(item.业绩归属人)
            }));
        });

        const searchedEnrollmentDetails = computed(() => {
            let data = filteredEnrollmentDetails.value;
            // Search filter
            if (!enrSearch.value) return data;
            const search = enrSearch.value.toLowerCase();
            return data.filter(item => 
                (item.学员姓名 && item.学员姓名.toLowerCase().includes(search)) || 
                (normalizeTeacherName(item.业绩归属人).toLowerCase().includes(search)) ||
                (item.报课属性 && item.报课属性.toLowerCase().includes(search)) ||
                (item.所在校区 && item.所在校区.toLowerCase().includes(search))
            );
        });

        const filteredExperienceDetails = computed(() => {
            let data = experienceDetails.value;
            
            // Filter by global date
            if (globalFilter.type === 'year') {
                data = data.filter(item => item.体验课时间 && item.体验课时间.startsWith(globalFilter.year));
            } else {
                data = data.filter(item => item.体验课时间 && item.体验课时间.startsWith(globalFilter.month));
            }
            // Normalize teacher names in the returned data
            return data.map(item => ({
                ...item,
                邀约老师: normalizeTeacherName(item.邀约老师),
                体验课老师: normalizeTeacherName(item.体验课老师)
            }));
        });

        const searchedExperienceDetails = computed(() => {
            let data = filteredExperienceDetails.value;
            // Search filter
            if (!expSearch.value) return data;
            const search = expSearch.value.toLowerCase();
            return data.filter(item => 
                (item.学员姓名 && item.学员姓名.toLowerCase().includes(search)) || 
                (normalizeTeacherName(item.邀约老师).toLowerCase().includes(search)) ||
                (normalizeTeacherName(item.体验课老师).toLowerCase().includes(search)) || 
                (item.所在校区 && item.所在校区.toLowerCase().includes(search)) ||
                (item.状态 && item.状态.toLowerCase().includes(search))
            );
        });

        const filteredConsumptionDetails = computed(() => {
            let data = consumptionDetails.value.filter(item => item.姓名 !== '汇总');
            
            // Filter by global date
            if (globalFilter.type === 'year') {
                data = data.filter(item => item.月份 && item.月份.startsWith(globalFilter.year));
            } else {
                data = data.filter(item => item.月份 === globalFilter.month);
            }

            // Filter by campus
            const selCampus = chartFilters.consumption.campus;
            if (selCampus !== 'all') {
                data = data.filter(item => item.校区 === selCampus);
            }
            
            return data;
        });

        const searchedConsumptionDetails = computed(() => {
            let data = filteredConsumptionDetails.value;
            if (!conSearch.value) return data;
            const search = conSearch.value.toLowerCase();
            return data.filter(item => 
                (normalizeTeacherName(item.姓名).toLowerCase().includes(search)) ||
                (item.校区 && item.校区.toLowerCase().includes(search))
            );
        });

        const groupedConsumptionDetails = computed(() => {
            const data = searchedConsumptionDetails.value;
            if (globalFilter.type === 'month') {
                return [{ month: globalFilter.month, items: data }];
            }
            
            // Group by month for year view
            const groups = {};
            data.forEach(item => {
                if (!groups[item.月份]) groups[item.月份] = [];
                groups[item.月份].push(item);
            });
            
            return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(month => ({
                month,
                items: groups[month].sort((a, b) => (b.消课课时 || 0) - (a.消课课时 || 0)) // Sort teachers by hours within month
            }));
        });

        const filteredChurnDetails = computed(() => {
            let data = churnDetails.value;
            // Filter by global date
            if (globalFilter.type === 'year') {
                data = data.filter(item => item.月份 && item.月份.startsWith(globalFilter.year));
            } else {
                data = data.filter(item => item.月份 === globalFilter.month);
            }
            return data;
        });

        const searchedChurnDetails = computed(() => {
            let data = filteredChurnDetails.value;
            if (!churnSearch.value) return data;
            const search = churnSearch.value.toLowerCase();
            return data.filter(item => 
                (item.学员姓名 && item.学员姓名.toLowerCase().includes(search)) ||
                (item.负责老师 && item.负责老师.toLowerCase().includes(search)) ||
                (item.流失原因 && item.流失原因.toLowerCase().includes(search))
            );
        });

        const showImport = ref(false);
        const importing = ref(false);
        const importProgress = ref(0);
        const parsedData = ref([]);
        const saveStatus = ref(''); // 状态提示：saved, error, ''
        
        // Independent Chart Filters
        const chartFilters = reactive({
            expKpi: { dateRange: 'thisMonth' },
            grade: { campus: 'all' },
            source: { dateRange: 'thisYear' },
            gender: { campus: 'all' },
            funnel: { teacher: 'all' },
            teacherExp: { dateRange: 'thisYear' },
            revenueTrend: { campus: 'all' },
            enrType: { dateRange: 'thisYear' },
            ranking: { type: 'campus', dateRange: 'thisYear' },
            aov: { campus: 'all' },
            consumption: { campus: 'all' },
            campusPerf: { dateRange: 'thisYear' }
        });

        const campusList = ref(['临安校区', '昌化校区']);
        const teacherList = ref(['小花老师', '桃子老师', '柚子老师', '琪琪老师', '杨老师']);
        
        const currentMonth = ref(localStorage.getItem('selected_month') || '2025-12');

        // Watch for global month change
        watch(currentMonth, (newVal) => {
            localStorage.setItem('selected_month', newVal);
            // Sync currentMonth to global filter if needed, but currentMonth is deprecated in favor of globalFilter
        });

        // Watch for global filter change
        watch(globalFilter, () => {
            initCharts();
        }, { deep: true });
        const kpis = reactive({
            // 体验课 KPIs - Dynamic based on filtered data
            exp_invited: computed(() => {
                return filteredExperienceDetails.value.length;
            }),
            exp_attended: computed(() => {
                return filteredExperienceDetails.value.filter(item => 
                    item.状态 === '已体验' || item.状态 === '已报课'
                ).length;
            }),
            exp_enrolled: computed(() => {
                return filteredExperienceDetails.value.filter(item => item.状态 === '已报课').length;
            }),
            exp_conv_rate: computed(() => {
                const attended = kpis.exp_attended;
                if (attended === 0) return 0;
                const enrolled = kpis.exp_enrolled;
                return ((enrolled / attended) * 100).toFixed(1);
            }),
            exp_attend_rate: computed(() => {
                const invited = kpis.exp_invited;
                if (invited === 0) return 0;
                const attended = kpis.exp_attended;
                return ((attended / invited) * 100).toFixed(1);
            }),
            // 报课 KPIs - Dynamic based on filtered data
            enr_revenue: computed(() => {
                return filteredEnrollmentDetails.value.reduce((sum, item) => sum + (Number(item.归属业绩金额) || 0), 0);
            }),
            enr_total_amount: computed(() => {
                const uniqueTransactions = new Set();
                let total = 0;
                filteredEnrollmentDetails.value.forEach(item => {
                    const key = `${item.学员姓名}-${item.报课时间}-${item.实收金额}`;
                    if (!uniqueTransactions.has(key)) {
                        uniqueTransactions.add(key);
                        total += Number(item.实收金额) || 0;
                    }
                });
                return total;
            }),
            enr_new_contracts: computed(() => {
                const uniqueNew = new Set();
                filteredEnrollmentDetails.value.forEach(item => {
                    if (item.报课属性.includes('新报')) {
                        uniqueNew.add(`${item.学员姓名}-${item.报课时间}`);
                    }
                });
                return uniqueNew.size;
            }),
            enr_renew_contracts: computed(() => {
                const uniqueRenew = new Set();
                filteredEnrollmentDetails.value.forEach(item => {
                    if (item.报课属性.includes('续费')) {
                        uniqueRenew.add(`${item.学员姓名}-${item.报课时间}`);
                    }
                });
                return uniqueRenew.size;
            }),
            // 课消 KPIs
            con_total_hours: computed(() => {
                return filteredConsumptionDetails.value.reduce((sum, item) => sum + (item.消课课时 || 0), 0);
            }),
            con_total_amount: computed(() => {
                return filteredConsumptionDetails.value.reduce((sum, item) => sum + (item.消课金额 || 0), 0);
            }),
            con_one_on_one_count: computed(() => {
                return filteredConsumptionDetails.value.reduce((sum, item) => sum + (item.一对一人次 || 0), 0);
            }),
            con_attendance_rate: computed(() => {
                const data = filteredConsumptionDetails.value;
                const attendance = data.reduce((sum, item) => sum + (item.出勤人次 || 0), 0);
                const total_possible = attendance + data.reduce((sum, item) => sum + (item.请假人次 || 0) + (item.缺勤人次 || 0), 0);
                return total_possible > 0 ? ((attendance / total_possible) * 100).toFixed(1) : 0;
            }),
            con_leave_rate: computed(() => {
                const data = filteredConsumptionDetails.value;
                const leave = data.reduce((sum, item) => sum + (item.请假人次 || 0), 0);
                const attendance = data.reduce((sum, item) => sum + (item.出勤人次 || 0), 0);
                const total_possible = attendance + leave + data.reduce((sum, item) => sum + (item.缺勤人次 || 0), 0);
                return total_possible > 0 ? ((leave / total_possible) * 100).toFixed(1) : 0;
            }),
            con_absence_rate: computed(() => {
                const data = filteredConsumptionDetails.value;
                const absence = data.reduce((sum, item) => sum + (item.缺勤人次 || 0), 0);
                const attendance = data.reduce((sum, item) => sum + (item.出勤人次 || 0), 0);
                const total_possible = attendance + absence + data.reduce((sum, item) => sum + (item.请假人次 || 0), 0);
                return total_possible > 0 ? ((absence / total_possible) * 100).toFixed(1) : 0;
            })
        });

        // 兼容原有的 conKpis 名称
        const conKpis = reactive({
            total_hours: computed(() => kpis.con_total_hours),
            total_amount: computed(() => kpis.con_total_amount),
            one_on_one_count: computed(() => kpis.con_one_on_one_count),
            attendance_rate: computed(() => kpis.con_attendance_rate),
            leave_rate: computed(() => kpis.con_leave_rate),
            absence_rate: computed(() => kpis.con_absence_rate)
        });

        // 修改日期判断逻辑，将 2025 年视为“去年”，2026 年视为“本年”
        const isThisYear = (dateStr) => {
            return dateStr && dateStr.startsWith('2026');
        };

        // ECharts instances
        let charts = {};

        const initCharts = () => {
            if (currentTab.value === 'experience') {
                initExperienceCharts();
            } else if (currentTab.value === 'enrollment') {
                initEnrollmentCharts();
            } else if (currentTab.value === 'consumption') {
                initConsumptionCharts();
            }
        };

        const initConsumptionCharts = async () => {
            await nextTick();
            const getChart = (id) => {
                const el = document.getElementById(id);
                if (!el) return null;
                let chart = echarts.getInstanceByDom(el);
                if (chart) chart.dispose();
                return echarts.init(el);
            };

            // 1. Teacher Rank Chart
            const teacherRankChart = getChart('teacherRankChart');
            if (teacherRankChart) {
                const teacherData = {};
                filteredConsumptionDetails.value.forEach(item => {
                    const name = normalizeTeacherName(item.姓名);
                    teacherData[name] = (teacherData[name] || 0) + (item.消课课时 || 0);
                });
                const sorted = Object.entries(teacherData).sort((a, b) => b[1] - a[1]);
                
                teacherRankChart.setOption({
                    animationDuration: 2000,
                    animationDurationUpdate: 1200,
                    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                    xAxis: { type: 'value' },
                    yAxis: { type: 'category', data: sorted.map(d => d[0]).reverse() },
                    series: [{
                        name: '消课课时',
                        type: 'bar',
                        data: sorted.map(d => d[1]).reverse(),
                        itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] }
                    }]
                });
            }

            // 2. Trend Chart (Enhanced with Attendance Rate)
            const trendChart = getChart('trendChart');
            if (trendChart) {
                const monthlyData = {};
                const selCampus = chartFilters.consumption.campus;
                let trendData = consumptionDetails.value.filter(item => item.姓名 !== '汇总');
                
                if (selCampus !== 'all') {
                    trendData = trendData.filter(item => item.校区 === selCampus);
                }

                trendData.forEach(item => {
                    if (!monthlyData[item.月份]) {
                        monthlyData[item.月份] = { hours: 0, attendance: 0, total_possible: 0 };
                    }
                    monthlyData[item.月份].hours += (item.消课课时 || 0);
                    monthlyData[item.月份].attendance += (item.出勤人次 || 0);
                    monthlyData[item.月份].total_possible += (item.出勤人次 || 0) + (item.请假人次 || 0) + (item.缺勤人次 || 0);
                });
                const months = Object.keys(monthlyData).sort();

                trendChart.setOption({
                    animationDuration: 2000,
                    animationDurationUpdate: 1200,
                    tooltip: { 
                        trigger: 'axis',
                        axisPointer: { type: 'cross' }
                    },
                    legend: { data: ['消课课时', '出勤率'], bottom: 0 },
                    xAxis: { type: 'category', data: months.map(m => m.split('-')[1] + '月') },
                    yAxis: [
                        { type: 'value', name: '课时', position: 'left' },
                        { type: 'value', name: '出勤率', position: 'right', min: 0, max: 100, axisLabel: { formatter: '{value}%' } }
                    ],
                    series: [
                        {
                            name: '消课课时',
                            data: months.map(m => monthlyData[m].hours),
                            type: 'bar',
                            itemStyle: { color: '#3b82f6', opacity: 0.8 }
                        },
                        {
                            name: '出勤率',
                            yAxisIndex: 1,
                            data: months.map(m => {
                                const d = monthlyData[m];
                                return d.total_possible > 0 ? ((d.attendance / d.total_possible) * 100).toFixed(1) : 0;
                            }),
                            type: 'line',
                            smooth: true,
                            symbol: 'circle',
                            symbolSize: 8,
                            lineStyle: { color: '#10b981', width: 3 },
                            itemStyle: { color: '#10b981' }
                        }
                    ]
                });
            }

            // 3. Composition Chart (Enhanced to show Attendance breakdown)
            const compositionChart = getChart('compositionChart');
            if (compositionChart) {
                const attendance = filteredConsumptionDetails.value.reduce((sum, item) => sum + (item.出勤人次 || 0), 0);
                const leave = filteredConsumptionDetails.value.reduce((sum, item) => sum + (item.请假人次 || 0), 0);
                const absence = filteredConsumptionDetails.value.reduce((sum, item) => sum + (item.缺勤人次 || 0), 0);
                const makeup = filteredConsumptionDetails.value.reduce((sum, item) => sum + (item.补课人次 || 0), 0);

                compositionChart.setOption({
                    animationDuration: 2000,
                    animationDurationUpdate: 1200,
                    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                    legend: { bottom: '0', left: 'center', textStyle: { fontSize: 10 } },
                    series: [{
                        type: 'pie',
                        radius: ['40%', '70%'],
                        avoidLabelOverlap: false,
                        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
                        label: { show: false },
                        data: [
                            { value: attendance, name: '正常出勤', itemStyle: { color: '#10b981' } },
                            { value: leave, name: '请假', itemStyle: { color: '#f59e0b' } },
                            { value: absence, name: '缺勤', itemStyle: { color: '#ef4444' } },
                            { value: makeup, name: '补课', itemStyle: { color: '#3b82f6' } }
                        ]
                    }]
                });
            }

            // 4. Churn Chart (Only for 2026)
            const churnChart = getChart('churnChart');
            if (churnChart) {
                const churnData = filteredChurnDetails.value;
                const teacherData = {};
                churnData.forEach(item => {
                    const name = normalizeTeacherName(item.负责老师);
                    teacherData[name] = (teacherData[name] || 0) + 1;
                });
                const sorted = Object.entries(teacherData).sort((a, b) => b[1] - a[1]);

                churnChart.setOption({
                    animationDuration: 2000,
                    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                    xAxis: { type: 'value', name: '流失人数' },
                    yAxis: { type: 'category', data: sorted.map(d => d[0]).reverse() },
                    series: [{
                        name: '流失人数',
                        type: 'bar',
                        data: sorted.map(d => d[1]).reverse(),
                        itemStyle: { color: '#f43f5e', borderRadius: [0, 4, 4, 0] },
                        label: { show: true, position: 'right' }
                    }]
                });
            }

            // 5. Attendance Chart (Teacher Detail)
            const attendanceChart = getChart('attendanceChart');
            if (attendanceChart) {
                const teacherAttendance = {};
                filteredConsumptionDetails.value.forEach(item => {
                    const name = normalizeTeacherName(item.姓名);
                    if (!teacherAttendance[name]) {
                        teacherAttendance[name] = { attendance: 0, leave: 0, absence: 0, makeup: 0 };
                    }
                    teacherAttendance[name].attendance += (item.出勤人次 || 0);
                    teacherAttendance[name].leave += (item.请假人次 || 0);
                    teacherAttendance[name].absence += (item.缺勤人次 || 0);
                    teacherAttendance[name].makeup += (item.补课人次 || 0);
                });
                const teachers = Object.keys(teacherAttendance);

                attendanceChart.setOption({
                    animationDuration: 2000,
                    animationDurationUpdate: 1200,
                    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                    legend: { data: ['出勤', '请假', '缺勤', '补课'], bottom: 0 },
                    xAxis: { type: 'category', data: teachers },
                    yAxis: { type: 'value' },
                    series: [
                        { name: '出勤', type: 'bar', stack: 'total', data: teachers.map(t => teacherAttendance[t].attendance), itemStyle: { color: '#10b981' } },
                        { name: '请假', type: 'bar', stack: 'total', data: teachers.map(t => teacherAttendance[t].leave), itemStyle: { color: '#f59e0b' } },
                        { name: '缺勤', type: 'bar', stack: 'total', data: teachers.map(t => teacherAttendance[t].absence), itemStyle: { color: '#ef4444' } },
                        { name: '补课', type: 'bar', stack: 'total', data: teachers.map(t => teacherAttendance[t].makeup), itemStyle: { color: '#3b82f6' } }
                    ]
                });
            }
        };

        const initExperienceCharts = async () => {
            await nextTick();
            
            // KPIs are now computed properties and will update automatically.

            // Helper to get or init chart
            const getChart = (id) => {
                let chart = echarts.getInstanceByDom(document.getElementById(id));
                if (!chart) chart = echarts.init(document.getElementById(id));
                return chart;
            };

            // 1. Grade Distribution (Real data)
            const gradeChart = getChart('gradeChart');
            const selGradeCampus = chartFilters.grade.campus;
            
            const gradeCounts = {};
            filteredExperienceDetails.value.forEach(item => {
                if (selGradeCampus === 'all' || item.所在校区 === selGradeCampus) {
                    const grade = item.年级 || item.年龄 || '未知';
                    gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
                }
            });
            
            // Sort grades if possible, otherwise just use keys
            const sortedGrades = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

            gradeChart.setOption({
                animationDuration: 2000,
                animationDurationUpdate: 1200,
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: { type: 'value', splitLine: { show: false } },
                yAxis: { type: 'category', data: sortedGrades.map(g => g[0]).reverse() },
                series: [{
                    name: '学员数',
                    type: 'bar',
                    data: sortedGrades.map(g => g[1]).reverse(),
                    itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] }
                }]
            });
            charts.gradeChart = gradeChart;

            // 2. Source Chart (Real data)
            const sourceChart = getChart('sourceChart');
            const sourceCounts = {};
            filteredExperienceDetails.value.forEach(item => {
                const source = item.学员来源 || '未知';
                sourceCounts[source] = (sourceCounts[source] || 0) + 1;
            });
            
            const sourceData = Object.entries(sourceCounts).map(([name, value]) => ({ name, value }));

            sourceChart.setOption({
                tooltip: { trigger: 'item' },
                series: [{
                    type: 'treemap',
                    data: sourceData,
                    breadcrumb: { show: false },
                    itemStyle: { borderColor: '#fff' }
                }]
            });
            charts.sourceChart = sourceChart;

            // 3. Gender Chart (Real data)
            const genderChart = getChart('genderChart');
            const selGenderCampus = chartFilters.gender.campus;
            
            let male = 0, female = 0;
            filteredExperienceDetails.value.forEach(item => {
                if (selGenderCampus === 'all' || item.所在校区 === selGenderCampus) {
                    if (item.性别 === '男') male++;
                    else if (item.性别 === '女') female++;
                }
            });

            genderChart.setOption({
                tooltip: { trigger: 'item' },
                legend: { bottom: '0', left: 'center' },
                series: [{
                    type: 'pie',
                    radius: ['40%', '70%'],
                    avoidLabelOverlap: false,
                    itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
                    label: { show: false, position: 'center' },
                    emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
                    data: [
                        { value: male, name: '男宝', itemStyle: { color: '#60a5fa' } },
                        { value: female, name: '女宝', itemStyle: { color: '#f472b6' } }
                    ]
                }]
            });
            charts.genderChart = genderChart;

            // 4. Funnel Chart (Refactored logic)
            const funnelChart = getChart('funnelChart');
            const selFunnelTeacher = chartFilters.funnel.teacher;
            
            let invitedCount = 0;   // 邀约数
            let attendedCount = 0;  // 到访人数
            let enrolledCount = 0;  // 报课人数

            if (selFunnelTeacher === 'all') {
                invitedCount = filteredExperienceDetails.value.length;
                attendedCount = filteredExperienceDetails.value.filter(item => item.状态 === '已体验' || item.状态 === '已报课').length;
                enrolledCount = filteredExperienceDetails.value.filter(item => item.状态 === '已报课').length;
            } else {
                // 筛选特定老师时：
                // 1. 邀约数取自该老师作为“邀约老师”的数据
                invitedCount = filteredExperienceDetails.value.filter(item => item.邀约老师 === selFunnelTeacher).length;
                
                // 2. 到访和报课取自该老师作为“体验课老师”的数据
                const teacherExpRecords = filteredExperienceDetails.value.filter(item => item.体验课老师 === selFunnelTeacher);
                attendedCount = teacherExpRecords.filter(item => item.状态 === '已体验' || item.状态 === '已报课').length;
                enrolledCount = teacherExpRecords.filter(item => item.状态 === '已报课').length;
            }

            // 为了在漏斗图中正确显示（即使第一层比第二层小），我们使用真实数值
            // 并通过计算比例来控制漏斗的宽度展示
            const attendRate = invitedCount > 0 ? ((attendedCount / invitedCount) * 100).toFixed(1) : 0;
            const enrollRate = attendedCount > 0 ? ((enrolledCount / attendedCount) * 100).toFixed(1) : 0;
            const totalRate = invitedCount > 0 ? ((enrolledCount / invitedCount) * 100).toFixed(1) : 0;
            
            funnelChart.setOption({
                tooltip: { 
                    trigger: 'item', 
                    formatter: function(params) {
                        let res = `${params.name}: ${params.data.realValue}人`;
                        if (params.name === '已体验') res += `<br/>到访率: ${attendRate}%`;
                        if (params.name === '已报课') res += `<br/>报课转化率: ${enrollRate}%<br/>总转化率: ${totalRate}%`;
                        return res;
                    }
                },
                legend: { data: ['已邀约', '已体验', '已报课'], bottom: 0 },
                series: [{
                    name: '转化漏斗',
                    type: 'funnel',
                    left: '10%', top: 20, bottom: 60, width: '80%',
                    sort: 'none', // 不自动排序，保持 邀约 -> 体验 -> 报课 的顺序
                    gap: 2,
                    label: { 
                        show: true, 
                        position: 'inside', 
                        formatter: function(params) {
                            let label = `${params.name}: ${params.data.realValue}人`;
                            if (params.name === '已体验') label += ` (${attendRate}%)`;
                            if (params.name === '已报课') label += ` (${enrollRate}%)`;
                            return label;
                        }
                    },
                    itemStyle: { borderColor: '#fff', borderWidth: 1 },
                    data: [
                        { value: invitedCount, name: '已邀约', itemStyle: { color: '#94a3b8' }, realValue: invitedCount },
                        { value: attendedCount, name: '已体验', itemStyle: { color: '#60a5fa' }, realValue: attendedCount },
                        { value: enrolledCount, name: '已报课', itemStyle: { color: '#10b981' }, realValue: enrolledCount }
                    ]
                }]
            });
            charts.funnelChart = funnelChart;

            // 5. Teacher Exp Chart (Simplified)
            const teacherExpChart = getChart('teacherExpChart');
            const expStats = {}; 
            
            filteredExperienceDetails.value.forEach(item => {
                if (item.状态 === '已体验' || item.状态 === '已报课') {
                    const expTeacher = item.体验课老师 || '未知';
                    if (!expStats[expTeacher]) {
                        expStats[expTeacher] = { attended: 0, enrolled: 0 };
                    }
                    expStats[expTeacher].attended++;
                    if (item.状态 === '已报课') {
                        expStats[expTeacher].enrolled++;
                    }
                }
            });
            
            const sortedExpTeachers = Object.entries(expStats).sort((a, b) => b[1].attended - a[1].attended);

            teacherExpChart.setOption({
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                legend: { data: ['到访人数', '报课人数'], bottom: 0 },
                xAxis: { type: 'category', data: sortedExpTeachers.map(t => t[0]) },
                yAxis: { type: 'value', name: '人数' },
                series: [
                    { name: '到访人数', type: 'bar', data: sortedExpTeachers.map(t => t[1].attended), itemStyle: { color: '#60a5fa' } },
                    { name: '报课人数', type: 'bar', data: sortedExpTeachers.map(t => t[1].enrolled), itemStyle: { color: '#10b981' } }
                ]
            });
            charts.teacherExpChart = teacherExpChart;
        };

        const initEnrollmentCharts = async () => {
            await nextTick();

            // Enrollment KPIs are now computed properties and will update automatically
            // when filteredEnrollmentDetails changes.

            // Helper to get or init chart
            const getChart = (id) => {
                let chart = echarts.getInstanceByDom(document.getElementById(id));
                if (!chart) chart = echarts.init(document.getElementById(id));
                return chart;
            };
            
            // 1. Revenue Trend (Calculated from real data)
            const revenueTrendChart = getChart('revenueTrendChart');
            const selTrendCampus = chartFilters.revenueTrend.campus;
            
            const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
            const trendValues = months.map(m => {
                const monthStr = `${globalFilter.year}-${m}`;
                return enrollmentDetails.value
                    .filter(item => item.报课时间 && item.报课时间.startsWith(monthStr) && (selTrendCampus === 'all' || item.所在校区 === selTrendCampus))
                    .reduce((sum, item) => sum + (Number(item.归属业绩金额) || 0), 0);
            });

            revenueTrendChart.setOption({
                animationDuration: 2500,
                animationDurationUpdate: 1500,
                tooltip: { trigger: 'axis' },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: { type: 'category', boundaryGap: false, data: months.map(m => parseInt(m) + '月') },
                yAxis: { type: 'value' },
                series: [{
                    name: '实收金额',
                    type: 'line',
                    smooth: true,
                    data: trendValues,
                    itemStyle: { color: '#3b82f6' },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                            { offset: 1, color: 'rgba(59, 130, 246, 0)' }
                        ])
                    }
                }]
            });
            charts.revenueTrendChart = revenueTrendChart;

            // 2. Enrollment Type (Calculated from real data)
            const enrTypeChart = getChart('enrTypeChart');
            const typeMap = {};
            filteredEnrollmentDetails.value.forEach(item => {
                if (item.报课属性) {
                    const type = item.报课属性;
                    typeMap[type] = (typeMap[type] || 0) + (Number(item.归属业绩金额) || 0);
                }
            });
            
            const typeData = Object.entries(typeMap).map(([name, value]) => {
                let color = '#94a3b8'; // Default color
                if (name.includes('新报')) color = '#10b981';
                else if (name.includes('续费')) color = '#3b82f6';
                else if (name.includes('专项')) color = '#f59e0b';
                
                return { name, value, itemStyle: { color } };
            }).sort((a, b) => b.value - a.value);

            enrTypeChart.setOption({
                tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
                legend: { bottom: '0', left: 'center', type: 'scroll' },
                series: [{
                    type: 'pie',
                    radius: ['40%', '70%'],
                    avoidLabelOverlap: true,
                    itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
                    data: typeData,
                    label: { show: true, formatter: '{b}: {d}%' }
                }]
            });
            charts.enrTypeChart = enrTypeChart;

            // 3. Performance Ranking Chart (Calculated from real data)
            const perfRankingChart = getChart('perfRankingChart');
            const rankingType = chartFilters.ranking.type;
            const isCampus = rankingType === 'campus';
            
            let rankingData = { labels: [], values: [] };
            if (isCampus) {
                const campusMap = {};
                filteredEnrollmentDetails.value.forEach(item => {
                    if (item.所在校区) {
                        campusMap[item.所在校区] = (campusMap[item.所在校区] || 0) + Number(item.归属业绩金额);
                    }
                });
                rankingData.labels = Object.keys(campusMap);
                rankingData.values = Object.values(campusMap);
            } else {
                const teacherMap = {};
                filteredEnrollmentDetails.value.forEach(item => {
                    if (item.业绩归属人) {
                        teacherMap[item.业绩归属人] = (teacherMap[item.业绩归属人] || 0) + Number(item.归属业绩金额);
                    }
                });
                // Sort teachers by value
                const sorted = Object.entries(teacherMap).sort((a, b) => a[1] - b[1]);
                rankingData.labels = sorted.map(s => s[0]);
                rankingData.values = sorted.map(s => s[1]);
            }

            perfRankingChart.setOption({
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: { type: 'value', splitLine: { show: false } },
                yAxis: { type: 'category', data: rankingData.labels },
                series: [{
                    name: globalFilter.type === 'year' ? '年度总业绩' : '月度总业绩',
                    type: 'bar',
                    data: rankingData.values,
                    itemStyle: { 
                        color: (params) => params.dataIndex === rankingData.values.length - 1 ? '#f59e0b' : '#3b82f6',
                        borderRadius: [0, 4, 4, 0] 
                    },
                    label: { show: true, position: 'right', formatter: '¥{c}' }
                }]
            });
            charts.perfRankingChart = perfRankingChart;

            // 4. AOV Trend Chart (Calculated from real data)
            const aovTrendChart = getChart('aovTrendChart');
            const aovValues = months.map(m => {
                const monthStr = `${globalFilter.year}-${m}`;
                const monthData = enrollmentDetails.value.filter(item => item.报课时间 && item.报课时间.startsWith(monthStr));
                if (monthData.length === 0) return 0;
                
                const uniqueTransactions = new Set();
                let totalAmount = 0;
                monthData.forEach(item => {
                    const key = `${item.学员姓名}-${item.报课时间}-${item.实收金额}`;
                    if (!uniqueTransactions.has(key)) {
                        uniqueTransactions.add(key);
                        totalAmount += Number(item.实收金额);
                    }
                });
                return uniqueTransactions.size > 0 ? (totalAmount / uniqueTransactions.size).toFixed(0) : 0;
            });

            aovTrendChart.setOption({
                tooltip: { trigger: 'axis' },
                xAxis: { type: 'category', data: months.map(m => parseInt(m) + '月') },
                yAxis: { type: 'value', name: '客单价 (¥)' },
                series: [{
                    name: '平均客单价',
                    type: 'line',
                    smooth: true,
                    data: aovValues,
                    itemStyle: { color: '#8b5cf6' },
                    markLine: { data: [{ type: 'average', name: '平均值' }] }
                }]
            });
            charts.aovTrendChart = aovTrendChart;

            // 5. Campus Performance Chart (Calculated from real data)
            const campusPerfChart = getChart('campusPerfChart');
            
            const cList = ['临安校区', '昌化校区'];
            const campusNewValues = cList.map(c => {
                return filteredEnrollmentDetails.value
                    .filter(item => item.所在校区 === c && item.报课属性 && item.报课属性.includes('新报'))
                    .reduce((sum, item) => sum + (Number(item.归属业绩金额) || 0), 0);
            });
            const campusRenewValues = cList.map(c => {
                return filteredEnrollmentDetails.value
                    .filter(item => item.所在校区 === c && item.报课属性 && item.报课属性.includes('续费'))
                    .reduce((sum, item) => sum + (Number(item.归属业绩金额) || 0), 0);
            });

            campusPerfChart.setOption({
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                legend: { data: ['新签金额', '续费金额'], bottom: 0 },
                xAxis: { type: 'category', data: cList },
                yAxis: { type: 'value', name: '金额 (¥)' },
                series: [
                    { name: '新签金额', type: 'bar', stack: 'total', data: campusNewValues, itemStyle: { color: '#10b981' } },
                    { name: '续费金额', type: 'bar', stack: 'total', data: campusRenewValues, itemStyle: { color: '#3b82f6' } }
                ]
            });
            charts.campusPerfChart = campusPerfChart;
        };

        const handleResize = () => {
            Object.values(charts).forEach(chart => chart && chart.resize());
        };

        // Data Import Logic
        const handleExcelUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            importing.value = true;
            importProgress.value = 10;

            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                
                parsedData.value = data;
                importProgress.value = 100;
                importing.value = false;
            };
            reader.readAsBinaryString(file);
        };

        const handleImageUpload = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            importing.value = true;
            importProgress.value = 0;

            try {
                const worker = await Tesseract.createWorker('chi_sim', 1, {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            importProgress.value = Math.floor(m.progress * 100);
                        }
                    }
                });
                const { data: { text } } = await worker.recognize(file);
                await worker.terminate();

                // Simple parser for OCR text (heuristic)
                // In a real app, this would be more complex or call an LLM API
                const lines = text.split('\n').filter(l => l.trim().length > 0);
                parsedData.value = lines.map(line => ({ "识别文本": line }));
                
                importing.value = false;
            } catch (err) {
                console.error('OCR Error:', err);
                // 无感提示代替 alert
                saveStatus.value = 'error';
                setTimeout(() => { saveStatus.value = ''; }, 2000);
                importing.value = false;
            }
        };

        const clearParsedData = () => {
            parsedData.value = [];
        };

        const addEmptyRow = () => {
            if (parsedData.value.length > 0) {
                const template = { ...parsedData.value[0] };
                Object.keys(template).forEach(key => template[key] = '');
                parsedData.value.unshift(template);
            } else {
                parsedData.value.push({ "识别文本": "" });
            }
        };

        const removeRow = (index) => {
            parsedData.value.splice(index, 1);
        };

        const confirmImport = () => {
            // 模拟数据更新逻辑
            if (currentTab.value === 'experience') {
                kpis.exp_students += Math.floor(Math.random() * 10);
                kpis.exp_conv_rate = (kpis.exp_students / 400 * 100).toFixed(1);
                // 刷新图表
                initExperienceCharts();
            } else {
                kpis.enr_revenue += Math.floor(Math.random() * 50000);
                kpis.enr_new_contracts += Math.floor(Math.random() * 5);
                // 刷新图表
                initEnrollmentCharts();
            }
            
            // 无感提示代替 alert
            saveStatus.value = 'saved';
            setTimeout(() => { 
                saveStatus.value = '';
                showImport.value = false;
                clearParsedData();
            }, 1000);
        };

        // Watchers for Independent Filters
        watch(() => chartFilters.ranking.type, () => {
            if (currentTab.value === 'enrollment') initEnrollmentCharts();
        });
        watch(() => chartFilters.consumption.campus, () => {
            if (currentTab.value === 'consumption') initConsumptionCharts();
        });
        watch(() => chartFilters.revenueTrend.campus, () => {
            if (currentTab.value === 'enrollment') initEnrollmentCharts();
        });
        watch(() => chartFilters.aov.campus, () => {
            if (currentTab.value === 'enrollment') initEnrollmentCharts();
        });
        
        // Experience filters
        watch(() => chartFilters.grade.campus, () => {
            if (currentTab.value === 'experience') initExperienceCharts();
        });
        watch(() => chartFilters.gender.campus, () => {
            if (currentTab.value === 'experience') initExperienceCharts();
        });
        watch(() => chartFilters.funnel.teacher, () => {
            if (currentTab.value === 'experience') initExperienceCharts();
        });

        // Watchers & Lifecycle
        watch(currentTab, () => {
            // Clean up old charts
            Object.values(charts).forEach(chart => {
                if (chart) chart.dispose();
            });
            charts = {};
            initCharts();
        });

        onMounted(() => {
            showImport.value = false;
            initCharts();
            window.addEventListener('resize', handleResize);
            // 初始化 Lucide 图标
            if (window.lucide) {
                window.lucide.createIcons();
            }
        });

        return {
            currentTab, enrSearch, enrTableExpanded, expSearch, expTableExpanded, 
            conSearch, conTableExpanded, churnSearch, churnTableExpanded,
            enrollmentDetails, experienceDetails, consumptionDetails, churnDetails,
            filteredEnrollmentDetails, filteredExperienceDetails, filteredConsumptionDetails, filteredChurnDetails,
            searchedEnrollmentDetails, searchedExperienceDetails, searchedConsumptionDetails, searchedChurnDetails,
            groupedConsumptionDetails,
            globalFilter, showDatePicker, pickerTempYear, selectYear, selectMonth, showImport, importing, importProgress, parsedData, chartFilters,
            campusList, teacherList, kpis, conKpis, currentMonth, saveStatus,
            handleExcelUpload, handleImageUpload, clearParsedData, confirmImport,
            addEmptyRow, removeRow
        };
    }
}).mount('#app');

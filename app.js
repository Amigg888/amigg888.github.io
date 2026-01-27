const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

createApp({
    setup() {
        const currentTab = ref('experience');
        const enrSearch = ref('');
        const enrollmentDetails = ref(window.enrollmentDetails2025 || []);

        // Global Date Filter
        const globalFilter = reactive({
            type: 'year', // 'year' or 'month'
            year: '2025',
            month: '2025-01'
        });

        const filteredEnrollmentDetails = computed(() => {
            let data = enrollmentDetails.value;
            
            // Filter by global date
            if (globalFilter.type === 'year') {
                data = data.filter(item => item.报课时间.startsWith(globalFilter.year));
            } else {
                data = data.filter(item => item.报课时间.startsWith(globalFilter.month));
            }

            // Search filter
            if (!enrSearch.value) return data;
            const search = enrSearch.value.toLowerCase();
            return data.filter(item => 
                item.学员姓名.toLowerCase().includes(search) || 
                item.业绩归属人.toLowerCase().includes(search) ||
                item.报课属性.toLowerCase().includes(search) ||
                item.所在校区.toLowerCase().includes(search)
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
        const teacherList = ref(['小花老师', '小草老师', '桃子老师', '柚子老师']);
        
        const currentMonth = ref(localStorage.getItem('selected_month') || '2025-12');

        // Watch for global month change
        watch(currentMonth, (newVal) => {
            localStorage.setItem('selected_month', newVal);
            initCharts();
        });

        // Watch for global filter change
        watch(globalFilter, () => {
            initCharts();
        }, { deep: true });
        // 课消数据 (1-9月真实数据)
        const consumptionData = {
            linan: {
                amount: [6054.69, 7660.29, 32732.41, 28201.17, 31528.81, 26835.77, 37130.08, 26835.77, 22050.5],
                hours: [45, 58, 239, 204, 221, 192, 429, 192, 167]
            },
            changhua: {
                amount: [18157.53, 6938.18, 22588.75, 23371.68, 22040.35, 17217.79, 26252.02, 17217.79, 10410.9],
                hours: [189, 74, 258, 264, 238, 180, 552, 180, 102]
            }
        };

        const kpis = reactive({
            // 体验课 KPIs
            exp_students: 128,
            exp_total: 1540,
            exp_conv_rate: 32.5,
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
            })
        });

        // 修改日期判断逻辑，将 2025 年视为“去年”，2026 年视为“本年”
        const isThisYear = (dateStr) => {
            return dateStr && dateStr.startsWith('2026');
        };

        // ECharts instances
        let charts = {};

        const loadDataFromStorage = () => {
            const savedData = localStorage.getItem(`work_data_${currentMonth.value}`);
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    let totalRevenue = 0;
                    let newContracts = 0;
                    let renewContracts = 0;
                    let expStudents = 0;
                    let expEnrollments = 0;

                    Object.values(parsed).forEach(row => {
                        if (!row.parent && row.name !== '汇总') {
                            totalRevenue += Number(row.totalSales || 0);
                            newContracts += Number(row.newStudents || 0);
                            renewContracts += Number(row.renewalStudents || 0);
                            expStudents += Number(row.demoAttendees || 0);
                            expEnrollments += Number(row.demoEnrollments || 0);
                        }
                    });

                    // Update KPIs with real data for the month
                    if (chartFilters.expKpi.dateRange === 'thisMonth') {
                        kpis.exp_students = expStudents;
                        kpis.exp_conv_rate = expStudents > 0 ? ((expEnrollments / expStudents) * 100).toFixed(1) : 0;
                    }
                    
                    if (chartFilters.enrType.dateRange === 'thisMonth') {
                        kpis.enr_revenue = totalRevenue;
                        kpis.enr_total_amount = totalRevenue;
                        kpis.enr_new_contracts = newContracts;
                        kpis.enr_renew_contracts = renewContracts;
                    }
                } catch (e) {
                    console.error('Failed to parse storage data:', e);
                }
            }
        };

        const initCharts = () => {
            loadDataFromStorage();
            if (currentTab.value === 'experience') {
                initExperienceCharts();
            } else {
                initEnrollmentCharts();
            }
        };

        const initExperienceCharts = async () => {
            await nextTick();
            
            // Update KPIs based on filter
            if (chartFilters.expKpi.dateRange === 'thisYear') {
                kpis.exp_students = isThisYear(currentMonth.value) ? 0 : 128;
                kpis.exp_total = isThisYear(currentMonth.value) ? 0 : 1540;
                kpis.exp_conv_rate = isThisYear(currentMonth.value) ? 0 : 32.5;
            } else {
                kpis.exp_students = 12;
                kpis.exp_total = 1540;
                kpis.exp_conv_rate = 28.5;
            }

            // Helper to get or init chart
            const getChart = (id) => {
                let chart = echarts.getInstanceByDom(document.getElementById(id));
                if (!chart) chart = echarts.init(document.getElementById(id));
                return chart;
            };

            // 1. Grade Distribution
            const gradeChart = getChart('gradeChart');
            const selGradeCampus = chartFilters.grade.campus;
            const gradeData = {
                'all': [45, 32, 28, 15, 8, 5, 2],
                '临安校区': [25, 18, 15, 8, 5, 3, 1],
                '昌化校区': [20, 14, 13, 7, 3, 2, 1]
            };
            gradeChart.setOption({
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: { type: 'value', splitLine: { show: false } },
                yAxis: { type: 'category', data: ['幼儿园', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级'] },
                series: [{
                    name: '学员数',
                    type: 'bar',
                    data: gradeData[selGradeCampus] || gradeData['all'],
                    itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] }
                }]
            });
            charts.gradeChart = gradeChart;

            // 2. Source Chart
            const sourceChart = getChart('sourceChart');
            const isSourceYear = chartFilters.source.dateRange === 'thisYear';
            const sourceData = isSourceYear ? [
                { name: '地推', value: 40 },
                { name: '转介绍', value: 35 },
                { name: '线上广告', value: 20 },
                { name: '异业合作', value: 15 },
                { name: '自然进店', value: 10 }
            ] : [
                { name: '地推', value: 5 },
                { name: '转介绍', value: 4 },
                { name: '线上广告', value: 2 },
                { name: '异业合作', value: 1 },
                { name: '自然进店', value: 1 }
            ];
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

            // 3. Gender Chart
            const genderChart = getChart('genderChart');
            const selGenderCampus = chartFilters.gender.campus;
            const genderDataMap = {
                'all': [{ value: 68, name: '男宝' }, { value: 60, name: '女宝' }],
                '临安校区': [{ value: 38, name: '男宝' }, { value: 32, name: '女宝' }],
                '昌化校区': [{ value: 30, name: '男宝' }, { value: 28, name: '女宝' }]
            };
            const currentGenderData = genderDataMap[selGenderCampus] || genderDataMap['all'];
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
                        { value: currentGenderData[0].value, name: '男宝', itemStyle: { color: '#60a5fa' } },
                        { value: currentGenderData[1].value, name: '女宝', itemStyle: { color: '#f472b6' } }
                    ]
                }]
            });
            charts.genderChart = genderChart;

            // 4. Funnel Chart
            const funnelChart = getChart('funnelChart');
            const selFunnelTeacher = chartFilters.funnel.teacher;
            // Mock data for funnel based on teacher
            const funnelDataMap = {
                'all': [100, 75, 32.5],
                '小花老师': [100, 80, 40],
                '小草老师': [100, 70, 25],
                '桃子老师': [100, 85, 45],
                '柚子老师': [100, 65, 20]
            };
            const fData = funnelDataMap[selFunnelTeacher] || funnelDataMap['all'];
            funnelChart.setOption({
                tooltip: { trigger: 'item', formatter: "{a} <br/>{b} : {c}%" },
                legend: { data: ['已邀约', '已体验', '已报课'], bottom: 0 },
                series: [{
                    name: '转化漏斗',
                    type: 'funnel',
                    left: '10%', top: 20, bottom: 60, width: '80%',
                    min: 0, max: 100,
                    minSize: '0%', maxSize: '100%',
                    sort: 'descending', gap: 2,
                    label: { show: true, position: 'inside' },
                    labelLine: { length: 10, lineStyle: { width: 1, type: 'solid' } },
                    itemStyle: { borderColor: '#fff', borderWidth: 1 },
                    emphasis: { label: { fontSize: 20 } },
                    data: [
                        { value: fData[0], name: '已邀约', itemStyle: { color: '#94a3b8' } },
                        { value: fData[1], name: '已体验', itemStyle: { color: '#60a5fa' } },
                        { value: fData[2], name: '已报课', itemStyle: { color: '#3b82f6' } }
                    ]
                }]
            });
            charts.funnelChart = funnelChart;

            // 5. Teacher Exp Chart
            const teacherExpChart = getChart('teacherExpChart');
            const isTeacherYear = chartFilters.teacherExp.dateRange === 'thisYear';
            const teacherExpData = isTeacherYear ? {
                amounts: [212391.3, 173553.0, 114519.2, 108938.3],
                rates: [34.9, 28.5, 18.8, 17.9]
            } : {
                amounts: [21000, 15000, 11000, 10500],
                rates: [36.5, 26.1, 19.1, 18.3]
            };
            teacherExpChart.setOption({
                tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
                legend: { data: ['个人业绩', '业绩占比'], bottom: 0 },
                xAxis: { type: 'category', data: ['桃子老师', '小草老师', '柚子老师', '小花老师'] },
                yAxis: [
                    { type: 'value', name: '金额', min: 0 },
                    { type: 'value', name: '占比', min: 0, max: 100, axisLabel: { formatter: '{value}%' } }
                ],
                series: [
                    { name: '个人业绩', type: 'bar', data: teacherExpData.amounts, itemStyle: { color: '#3b82f6' } },
                    { name: '业绩占比', type: 'line', yAxisIndex: 1, data: teacherExpData.rates, itemStyle: { color: '#f59e0b' } }
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
                    .filter(item => item.报课时间.startsWith(monthStr) && (selTrendCampus === 'all' || item.所在校区 === selTrendCampus))
                    .reduce((sum, item) => sum + (Number(item.归属业绩金额) || 0), 0);
            });

            revenueTrendChart.setOption({
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
            const newTotal = filteredEnrollmentDetails.value
                .filter(item => item.报课属性.includes('新报'))
                .reduce((sum, item) => sum + (Number(item.归属业绩金额) || 0), 0);
            const renewTotal = filteredEnrollmentDetails.value
                .filter(item => item.报课属性.includes('续费'))
                .reduce((sum, item) => sum + (Number(item.归属业绩金额) || 0), 0);

            enrTypeChart.setOption({
                tooltip: { trigger: 'item' },
                legend: { bottom: '0', left: 'center' },
                series: [{
                    type: 'pie',
                    radius: '60%',
                    data: [
                        { value: newTotal, name: '新报及专项', itemStyle: { color: '#10b981' } },
                        { value: renewTotal, name: '续费', itemStyle: { color: '#3b82f6' } }  
                    ],
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
                    campusMap[item.所在校区] = (campusMap[item.所在校区] || 0) + Number(item.归属业绩金额);
                });
                rankingData.labels = Object.keys(campusMap);
                rankingData.values = Object.values(campusMap);
            } else {
                const teacherMap = {};
                filteredEnrollmentDetails.value.forEach(item => {
                    teacherMap[item.业绩归属人] = (teacherMap[item.业绩归属人] || 0) + Number(item.归属业绩金额);
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
                const monthData = enrollmentDetails.value.filter(item => item.报课时间.startsWith(monthStr));
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

            // 5. Consumption Chart (消课数据 - Keep Mock as it's not in the file)
            const consumptionChart = getChart('consumptionChart');
            const cMonths = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月'];
            const selCampus = chartFilters.consumption.campus;
            
            let cAmount, cHours;
            if (selCampus === 'all') {
                cAmount = consumptionData.linan.amount.map((v, i) => v + consumptionData.changhua.amount[i]);
                cHours = consumptionData.linan.hours.map((v, i) => v + consumptionData.changhua.hours[i]);
            } else if (selCampus === '临安校区') {
                cAmount = consumptionData.linan.amount;
                cHours = consumptionData.linan.hours;
            } else {
                cAmount = consumptionData.changhua.amount;
                cHours = consumptionData.changhua.hours;
            }

            consumptionChart.setOption({
                tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
                legend: { data: ['消课金额', '消课课时', '课消率'], bottom: 0 },
                grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
                xAxis: { type: 'category', data: cMonths },
                yAxis: [
                    { type: 'value', name: '金额 (¥)', position: 'left' },
                    { type: 'value', name: '课时', position: 'right' },
                    { type: 'value', name: '课消率', position: 'right', offset: 50, axisLabel: { formatter: '{value}%' }, max: 100 }
                ],
                series: [
                    { name: '消课金额', type: 'line', smooth: true, data: cAmount, itemStyle: { color: '#3b82f6' } },
                    { name: '消课课时', type: 'bar', yAxisIndex: 1, data: cHours, itemStyle: { color: '#94a3b8', opacity: 0.6 } },
                    { 
                        name: '课消率', type: 'line', yAxisIndex: 2, 
                        data: cAmount.map(v => (v / 80000 * 100).toFixed(1)), 
                        itemStyle: { color: '#ef4444' } 
                    }
                ]
            });
            charts.consumptionChart = consumptionChart;

            // 6. Campus Performance Chart (Calculated from real data)
            const campusPerfChart = getChart('campusPerfChart');
            
            const campusList = ['临安校区', '昌化校区'];
            const campusNewValues = campusList.map(c => {
                return filteredEnrollmentDetails.value
                    .filter(item => item.所在校区 === c && item.报课属性.includes('新报'))
                    .reduce((sum, item) => sum + (Number(item.归属业绩金额) || 0), 0);
            });
            const campusRenewValues = campusList.map(c => {
                return filteredEnrollmentDetails.value
                    .filter(item => item.所在校区 === c && item.报课属性.includes('续费'))
                    .reduce((sum, item) => sum + (Number(item.归属业绩金额) || 0), 0);
            });

            campusPerfChart.setOption({
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                legend: { data: ['新签金额', '续费金额'], bottom: 0 },
                xAxis: { type: 'category', data: campusList },
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
        watch(() => chartFilters.ranking.dateRange, () => {
            if (currentTab.value === 'enrollment') initEnrollmentCharts();
        });
        watch(() => chartFilters.consumption.campus, () => {
            if (currentTab.value === 'enrollment') initEnrollmentCharts();
        });
        watch(() => chartFilters.revenueTrend.campus, () => {
            if (currentTab.value === 'enrollment') initEnrollmentCharts();
        });
        watch(() => chartFilters.aov.campus, () => {
            if (currentTab.value === 'enrollment') initEnrollmentCharts();
        });
        watch(() => chartFilters.campusPerf.dateRange, () => {
            if (currentTab.value === 'enrollment') initEnrollmentCharts();
        });
        watch(() => chartFilters.enrType.dateRange, () => {
            if (currentTab.value === 'enrollment') initEnrollmentCharts();
        });
        
        // Experience filters
        watch(() => chartFilters.expKpi.dateRange, () => {
            if (currentTab.value === 'experience') initExperienceCharts();
        });
        watch(() => chartFilters.source.dateRange, () => {
            if (currentTab.value === 'experience') initExperienceCharts();
        });
        watch(() => chartFilters.teacherExp.dateRange, () => {
            if (currentTab.value === 'experience') initExperienceCharts();
        });
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
        });

        return {
            currentTab, enrSearch, filteredEnrollmentDetails, globalFilter, showImport, importing, importProgress, parsedData, chartFilters,
            campusList, teacherList, kpis, currentMonth, saveStatus,
            handleExcelUpload, handleImageUpload, clearParsedData, confirmImport,
            addEmptyRow, removeRow
        };
    }
}).mount('#app');

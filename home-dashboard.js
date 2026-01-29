const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

createApp({
    setup() {
        const currentTime = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'));
        const lastUpdateTime = ref(dayjs().format('YYYY/MM/DD HH:mm'));
        const timeRange = ref('year'); // 'year', 'quarter', 'month'
        const selectedYear = ref('2025');

        // Update clock every second
        onMounted(() => {
            setInterval(() => {
                currentTime.value = dayjs().format('YYYY-MM-DD HH:mm:ss');
            }, 1000);
            
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
        watch([timeRange, selectedYear], () => {
            updateDashboardData();
        });

        // Data Source
        const rawEnrollmentData = window.enrollmentDetails2025 || [];
        const rawExperienceData = window.experienceDetails2025 || [];
        const rawConsumptionData = (window.consumptionData2025 || []).filter(i => i.姓名 !== '汇总');

        // Reactive Data
        const enrollmentData = ref([...rawEnrollmentData]);
        const experienceData = ref([...rawExperienceData]);
        const consumptionData = ref([...rawConsumptionData]);

        const updateDashboardData = () => {
            // Logic to filter data based on timeRange and selectedYear
            // For now, keeping all 2025 data as we are in 2025 context
            // In a real app, this would filter raw data by date
            initCharts();
        };

        // KPIs Calculation
        const kpis = reactive({
            active_students: computed(() => 120 + [...new Set(enrollmentData.value.map(i => i.学员姓名))].length),
            new_enrollments: computed(() => enrollmentData.value.filter(i => i.报课属性 === '新报').length),
            total_history: 2800,
            leads_count: computed(() => experienceData.value.length + 450),
            new_leads: computed(() => experienceData.value.length),
            follow_ups: 12800,
            lead_to_exp_rate: computed(() => {
                const totalLeads = experienceData.value.length + 450;
                return totalLeads > 0 ? ((experienceData.value.filter(i => i.状态 !== '未体验').length / totalLeads) * 100).toFixed(1) : 0;
            }),
            exp_invited: computed(() => experienceData.value.length),
            exp_attended: computed(() => experienceData.value.filter(i => i.状态 === '已体验' || i.状态 === '已报课').length),
            exp_enrolled: computed(() => experienceData.value.filter(i => i.状态 === '已报课').length),
            total_revenue: computed(() => enrollmentData.value.reduce((sum, i) => sum + (Number(i.归属业绩金额) || 0), 0)),
            order_count: computed(() => enrollmentData.value.length),
            total_consumption_count: computed(() => consumptionData.value.reduce((sum, i) => sum + (Number(i.消课课时) || 0), 0)),
            total_consumption_amount: computed(() => consumptionData.value.reduce((sum, i) => sum + (Number(i.消课金额) || 0), 0)),
        });

        const latestEnrollmentMsg = computed(() => {
            const data = enrollmentData.value;
            if (data.length === 0) return "暂无最新动态";
            const latest = data[0];
            return `${latest.所在校校区 || latest.所在校区} ${latest.学员姓名} 成功签约 ${latest.报课属性}课程 (${latest.归属业绩金额}元)！`;
        });

        const formatNumber = (num) => {
            return new Intl.NumberFormat().format(Math.round(num));
        };

        const campusRankings = computed(() => {
            const map = {};
            enrollmentData.value.forEach(item => {
                const campus = item.所在校区 || '未知校区';
                map[campus] = (map[campus] || 0) + (Number(item.归属业绩金额) || 0);
            });
            return Object.entries(map)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);
        });

        const consumptionRankings = computed(() => {
            const map = {};
            consumptionData.value.forEach(item => {
                if (!map[item.校区]) map[item.校区] = { count: 0, amount: 0 };
                map[item.校区].count += Number(item.消课课时) || 0;
                map[item.校区].amount += Number(item.消课金额) || 0;
            });
            return Object.entries(map)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.amount - a.amount);
        });

        const charts = [];

        const initCharts = () => {
            // Dispose existing charts
            charts.forEach(chart => chart.dispose());
            charts.length = 0;

            // Generate 12 months for 2025 to fill the width
            const months = Array.from({length: 12}, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`);
            const monthLabels = months.map(m => m.split('-')[1] + '月');
            
            // 1. Active Students Line Chart
            const activeChart = echarts.init(document.getElementById('activeStudentChart'));
            // Mocking trend for 12 months
            const activeData = [820, 932, 901, 934, 1290, 1330, 1320, 1380, 1450, 1500, 1520, 1580];
            activeChart.setOption(getLineAreaOption(monthLabels, activeData, '#00d2ff'));
            charts.push(activeChart);

            // 2. Leads Line Chart
            const leadsChart = echarts.init(document.getElementById('leadsChart'));
            const leadsData = [420, 532, 601, 534, 790, 820, 850, 810, 880, 920, 950, 980];
            leadsChart.setOption(getLineAreaOption(monthLabels, leadsData, '#00f2fe'));
            charts.push(leadsChart);

            // 3. Conversion Funnel (Enhanced)
            const funnelChart = echarts.init(document.getElementById('conversionFunnel'));
            funnelChart.setOption({
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
                        { value: 100, name: '邀约' },
                        { value: 75, name: '体验' },
                        { value: 45, name: '报课' }
                    ].map((d, i) => ({...d, itemStyle: { color: i === 0 ? '#3a7bd5' : i === 1 ? '#00d2ff' : '#00f2fe' }}))
                }]
            });
            charts.push(funnelChart);

            // 4. Revenue Trend (Combination Chart: Bar + Line)
            const revenueChart = echarts.init(document.getElementById('revenueTrendChart'));
            const revenueValues = months.map(m => enrollmentData.value.filter(i => i.报课时间.startsWith(m)).reduce((s, i) => s + (Number(i.归属业绩金额) || 0), 0));
            const targetValues = revenueValues.map((v, i) => (v > 0 ? v * 1.1 : 50000 + i * 2000)); // Mock target if no data
            
            revenueChart.setOption({
                tooltip: { 
                    trigger: 'axis', 
                    axisPointer: { type: 'shadow' },
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderColor: '#334155',
                    textStyle: { color: '#fff' }
                },
                legend: { data: ['实际收入', '目标额'], textStyle: { color: '#94a3b8' }, top: 0 },
                grid: { left: '3%', right: '3%', bottom: '5%', containLabel: true },
                xAxis: { 
                    type: 'category', 
                    data: monthLabels, 
                    axisLine: { lineStyle: { color: '#475569' } },
                    axisLabel: { color: '#94a3b8', fontSize: 10 }
                },
                yAxis: { 
                    type: 'value', 
                    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
                    axisLabel: { color: '#94a3b8', fontSize: 10 }
                },
                series: [
                    {
                        name: '实际收入',
                        type: 'bar',
                        data: revenueValues,
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: '#00d2ff' },
                                { offset: 1, color: '#3a7bd5' }
                            ]),
                            borderRadius: [4, 4, 0, 0]
                        },
                        barWidth: '40%'
                    },
                    {
                        name: '目标额',
                        type: 'line',
                        data: targetValues,
                        smooth: true,
                        lineStyle: { color: '#f43f5e', width: 2, type: 'dashed' },
                        itemStyle: { color: '#f43f5e' },
                        symbol: 'circle',
                        symbolSize: 6
                    }
                ]
            });
            charts.push(revenueChart);

            // 5. Enrollment Ratio (Ring with center info)
            const ratioChart = echarts.init(document.getElementById('enrollmentRatioChart'));
            const newCount = enrollmentData.value.filter(i => i.报课属性 === '新报').length;
            const renewCount = enrollmentData.value.filter(i => i.报课属性 === '续费').length;
            ratioChart.setOption({
                title: {
                    text: '总计\n' + (newCount + renewCount),
                    left: 'center', top: 'center',
                    textStyle: { color: '#fff', fontSize: 14, lineHeight: 20 }
                },
                series: [{
                    type: 'pie',
                    radius: ['60%', '80%'],
                    avoidLabelOverlap: false,
                    label: { show: false },
                    emphasis: { label: { show: false } },
                    data: [
                        { value: newCount, name: '新签', itemStyle: { color: '#00d2ff' } },
                        { value: renewCount, name: '续费', itemStyle: { color: '#3a7bd5' } }
                    ]
                }]
            });
            charts.push(ratioChart);

            // 6. Consumption Trend Line Chart
            const consChart = echarts.init(document.getElementById('consumptionChart'));
            const consData = [12000, 15000, 18000, 14000, 21000, 22000, 23000, 21500, 24000, 25000, 26000, 28000];
            consChart.setOption(getLineAreaOption(monthLabels, consData, '#a855f7'));
            charts.push(consChart);

            // 7. Small Progress Charts
            ['bindRateChart', 'commentRateChart', 'taskRateChart', 'noticeRateChart'].forEach((id, idx) => {
                const chartElement = document.getElementById(id);
                if (chartElement) {
                    const chart = echarts.init(chartElement);
                    const values = [36, 72, 82, 48];
                    const colors = ['#00d2ff', '#00f2fe', '#3b82f6', '#f43f5e'];
                    chart.setOption(getSmallRingOption(values[idx], colors[idx]));
                    charts.push(chart);
                }
            });

            // Force resize after a short delay to ensure they fill the container
            setTimeout(() => {
                charts.forEach(chart => chart.resize());
            }, 200);
        };

        const getLineAreaOption = (xAxisData, seriesData, color) => ({
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

        return {
            currentTime,
            lastUpdateTime,
            timeRange,
            selectedYear,
            kpis,
            latestEnrollmentMsg,
            formatNumber,
            campusRankings,
            consumptionRankings
        };
    }
}).mount('#app');

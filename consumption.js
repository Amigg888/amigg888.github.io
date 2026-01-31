const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

createApp({
    setup() {
        const consumptionData = [...(window.consumptionData2025 || []), ...(window.consumptionData2026 || [])];
        const globalFilter = reactive({
            type: 'year',
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

        const searchQuery = ref('');
        const charts = {};

        // Base filtering logic
        const filteredData = computed(() => {
            let data = consumptionData.filter(item => item.姓名 !== '汇总');
            if (globalFilter.type === 'year') {
                return data.filter(item => item.月份.startsWith(globalFilter.year));
            } else {
                return data.filter(item => item.月份 === globalFilter.month);
            }
        });

        // Search filtering for table
        const filteredTableData = computed(() => {
            let data = filteredData.value;
            if (!searchQuery.value) return data;
            const s = searchQuery.value.toLowerCase();
            return data.filter(item => item.姓名.toLowerCase().includes(s));
        });

        // KPI calculations
        const kpis = computed(() => {
            const data = filteredData.value;
            const total_hours = data.reduce((sum, item) => sum + (item.消课课时 || 0), 0);
            const total_amount = data.reduce((sum, item) => sum + (item.消课金额 || 0), 0);
            const one_on_one_count = data.reduce((sum, item) => sum + (item.一对一人次 || 0), 0);
            const attendance = data.reduce((sum, item) => sum + (item.出勤人次 || 0), 0);
            const total_possible = attendance + data.reduce((sum, item) => sum + (item.请假人次 || 0) + (item.缺勤人次 || 0), 0);
            const attendance_rate = total_possible > 0 ? ((attendance / total_possible) * 100).toFixed(1) : 0;

            return {
                total_hours,
                total_amount,
                one_on_one_count,
                attendance_rate
            };
        });

        const initCharts = () => {
            const getChart = (id) => {
                const el = document.getElementById(id);
                if (!el) return null;
                if (charts[id]) charts[id].dispose();
                return echarts.init(el);
            };

            // 1. Teacher Rank Chart
            const teacherRankChart = getChart('teacherRankChart');
            if (teacherRankChart) {
                const teacherData = {};
                filteredData.value.forEach(item => {
                    teacherData[item.姓名] = (teacherData[item.姓名] || 0) + (item.消课课时 || 0);
                });
                const sorted = Object.entries(teacherData).sort((a, b) => b[1] - a[1]);
                
                teacherRankChart.setOption({
                    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                    xAxis: { type: 'value' },
                    yAxis: { type: 'category', data: sorted.map(d => d[0]).reverse() },
                    series: [{
                        name: '消课课时',
                        type: 'bar',
                        data: sorted.map(d => d[1]).reverse(),
                        itemStyle: { color: '#6366f1', borderRadius: [0, 4, 4, 0] }
                    }]
                });
                charts.teacherRankChart = teacherRankChart;
            }

            // 2. Trend Chart
            const trendChart = getChart('trendChart');
            if (trendChart) {
                const monthlyData = {};
                // We need all months from the data even if not in current filter for trend
                consumptionData.filter(item => item.姓名 !== '汇总').forEach(item => {
                    monthlyData[item.月份] = (monthlyData[item.月份] || 0) + (item.消课课时 || 0);
                });
                const months = Object.keys(monthlyData).sort();

                trendChart.setOption({
                    tooltip: { trigger: 'axis' },
                    xAxis: { type: 'category', data: months.map(m => m.split('-')[1] + '月') },
                    yAxis: { type: 'value' },
                    series: [{
                        name: '消课课时',
                        data: months.map(m => monthlyData[m]),
                        type: 'line',
                        smooth: true,
                        areaStyle: { color: 'rgba(99, 102, 241, 0.1)' },
                        lineStyle: { color: '#6366f1', width: 3 }
                    }]
                });
                charts.trendChart = trendChart;
            }

            // 3. Composition Chart
            const compositionChart = getChart('compositionChart');
            if (compositionChart) {
                const hours = filteredData.value.reduce((sum, item) => sum + (item.消课课时 || 0), 0);
                const oneOnOne = filteredData.value.reduce((sum, item) => sum + (item.一对一人次 || 0), 0);

                compositionChart.setOption({
                    tooltip: { trigger: 'item' },
                    legend: { bottom: '0', left: 'center' },
                    series: [{
                        type: 'pie',
                        radius: ['40%', '70%'],
                        avoidLabelOverlap: false,
                        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
                        label: { show: false },
                        data: [
                            { value: hours, name: '消课课时', itemStyle: { color: '#6366f1' } },
                            { value: oneOnOne, name: '一对一人次', itemStyle: { color: '#3b82f6' } }
                        ]
                    }]
                });
                charts.compositionChart = compositionChart;
            }

            // 4. Attendance Chart
            const attendanceChart = getChart('attendanceChart');
            if (attendanceChart) {
                const teacherAttendance = {};
                filteredData.value.forEach(item => {
                    if (!teacherAttendance[item.姓名]) {
                        teacherAttendance[item.姓名] = { attendance: 0, leave: 0, absence: 0 };
                    }
                    teacherAttendance[item.姓名].attendance += item.出勤人次;
                    teacherAttendance[item.姓名].leave += item.请假人次;
                    teacherAttendance[item.姓名].absence += item.缺勤人次;
                });
                const teachers = Object.keys(teacherAttendance);

                attendanceChart.setOption({
                    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                    legend: { data: ['出勤', '请假', '缺勤'], bottom: 0 },
                    xAxis: { type: 'category', data: teachers },
                    yAxis: { type: 'value' },
                    series: [
                        { name: '出勤', type: 'bar', stack: 'total', data: teachers.map(t => teacherAttendance[t].attendance), itemStyle: { color: '#10b981' } },
                        { name: '请假', type: 'bar', stack: 'total', data: teachers.map(t => teacherAttendance[t].leave), itemStyle: { color: '#f59e0b' } },
                        { name: '缺勤', type: 'bar', stack: 'total', data: teachers.map(t => teacherAttendance[t].absence), itemStyle: { color: '#ef4444' } }
                    ]
                });
                charts.attendanceChart = attendanceChart;
            }
        };

        watch([filteredData, globalFilter], () => {
            nextTick(() => initCharts());
        }, { deep: true });

        onMounted(() => {
            initCharts();
            window.addEventListener('resize', () => {
                Object.values(charts).forEach(chart => chart && chart.resize());
            });
        });

        return {
            globalFilter,
            showDatePicker,
            pickerTempYear,
            selectYear,
            selectMonth,
            searchQuery,
            filteredTableData,
            kpis,
            initCharts
        };
    }
}).mount('#app');

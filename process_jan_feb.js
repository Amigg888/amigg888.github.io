
const fs = require('fs');
const path = require('path');

// Mock window object to capture data from .js files
global.window = {};

function loadData(filename) {
    const content = fs.readFileSync(path.join('/Users/mima0000/Library/Mobile Documents/com~apple~CloudDocs/仪表盘', filename), 'utf8');
    // Remove "window.xxx =" and trailing ";" to evaluate as JS
    const code = content.replace(/window\.\w+\s*=\s*/, 'global.data = ').replace(/;?$/, '');
    eval(code);
    return global.data;
}

const enrollmentData = loadData('data-2025.js');
const experienceData = loadData('data-experience-2025.js');
const consumptionData = loadData('data-consumption-2025.js');

const teachers = ['小花老师', '桃子老师', '柚子老师', '小草老师', '杨老师', '琪琪老师'];
const months = ['2025-01', '2025-02'];

const results = {};

months.forEach(month => {
    const monthData = {
        '小花老师': { name: '小花老师', isSummary: true, children: ['xh_la', 'xh_ch'] },
        'xh_la': { id: 'xh_la', name: '临安校区', parent: '小花老师' },
        'xh_ch': { id: 'xh_ch', name: '昌化校区', parent: '小花老师' },
        'tz': { id: 'tz', name: '桃子老师' },
        'yz': { id: 'yz', name: '柚子老师' },
        'xc': { id: 'xc', name: '小草老师', isTeachingDisabled: true },
        'yl': { id: 'yl', name: '杨老师' },
        'qq': { id: 'qq', name: '琪琪老师' }
    };

    // Initialize metrics
    const columns = [
        'demoInvites', 'demoAttendees', 'demoEnrollments', 
        'regularHours', 'oneOnOneAttendees', 'oneOnOneAmount',
        'newStudents', 'newSales', 'renewalStudents', 'renewalSales',
        'attendance', 'absence', 'leave', 'makeup'
    ];

    Object.values(monthData).forEach(row => {
        columns.forEach(col => row[col] = 0);
    });

    // Helper to map teacher name to record ID
    const getTeacherId = (name, campus) => {
        if (name === '小花老师') return campus === '临安校区' ? 'xh_la' : 'xh_ch';
        if (name === '桃子老师') return 'tz';
        if (name === '柚子老师') return 'yz';
        if (name === '小草老师') return 'xc';
        if (name === '杨老师') return 'yl';
        if (name === '琪琪老师') return 'qq';
        return null;
    };

    // 1. Process Enrollment
    enrollmentData.forEach(item => {
        if (item.报课时间 && item.报课时间.startsWith(month)) {
            const id = getTeacherId(item.业绩归属人, item.所在校区);
            if (id && monthData[id]) {
                const isNew = item.报课属性.includes('新报');
                const isRenew = item.报课属性.includes('续费');
                if (isNew) {
                    monthData[id].newStudents += 1;
                    monthData[id].newSales += Number(item.归属业绩金额 || 0);
                } else if (isRenew) {
                    monthData[id].renewalStudents += 1;
                    monthData[id].renewalSales += Number(item.归属业绩金额 || 0);
                }
            }
        }
    });

    // 2. Process Experience
    experienceData.forEach(item => {
        if (item.体验课时间 && item.体验课时间.startsWith(month)) {
            const id = getTeacherId(item.邀约老师, item.所在校区);
            if (id && monthData[id]) {
                monthData[id].demoInvites += 1;
                if (item.状态 === '已体验' || item.状态 === '已报课') {
                    monthData[id].demoAttendees += 1;
                }
                if (item.状态 === '已报课') {
                    monthData[id].demoEnrollments += 1;
                }
            }
        }
    });

    // 3. Process Consumption
    consumptionData.forEach(item => {
        if (item.月份 === month && item.姓名 !== '汇总') {
            const id = getTeacherId(item.姓名, item.校区);
            if (id && monthData[id]) {
                monthData[id].regularHours += Number(item.消课课时 || 0);
                monthData[id].oneOnOneAttendees += Number(item.一对一人次 || 0);
                monthData[id].oneOnOneAmount += Number(item.消课金额 || 0); // Assuming total amount as one-on-one if field missing
                monthData[id].attendance += Number(item.出勤人次 || 0);
                monthData[id].absence += Number(item.缺勤人次 || 0);
                monthData[id].leave += Number(item.请假人次 || 0);
                monthData[id].makeup += Number(item.补课人次 || 0);
            }
        }
    });

    // Update Summary for 小花老师
    const xh_summary = monthData['小花老师'];
    ['xh_la', 'xh_ch'].forEach(childId => {
        columns.forEach(col => {
            xh_summary[col] += monthData[childId][col];
        });
    });

    results[month] = monthData;
});

console.log(JSON.stringify(results, null, 2));

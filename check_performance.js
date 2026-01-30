
const fs = require('fs');
const content = fs.readFileSync('/Users/mima0000/Library/Mobile Documents/com~apple~CloudDocs/仪表盘/data-2025.js', 'utf8');
const jsonStr = content.replace('window.enrollmentDetails2025 = ', '').replace(/;$/, '');
const data = JSON.parse(jsonStr);

const result = {};

data.forEach(item => {
    const month = item['报课时间'].substring(0, 7);
    const teacher = item['业绩归属人'];
    const campus = item['所在校区'];
    const amount = Number(item['归属业绩金额'] || 0);
    const type = item['报课属性'] === '续费' ? 'renewal' : 'new';

    if (!result[month]) result[month] = {};
    if (!result[month][teacher]) result[month][teacher] = { new: 0, renewal: 0, campuses: {} };
    
    result[month][teacher][type] += amount;
    
    if (!result[month][teacher].campuses[campus]) result[month][teacher].campuses[campus] = { new: 0, renewal: 0 };
    result[month][teacher].campuses[campus][type] += amount;
});

console.log(JSON.stringify(result, null, 2));

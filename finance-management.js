console.log('Finance Management script loading...');

const initApp = () => {
    console.log('Finance Management initApp starting...');
    if (typeof Vue === 'undefined') {
        console.error('Vue is not loaded!');
        return;
    }
    const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

    createApp({
        setup() {
            const currentUser = ref(JSON.parse(localStorage.getItem('user')) || { role: 'admin', name: '总管理员', username: 'sendo' });
            const isMobileMenuOpen = ref(false);
            const activeTab = ref('salary');
            const currentMonth = ref(localStorage.getItem('selected_month') || '2026-01');
            const showDatePicker = ref(false);
            const pickerTempYear = ref(currentMonth.value.split('-')[0]);

            const tabs = [
                { key: 'salary', label: '月度工资', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>' },
                { key: 'socialSecurity', label: '社保成本', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>' },
                { key: 'advance', label: '垫付录入', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>' },
                { key: 'reimbursement', label: '报销管理', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"></path></svg>' }
            ];

            const salaryData = reactive({});
            const socialSecurityData = reactive({});
            const advanceRecords = ref([]);
            const reimbursementRecords = ref([]);

            const showAdvanceModal = ref(false);
            const showReimbursementModal = ref(false);

            const newAdvance = reactive({
                reason: '',
                amount: 0,
                date: dayjs().format('YYYY-MM-DD'),
                attachment: null
            });

            const newReimbursement = reactive({
                reason: '',
                amount: 0,
                date: dayjs().format('YYYY-MM-DD'),
                attachment: null
            });

            const socialSecurityRates = {
                pension: { personal: 0.08, company: 0.16 },
                medical: { personal: 0.02, company: 0.08 },
                unemployment: { personal: 0.005, company: 0.005 },
                workInjury: { company: 0.004 },
                maternity: { company: 0.008 }
            };

            const socialSecurityBase = 5000;

            const baseSalaryMap = {
                'xh_la': 2000,
                'xh_ch': 2000,
                'tz': 3500,
                'yz': 3200,
                'xc': 3500
            };

            const socialSecurityMap = {
                '小花老师': 523.53,
                'xh_la': 261.77,
                'xh_ch': 261.77,
                'tz': 523.53,
                'yz': 523.53,
                'xc': 523.53
            };

            const selectMonth = (year, month) => {
                currentMonth.value = `${year}-${String(month).padStart(2, '0')}`;
                showDatePicker.value = false;
                initData();
            };

            const formatMoney = (val) => {
                const num = Number(val || 0);
                return num.toFixed(2);
            };

            const initData = async () => {
                await loadSalaryData();
                calculateSocialSecurity();
            };

            const loadSalaryData = async () => {
                const year = currentMonth.value.split('-')[0];
                let workData = null;

                try {
                    const serverPort = '3001';
                    const host = window.location.hostname || 'localhost';
                    const serverUrl = window.location.port === serverPort ? '' : `http://${host}:${serverPort}`;
                    const timestamp = new Date().getTime();
                    const response = await fetch(`${serverUrl}/work-data?month=${currentMonth.value}&t=${timestamp}`, {
                        credentials: 'include'
                    });
                    if (response.ok) {
                        const serverData = await response.json();
                        if (serverData && Object.keys(serverData).length > 0) {
                            workData = serverData;
                        }
                    }
                } catch (e) {
                    console.error('从服务器获取工作数据失败:', e);
                }

                if (!workData) {
                    const savedWorkData = localStorage.getItem(`work_data_${currentMonth.value}`);
                    if (savedWorkData) {
                        try {
                            workData = JSON.parse(savedWorkData);
                        } catch (e) {
                            console.error('解析本地工作数据失败:', e);
                        }
                    }
                }

                if (!workData && window.presetWorkHistory && window.presetWorkHistory[currentMonth.value]) {
                    const monthPresets = window.presetWorkHistory[currentMonth.value];
                    if (monthPresets.length > 0) {
                        const latestPreset = [...monthPresets].sort((a, b) => b.timestamp - a.timestamp)[0];
                        workData = latestPreset.data;
                    }
                }

                const manualSaved = localStorage.getItem(`salary_manual_${currentMonth.value}`);
                const manualData = manualSaved ? JSON.parse(manualSaved) : {};

                const consumptionData = year === '2026' ? (window.consumptionData2026 || []) : (window.consumptionData2025 || []);
                const experienceData = year === '2026' ? (window.experienceDetails2026 || []) : (window.experienceDetails2025 || []);
                const enrollmentData = year === '2026' ? (window.enrollmentDetails2026 || []) : (window.enrollmentDetails2025 || []);

                const hasGlobalData = consumptionData.length > 0 || experienceData.length > 0 || enrollmentData.length > 0;

                if (hasGlobalData) {
                    const oldWorkData = workData || {};
                    workData = {};

                    const idConfig = {
                        'xh_la': { name: '小花老师', campus: '临安校区' },
                        'xh_ch': { name: '小花老师', campus: '昌化校区' },
                        'tz': { name: '桃子老师', campus: null },
                        'yz': { name: '柚子老师', campus: null },
                        'xc': { name: '小草老师', campus: null, isTeachingDisabled: true },
                        'qq': { name: '琪琪老师', campus: null, isPartTime: true }
                    };

                    Object.entries(idConfig).forEach(([id, config]) => {
                        const monthStr = currentMonth.value;

                        const inviteExp = experienceData.filter(d => {
                            const dMonth = d.体验课时间 ? d.体验课时间.substring(0, 7) : '';
                            return dMonth === monthStr &&
                                   d.邀约老师 === config.name &&
                                   (!config.campus || d.所在校区 === config.campus);
                        });
                        const demoInvites = inviteExp.length;

                        const teachingExp = experienceData.filter(d => {
                            const dMonth = d.体验课时间 ? d.体验课时间.substring(0, 7) : '';
                            return dMonth === monthStr &&
                                   d.体验课老师 === config.name &&
                                   (!config.campus || d.所在校区 === config.campus);
                        });
                        const demoEnrollments = teachingExp.filter(d => d.状态 === '已报课').length;

                        const teacherCons = consumptionData.filter(d => d.月份 === monthStr && d.姓名 === config.name && (!config.campus || d.校区 === config.campus));
                        const regularHours = teacherCons.reduce((sum, d) => sum + Number(d.消课课时 || 0), 0);
                        const oneOnOneAttendees = teacherCons.reduce((sum, d) => sum + Number(d.一对一人次 || 0), 0);
                        const syncedOneOnOneAmount = teacherCons.reduce((sum, d) => sum + Number(d.一对一金额 || 0), 0);

                        let oneOnOneAmount = syncedOneOnOneAmount;
                        if (oneOnOneAmount === 0 && oldWorkData[id]) {
                            oneOnOneAmount = Number(oldWorkData[id].oneOnOneAmount || 0);
                        }

                        const attendance = teacherCons.reduce((sum, d) => sum + Number(d.出勤人次 || 0), 0);

                        const teacherEnr = enrollmentData.filter(d => {
                            const dMonth = d.报课时间 ? d.报课时间.substring(0, 7) : '';
                            return dMonth === monthStr &&
                                   d.业绩归属人 === config.name &&
                                   (!config.campus || d.所在校区 === config.campus);
                        });
                        const newSales = teacherEnr.filter(d => d.报课属性 === '新报' || d.报课属性 === '新签').reduce((sum, d) => sum + Number(d.实收金额 || 0), 0);
                        const renewalSales = teacherEnr.filter(d => d.报课属性 === '续费').reduce((sum, d) => sum + Number(d.实收金额 || 0), 0);
                        const totalSales = newSales + renewalSales;

                        workData[id] = {
                            id,
                            name: config.name,
                            isTeachingDisabled: config.isTeachingDisabled || false,
                            isPartTime: config.isPartTime || false,
                            demoInvites,
                            demoEnrollments,
                            regularHours,
                            oneOnOneAttendees,
                            oneOnOneAmount,
                            attendance,
                            newSales,
                            renewalSales,
                            totalSales
                        };
                    });
                }

                Object.keys(salaryData).forEach(key => delete salaryData[key]);

                if (workData) {
                    const teachersList = ['xh_la', 'xh_ch', 'tz', 'yz', 'xc', 'qq'];
                    const teacherDisplayNames = {
                        'xh_la': '临安校区',
                        'xh_ch': '昌化校区',
                        'tz': '桃子老师',
                        'yz': '柚子老师',
                        'xc': '小草老师',
                        'qq': '琪琪老师'
                    };

                    teachersList.forEach(id => {
                        if (id === 'qq') {
                            const qiqiId = 'qq';
                            const qiqiWork = workData[qiqiId] || {};
                            const qiqiManual = manualData[qiqiId] || {};

                            const qiqiHours = Number(qiqiWork.classHours || qiqiManual.classHours || 0);
                            const qiqiRate = Number(qiqiWork.hourlyRate || qiqiManual.hourlyRate || 0);
                            const qiqiCommission = qiqiRate * 0.5;

                            salaryData[qiqiId] = {
                                id: qiqiId,
                                name: '琪琪老师',
                                isPartTime: true,
                                classHours: qiqiHours,
                                hourlyRate: qiqiRate,
                                classCommission: qiqiCommission,
                                baseSalary: 0,
                                inviteBonus: 0,
                                conversionBonus: 0,
                                salesCommission: 0,
                                performanceBonus: 0,
                                socialSecurity: 0,
                                adjustments: qiqiWork.adjustments || qiqiManual.adjustments || 0,
                                grossPay: qiqiCommission,
                                netPay: qiqiCommission + Number(qiqiWork.adjustments || qiqiManual.adjustments || 0)
                            };
                            return;
                        }

                        const work = workData[id] || { name: id, demoInvites: 0, demoEnrollments: 0, attendance: 0, totalSales: 0 };
                        const baseSalary = baseSalaryMap[id] || 0;
                        const isTeachingDisabled = work.isTeachingDisabled || false;
                        const inviteBonus = Number(work.demoInvites || 0) * 20;
                        const conversionBonus = isTeachingDisabled ? 0 : Number(work.demoEnrollments || 0) * 50;

                        const regularHours = Number(work.regularHours || 0);
                        let classRate = 10;
                        if (regularHours > 200) classRate = 15;
                        else if (regularHours > 150) classRate = 12;

                        const regularClassCommission = regularHours * classRate;
                        const oneOnOneAmount = Number(work.oneOnOneAmount || 0);
                        const oneOnOneCommission = oneOnOneAmount * 0.3;
                        const classCommission = isTeachingDisabled ? 0 : (regularClassCommission + oneOnOneCommission);

                        const totalSales = Number(work.totalSales || (Number(work.newSales || 0) + Number(work.renewalSales || 0)));
                        let salesRate = 0.03;
                        if (totalSales > 30000) salesRate = 0.07;
                        else if (totalSales > 10000) salesRate = 0.05;
                        const salesCommission = totalSales * salesRate;

                        let performanceBonus = 0;

                        const saved = manualData[id] || {};
                        const existingAdjustments = saved.adjustments || 0;
                        const shouldAttend = saved.shouldAttend !== undefined ? saved.shouldAttend : 26;
                        const actualAttend = saved.actualAttend !== undefined ? saved.actualAttend : 26;

                        let attendanceAdjustedBase = baseSalary;
                        if (shouldAttend > 0 && actualAttend < shouldAttend) {
                            attendanceAdjustedBase = baseSalary - (baseSalary / shouldAttend * (shouldAttend - actualAttend));
                        }

                        const grossPay = attendanceAdjustedBase + inviteBonus + conversionBonus + classCommission + salesCommission + performanceBonus;
                        const socialSecurity = socialSecurityMap[id] || 0;
                        const netPay = grossPay - socialSecurity + Number(existingAdjustments);

                        salaryData[id] = {
                            id,
                            name: teacherDisplayNames[id] || work.name,
                            isTeachingDisabled: work.isTeachingDisabled || false,
                            baseSalary: attendanceAdjustedBase,
                            inviteBonus,
                            conversionBonus,
                            classCommission,
                            salesCommission,
                            performanceBonus,
                            grossPay,
                            socialSecurity,
                            adjustments: existingAdjustments,
                            netPay
                        };
                    });

                    const xh_la = salaryData['xh_la'];
                    const xh_ch = salaryData['xh_ch'];
                    if (xh_la && xh_ch) {
                        const totalAdjustments = Number(xh_la.adjustments || 0) + Number(xh_ch.adjustments || 0);
                        salaryData['小花老师'] = {
                            id: 'xh_total',
                            name: '小花老师',
                            isSummary: true,
                            baseSalary: xh_la.baseSalary + xh_ch.baseSalary,
                            inviteBonus: xh_la.inviteBonus + xh_ch.inviteBonus,
                            conversionBonus: xh_la.conversionBonus + xh_ch.conversionBonus,
                            classCommission: xh_la.classCommission + xh_ch.classCommission,
                            salesCommission: xh_la.salesCommission + xh_ch.salesCommission,
                            performanceBonus: xh_la.performanceBonus + xh_ch.performanceBonus,
                            grossPay: xh_la.grossPay + xh_ch.grossPay,
                            socialSecurity: socialSecurityMap['小花老师'],
                            adjustments: totalAdjustments,
                            netPay: (xh_la.grossPay + xh_ch.grossPay) - socialSecurityMap['小花老师'] + totalAdjustments
                        };
                    }
                }
            };

            const calculateSocialSecurity = () => {
                Object.keys(socialSecurityData).forEach(key => delete socialSecurityData[key]);

                const teacherIds = ['小花老师', 'tz', 'yz', 'xc', 'qq'];

                teacherIds.forEach(id => {
                    const salaryRow = salaryData[id];
                    if (!salaryRow) return;

                    const base = socialSecurityBase;

                    let pension_insurance = 0;
                    let medical_insurance = 0;
                    let unemployment_insurance = 0;
                    let work_injury_insurance = 0;
                    let maternity_insurance = 0;
                    let company_pension = 0;
                    let company_medical = 0;
                    let company_work_injury = 0;
                    let company_maternity = 0;

                    if (id !== 'qq') {
                        pension_insurance = base * socialSecurityRates.pension.personal;
                        medical_insurance = base * socialSecurityRates.medical.personal;
                        unemployment_insurance = base * socialSecurityRates.unemployment.personal;
                        work_injury_insurance = 0;
                        maternity_insurance = 0;

                        company_pension = base * socialSecurityRates.pension.company;
                        company_medical = base * socialSecurityRates.medical.company;
                        company_work_injury = base * socialSecurityRates.workInjury.company;
                        company_maternity = base * socialSecurityRates.maternity.company;
                    }

                    const personalTotal = pension_insurance + medical_insurance + unemployment_insurance;
                    const companyTotal = company_pension + company_medical + company_work_injury + company_maternity;

                    socialSecurityData[id] = {
                        name: salaryRow.name,
                        pension_insurance,
                        medical_insurance,
                        unemployment_insurance,
                        work_injury_insurance,
                        maternity_insurance,
                        personalTotal,
                        company_pension,
                        company_medical,
                        company_work_injury,
                        company_maternity,
                        companyTotal
                    };
                });
            };

            const summaryData = computed(() => {
                let grossPayTotal = 0;
                let socialSecurityTotal = 0;
                let adjustmentsTotal = 0;
                let netPayTotal = 0;
                let companySocialSecurityTotal = 0;
                let employeeCount = 0;

                Object.values(salaryData).forEach(row => {
                    if (row.isSummary) return;
                    grossPayTotal += Number(row.grossPay || 0);
                    socialSecurityTotal += Number(row.socialSecurity || 0);
                    adjustmentsTotal += Number(row.adjustments || 0);
                    netPayTotal += Number(row.netPay || 0);
                    employeeCount++;
                });

                Object.values(socialSecurityData).forEach(row => {
                    companySocialSecurityTotal += Number(row.companyTotal || 0);
                });

                return {
                    grossPayTotal,
                    socialSecurityTotal,
                    adjustmentsTotal,
                    netPayTotal,
                    companySocialSecurityTotal,
                    employeeCount
                };
            });

            const socialSecuritySummary = computed(() => {
                let pension_total = 0;
                let medical_total = 0;
                let unemployment_total = 0;
                let work_injury_total = 0;
                let maternity_total = 0;
                let personal_total = 0;
                let company_pension_total = 0;
                let company_medical_total = 0;
                let company_work_injury_total = 0;
                let company_total = 0;

                Object.values(socialSecurityData).forEach(row => {
                    pension_total += Number(row.pension_insurance || 0);
                    medical_total += Number(row.medical_insurance || 0);
                    unemployment_total += Number(row.unemployment_insurance || 0);
                    work_injury_total += Number(row.work_injury_insurance || 0);
                    maternity_total += Number(row.maternity_insurance || 0);
                    personal_total += Number(row.personalTotal || 0);
                    company_pension_total += Number(row.company_pension || 0);
                    company_medical_total += Number(row.company_medical || 0);
                    company_work_injury_total += Number(row.company_work_injury || 0);
                    company_total += Number(row.companyTotal || 0);
                });

                return {
                    pension_total,
                    medical_total,
                    unemployment_total,
                    work_injury_total,
                    maternity_total,
                    personal_total,
                    company_pension_total,
                    company_medical_total,
                    company_work_injury_total,
                    company_total
                };
            });

            const reimbursementStats = computed(() => {
                let pending = 0;
                let approved = 0;
                let completed = 0;

                reimbursementRecords.value.forEach(record => {
                    if (record.status === 'pending') pending++;
                    else if (record.status === 'approved') approved++;
                    else if (record.status === 'completed') completed++;
                });

                return { pending, approved, completed };
            });

            const loadAdvanceRecords = () => {
                const saved = localStorage.getItem(`advance_records_${currentMonth.value}`);
                advanceRecords.value = saved ? JSON.parse(saved) : [];
            };

            const saveAdvanceRecords = () => {
                localStorage.setItem(`advance_records_${currentMonth.value}`, JSON.stringify(advanceRecords.value));
            };

            const submitAdvance = () => {
                if (!newAdvance.reason || !newAdvance.amount) {
                    alert('请填写完整的垫付信息');
                    return;
                }

                advanceRecords.value.push({
                    reason: newAdvance.reason,
                    amount: Number(newAdvance.amount),
                    date: newAdvance.date,
                    applicant: currentUser.value.name || '管理员',
                    status: 'pending',
                    attachment: newAdvance.attachment
                });

                saveAdvanceRecords();

                newAdvance.reason = '';
                newAdvance.amount = 0;
                newAdvance.date = dayjs().format('YYYY-MM-DD');
                newAdvance.attachment = null;
                showAdvanceModal.value = false;
            };

            const handleAdvanceFileUpload = (event) => {
                const file = event.target.files[0];
                if (file) {
                    newAdvance.attachment = file.name;
                }
            };

            const approveAdvance = (index) => {
                advanceRecords.value[index].status = 'approved';
                saveAdvanceRecords();
            };

            const rejectAdvance = (index) => {
                advanceRecords.value[index].status = 'rejected';
                saveAdvanceRecords();
            };

            const viewAdvanceAttachment = (index) => {
                const record = advanceRecords.value[index];
                if (record.attachment) {
                    alert(`附件：${record.attachment}`);
                } else {
                    alert('暂无附件');
                }
            };

            const loadReimbursementRecords = () => {
                const saved = localStorage.getItem(`reimbursement_records_${currentMonth.value}`);
                reimbursementRecords.value = saved ? JSON.parse(saved) : [];
            };

            const saveReimbursementRecords = () => {
                localStorage.setItem(`reimbursement_records_${currentMonth.value}`, JSON.stringify(reimbursementRecords.value));
            };

            const submitReimbursement = () => {
                if (!newReimbursement.reason || !newReimbursement.amount) {
                    alert('请填写完整的报销信息');
                    return;
                }

                reimbursementRecords.value.push({
                    reason: newReimbursement.reason,
                    amount: Number(newReimbursement.amount),
                    date: newReimbursement.date,
                    applicant: currentUser.value.name || '管理员',
                    status: 'pending',
                    attachment: newReimbursement.attachment
                });

                saveReimbursementRecords();

                newReimbursement.reason = '';
                newReimbursement.amount = 0;
                newReimbursement.date = dayjs().format('YYYY-MM-DD');
                newReimbursement.attachment = null;
                showReimbursementModal.value = false;
            };

            const handleReimbursementFileUpload = (event) => {
                const file = event.target.files[0];
                if (file) {
                    newReimbursement.attachment = file.name;
                }
            };

            const approveReimbursement = (index) => {
                reimbursementRecords.value[index].status = 'approved';
                saveReimbursementRecords();
            };

            const rejectReimbursement = (index) => {
                reimbursementRecords.value[index].status = 'rejected';
                saveReimbursementRecords();
            };

            const viewReimbursementAttachment = (index) => {
                const record = reimbursementRecords.value[index];
                if (record.attachment) {
                    alert(`附件：${record.attachment}`);
                } else {
                    alert('暂无附件');
                }
            };

            const exportFinanceReport = () => {
                if (typeof dayjs === 'undefined') {
                    console.error('Day.js 库未加载，无法导出。');
                    return;
                }

                let csv = '\uFEFF';
                csv += '财务管理报表,' + currentMonth.value + '\n\n';

                csv += '一、月度工资明细\n';
                csv += '姓名,应发工资,社保代扣,其他调整,实发工资\n';
                Object.values(salaryData).forEach(row => {
                    if (!row.isSummary) {
                        csv += `${row.name},${row.grossPay},${row.socialSecurity},${row.adjustments},${row.netPay}\n`;
                    }
                });
                csv += `合计,${summaryData.value.grossPayTotal},${summaryData.value.socialSecurityTotal},${summaryData.value.adjustmentsTotal},${summaryData.value.netPayTotal}\n\n`;

                csv += '二、社保成本明细\n';
                csv += '姓名,养老保险,医疗保险,失业保险,个人合计,公司养老,公司医疗,公司工伤,公司合计\n';
                Object.values(socialSecurityData).forEach(row => {
                    csv += `${row.name},${row.pension_insurance},${row.medical_insurance},${row.unemployment_insurance},${row.personalTotal},${row.company_pension},${row.company_medical},${row.company_work_injury},${row.companyTotal}\n`;
                });
                csv += `合计,${socialSecuritySummary.value.pension_total},${socialSecuritySummary.value.medical_total},${socialSecuritySummary.value.unemployment_total},${socialSecuritySummary.value.personal_total},${socialSecuritySummary.value.company_pension_total},${socialSecuritySummary.value.company_medical_total},${socialSecuritySummary.value.company_work_injury_total},${socialSecuritySummary.value.company_total}\n\n`;

                csv += '三、垫付记录\n';
                csv += '日期,事由,金额,申请人,状态\n';
                advanceRecords.value.forEach(record => {
                    csv += `${record.date},${record.reason},${record.amount},${record.applicant},${record.status === 'pending' ? '待审批' : record.status === 'approved' ? '已批准' : '已拒绝'}\n`;
                });

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `财务报告_${currentMonth.value}_${dayjs().format('YYYYMMDD')}.csv`;
                link.click();
            };

            watch(currentMonth, () => {
                localStorage.setItem('selected_month', currentMonth.value);
                loadAdvanceRecords();
                loadReimbursementRecords();
            });

            onMounted(() => {
                initData();
                loadAdvanceRecords();
                loadReimbursementRecords();
            });

            return {
                currentUser,
                isMobileMenuOpen,
                tabs,
                activeTab,
                currentMonth,
                showDatePicker,
                pickerTempYear,
                selectMonth,
                formatMoney,
                salaryData,
                socialSecurityData,
                summaryData,
                socialSecuritySummary,
                advanceRecords,
                reimbursementRecords,
                reimbursementStats,
                showAdvanceModal,
                showReimbursementModal,
                newAdvance,
                newReimbursement,
                submitAdvance,
                handleAdvanceFileUpload,
                approveAdvance,
                rejectAdvance,
                viewAdvanceAttachment,
                submitReimbursement,
                handleReimbursementFileUpload,
                approveReimbursement,
                rejectReimbursement,
                viewReimbursementAttachment,
                exportFinanceReport
            };
        }
    }).mount('#app');
};

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
import asyncio
from playwright.async_api import async_playwright
import json
import os
from datetime import datetime, timedelta

def excel_date_to_str(excel_date):
    if not excel_date or not isinstance(excel_date, (int, float)):
        return str(excel_date)
    # Excel日期起点是1899-12-30
    dt = datetime(1899, 12, 30) + timedelta(days=float(excel_date))
    return dt.strftime('%Y-%m-%d')

async def sync_online_docs(url):
    async with async_playwright() as p:
        # 使用有头模式进行调试（如果需要）或无头模式
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        print(f"正在打开腾讯文档: {url}")
        # 增加超时时间，等待页面加载
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        
        # 等待文档框架加载完成
        print("等待文档加载渲染...")
        await asyncio.sleep(15)
        
        # 滚动到底部以触发虚拟列表加载更多数据
        async def scroll_to_bottom():
            print("正在滚动页面以确保所有数据已加载...")
            for i in range(5):
                await page.mouse.wheel(0, 2000)
                await asyncio.sleep(1)
        
        await scroll_to_bottom()
        
        extract_js = """
            (sheetId) => {
                try {
                    const wm = window.SpreadsheetApp.workbook.worksheetManager;
                    const s = wm.getSheetBySheetId(sheetId);
                    if (!s) return null;
                    
                    // 确保表格数据网格存在
                    if (!s.cellDataGrid || !s.cellDataGrid._kK) {
                        return null;
                    }
                    
                    const kK = s.cellDataGrid._kK;
                    const rows = [];
                    
                    // 遍历所有数据块
                    for (let i = 0; i < kK.length; i++) {
                        const rowBlocks = kK[i];
                        if (Array.isArray(rowBlocks)) {
                            rowBlocks.forEach(block => {
                                if (block && block._Ao && Array.isArray(block._Ao)) {
                                    block._Ao.forEach(cellArr => {
                                        if (Array.isArray(cellArr)) {
                                            const row = cellArr.map(cell => {
                                                if (!cell) return "";
                                                // 尝试多种属性获取单元格值
                                                let val = cell.m !== undefined ? cell.m : 
                                                         (cell.v !== undefined ? cell.v : 
                                                         (cell.value !== undefined ? cell.value : ""));
                                                
                                                if (typeof val === 'object' && val !== null) {
                                                    val = val.v || val.m || "";
                                                }
                                                return val;
                                            });
                                            // 只要行内有任何非空数据就记录
                                            if (row.some(v => v !== null && v !== undefined && String(v).trim() !== "")) {
                                                rows.push(row);
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    }
                    return rows;
                } catch (e) {
                    return {error: e.message};
                }
            }
        """
        
        # 1. 提取报课数据 (Sheet ID: tz0b9p)
        print("正在提取『报课明细』数据...")
        enrollment_raw = await page.evaluate(extract_js, 'tz0b9p')
        if isinstance(enrollment_raw, dict) and "error" in enrollment_raw:
            print(f"提取报课数据失败: {enrollment_raw['error']}")
            enrollment_raw = []
        
        # 2. 切换标签提取体验数据 (Sheet ID: facejs)
        experience_raw = []
        print("正在尝试切换到『体验明细』标签...")
        try:
            # 尝试通过文本点击标签
            # 兼容多种可能的标签名
            tab_selectors = ['text="1月体验明细"', 'text="体验明细"', '.tab-item:has-text("体验")']
            tab_clicked = False
            for selector in tab_selectors:
                try:
                    tab = await page.wait_for_selector(selector, timeout=3000)
                    if tab:
                        await tab.click()
                        tab_clicked = True
                        print(f"成功点击标签: {selector}")
                        break
                except:
                    continue
            
            if tab_clicked:
                await asyncio.sleep(5)
                await scroll_to_bottom()
                experience_raw = await page.evaluate(extract_js, 'facejs')
            else:
                print("未能找到体验明细标签，尝试直接按 ID 提取...")
                experience_raw = await page.evaluate(extract_js, 'facejs')
                
        except Exception as e:
            print(f"切换标签或提取体验数据时出错: {e}")
            # 尝试直接提取，不切换标签（有时后台数据也是加载的）
            experience_raw = await page.evaluate(extract_js, 'facejs')

        if isinstance(experience_raw, dict) and "error" in experience_raw:
            print(f"提取体验数据失败: {experience_raw['error']}")
            experience_raw = []

        await browser.close()

        # 数据清洗与转换 (全量替换逻辑)
        # 报课数据处理
        enrollment_final = []
        if enrollment_raw and len(enrollment_raw) > 1:
            for row in enrollment_raw:
                if len(row) < 7: continue
                name = str(row[0]).strip()
                # 跳过表头和无效行
                if not name or name in ["学员姓名", "姓名"] or "求和项" in name: continue
                
                try:
                    enrollment_final.append({
                        "学员姓名": name,
                        "报课时间": excel_date_to_str(row[1]),
                        "报课属性": str(row[2]),
                        "报课课时": str(row[3]),
                        "实收金额": str(row[4]),
                        "归属业绩金额": str(row[4]),
                        "所在校区": str(row[5]),
                        "业绩归属人": str(row[6])
                    })
                except Exception as e:
                    print(f"解析报课行数据出错: {e}, row: {row}")

        # 体验数据处理
        experience_final = []
        if experience_raw and len(experience_raw) > 1:
            for row in experience_raw:
                if len(row) < 10: continue
                name = str(row[0]).strip()
                if not name or name in ["学员姓名", "姓名"]: continue
                
                try:
                    experience_final.append({
                        "学员姓名": name,
                        "年级": str(row[1]),
                        "邀约老师": str(row[5]),
                        "所在校区": str(row[6]),
                        "体验课时间": excel_date_to_str(row[8]),
                        "状态": str(row[9])
                    })
                except Exception as e:
                    print(f"解析体验行数据出错: {e}, row: {row}")

        # 写入文件 (覆盖原有内容，实现全量同步)
        # 1. 写入报课数据
        js_enrollment_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data-2026.js")
        with open(js_enrollment_path, "w", encoding="utf-8") as f:
            f.write(f"window.enrollmentDetails2026 = {json.dumps(enrollment_final, ensure_ascii=False, indent=4)};")
        
        # 2. 写入体验数据
        js_experience_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data-experience-2026.js")
        with open(js_experience_path, "w", encoding="utf-8") as f:
            f.write(f"window.experienceDetails2026 = {json.dumps(experience_final, ensure_ascii=False, indent=4)};")

        # 3. 更新同步时间到 HTML
        try:
            html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "home-dashboard.html")
            with open(html_path, "r", encoding="utf-8") as f:
                html_content = f.read()
            
            now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
            import re
            # 同时更新同步时间和脚本版本号，防止浏览器缓存
            new_html = re.sub(r'window\.ONLINE_SYNC_TIME = ".*?";', f'window.ONLINE_SYNC_TIME = "{now_str}";', html_content)
            new_html = re.sub(r'\.js\?v=.*?"', f'.js?v={now_str}"', new_html)
            
            with open(html_path, "w", encoding="utf-8") as f:
                f.write(new_html)
            print(f"已更新 HTML 中的同步时间与版本号: {now_str}")
        except Exception as e:
            print(f"更新同步时间失败: {e}")

        print(f"同步完成: 提取到 {len(enrollment_final)} 条报课记录, {len(experience_final)} 条体验记录。")
        print("数据已完全替换为腾讯文档当前版本。")

        print(f"Successfully synced: {len(enrollment_final)} enrollment rows, {len(experience_final)} experience rows.")

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(sync_online_docs(url))

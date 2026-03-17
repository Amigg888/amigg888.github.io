#!/usr/bin/env python3
"""
飞书多维表格数据同步模块
用于从飞书多维表格导入业绩数据和体验数据
"""

import requests
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

class FeishuSync:
    """飞书多维表格同步类"""
    
    def __init__(self, app_id: str = None, app_secret: str = None):
        """
        初始化飞书同步模块
        
        Args:
            app_id: 飞书应用 ID
            app_secret: 飞书应用密钥
        """
        self.app_id = app_id or os.getenv('FEISHU_APP_ID', '')
        self.app_secret = app_secret or os.getenv('FEISHU_APP_SECRET', '')
        self.access_token = None
        self.base_url = "https://open.feishu.cn/open-apis"
        
    def get_access_token(self) -> str:
        """获取飞书访问令牌"""
        url = f"{self.base_url}/auth/v3/tenant_access_token/internal"
        headers = {
            "Content-Type": "application/json"
        }
        data = {
            "app_id": self.app_id,
            "app_secret": self.app_secret
        }
        
        try:
            response = requests.post(url, headers=headers, json=data, timeout=10)
            result = response.json()
            
            if result.get('code') == 0:
                self.access_token = result.get('tenant_access_token')
                return self.access_token
            else:
                raise Exception(f"获取访问令牌失败: {result.get('msg')}")
        except Exception as e:
            print(f"获取访问令牌错误: {e}")
            return None
    
    def get_bitable_records(self, app_token: str, table_id: str, 
                           view_id: str = None, filter_str: str = None) -> List[Dict]:
        """
        获取多维表格记录
        
        Args:
            app_token: 多维表格应用令牌
            table_id: 表格 ID
            view_id: 视图 ID（可选）
            filter_str: 过滤条件（可选）
            
        Returns:
            记录列表
        """
        if not self.access_token:
            self.get_access_token()
            
        url = f"{self.base_url}/bitable/v1/apps/{app_token}/tables/{table_id}/records"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        params = {"page_size": 500}
        if view_id:
            params["view_id"] = view_id
        if filter_str:
            params["filter"] = filter_str
            
        records = []
        page_token = None
        
        try:
            while True:
                if page_token:
                    params["page_token"] = page_token
                    
                response = requests.get(url, headers=headers, params=params, timeout=30)
                result = response.json()
                
                if result.get('code') != 0:
                    raise Exception(f"获取记录失败: {result.get('msg')}")
                
                data = result.get('data', {})
                items = data.get('items', [])
                records.extend(items)
                
                # 检查是否有更多数据
                page_token = data.get('page_token')
                if not page_token or not data.get('has_more', False):
                    break
                    
            return records
            
        except Exception as e:
            print(f"获取记录错误: {e}")
            return []
    
    def parse_performance_data(self, records: List[Dict]) -> Dict[str, Any]:
        """
        解析业绩数据
        
        Args:
            records: 飞书表格记录列表
            
        Returns:
            解析后的业绩数据
        """
        performance_data = {}
        
        for record in records:
            fields = record.get('fields', {})
            
            # 提取关键字段（根据实际表格结构调整）
            teacher_name = fields.get('老师姓名', '')
            if not teacher_name:
                continue
                
            # 构建数据对象
            data = {
                'teacher_name': teacher_name,
                'month': fields.get('月份', datetime.now().strftime('%Y-%m')),
                'regular_hours': float(fields.get('正课课时', 0) or 0),
                'one_on_one_amount': float(fields.get('一对一金额', 0) or 0),
                'total_sales': float(fields.get('总销售额', 0) or 0),
                'demo_invites': int(fields.get('体验课邀约', 0) or 0),
                'demo_enrollments': int(fields.get('体验课转化', 0) or 0),
                'should_attend': int(fields.get('应出勤', 0) or 0),
                'actual_attend': int(fields.get('实际出勤', 0) or 0),
                'absence': int(fields.get('缺勤', 0) or 0),
                'leave': int(fields.get('请假', 0) or 0),
                'makeup': int(fields.get('补课', 0) or 0),
                'renewal_students': int(fields.get('续费人数', 0) or 0),
                'renewal_due': int(fields.get('应续费人数', 0) or 0),
                'followup_count': int(fields.get('沟通次数', 0) or 0),
                'video_count': int(fields.get('短视频数量', 0) or 0),
                'promotion_count': int(fields.get('朋友圈数量', 0) or 0),
                'live_count': int(fields.get('直播场次', 0) or 0),
                'late_count': int(fields.get('迟到次数', 0) or 0),
                'serious_late_count': int(fields.get('严重迟到', 0) or 0),
                'early_leave_count': int(fields.get('早退次数', 0) or 0),
                'absent_days': int(fields.get('旷工天数', 0) or 0),
            }
            
            performance_data[teacher_name] = data
            
        return performance_data
    
    def parse_experience_data(self, records: List[Dict]) -> List[Dict]:
        """
        解析体验课数据
        
        Args:
            records: 飞书表格记录列表
            
        Returns:
            解析后的体验课数据列表
        """
        experience_data = []
        
        for record in records:
            fields = record.get('fields', {})
            
            data = {
                'student_name': fields.get('学员姓名', ''),
                'teacher_name': fields.get('体验课老师', ''),
                'date': fields.get('体验课时间', ''),
                'status': fields.get('状态', ''),  # 已报课/未报课
                'referrer': fields.get('推荐人', ''),
                'channel': fields.get('渠道来源', ''),
            }
            
            if data['student_name']:
                experience_data.append(data)
                
        return experience_data
    
    def save_to_local(self, data: Dict, filename: str) -> bool:
        """
        保存数据到本地文件
        
        Args:
            data: 要保存的数据
            filename: 文件名
            
        Returns:
            是否保存成功
        """
        try:
            filepath = f"/Users/mima0000/Library/Mobile Documents/com~apple~CloudDocs/dashboard/work_data/{filename}"
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"数据已保存到: {filepath}")
            return True
        except Exception as e:
            print(f"保存数据失败: {e}")
            return False
    
    def sync_performance_data(self, app_token: str, table_id: str, 
                             month: str = None) -> Dict:
        """
        同步业绩数据主函数
        
        Args:
            app_token: 多维表格应用令牌
            table_id: 表格 ID
            month: 月份筛选（如 2026-02）
            
        Returns:
            同步结果
        """
        # 构建过滤条件
        filter_str = None
        if month:
            filter_str = f'CurrentValue.[月份] = "{month}"'
        
        # 获取数据
        records = self.get_bitable_records(app_token, table_id, filter_str=filter_str)
        
        if not records:
            return {
                'success': False,
                'message': '未获取到数据',
                'data': {}
            }
        
        # 解析数据
        performance_data = self.parse_performance_data(records)
        
        # 保存到本地
        filename = f"performance_{month or datetime.now().strftime('%Y-%m')}.json"
        saved = self.save_to_local(performance_data, filename)
        
        return {
            'success': saved,
            'message': f'成功同步 {len(performance_data)} 条记录',
            'data': performance_data,
            'filename': filename
        }
    
    def sync_experience_data(self, app_token: str, table_id: str,
                            month: str = None) -> Dict:
        """
        同步体验课数据主函数
        
        Args:
            app_token: 多维表格应用令牌
            table_id: 表格 ID
            month: 月份筛选
            
        Returns:
            同步结果
        """
        # 构建过滤条件
        filter_str = None
        if month:
            filter_str = f'CurrentValue.[体验课时间] contains "{month}"'
        
        # 获取数据
        records = self.get_bitable_records(app_token, table_id, filter_str=filter_str)
        
        if not records:
            return {
                'success': False,
                'message': '未获取到数据',
                'data': []
            }
        
        # 解析数据
        experience_data = self.parse_experience_data(records)
        
        # 保存到本地
        filename = f"experience_{month or datetime.now().strftime('%Y-%m')}.json"
        saved = self.save_to_local(experience_data, filename)
        
        return {
            'success': saved,
            'message': f'成功同步 {len(experience_data)} 条记录',
            'data': experience_data,
            'filename': filename
        }


# 便捷函数
def sync_from_feishu(app_token: str, performance_table_id: str = None,
                    experience_table_id: str = None, month: str = None) -> Dict:
    """
    从飞书同步数据的便捷函数
    
    使用示例:
    result = sync_from_feishu(
        app_token='YOUR_APP_TOKEN',
        performance_table_id='tblXXXXXX',
        experience_table_id='tblYYYYYY',
        month='2026-02'
    )
    """
    sync = FeishuSync()
    results = {}
    
    if performance_table_id:
        results['performance'] = sync.sync_performance_data(
            app_token, performance_table_id, month
        )
    
    if experience_table_id:
        results['experience'] = sync.sync_experience_data(
            app_token, experience_table_id, month
        )
    
    return results


if __name__ == '__main__':
    # 测试代码
    print("飞书多维表格同步模块")
    print("请配置 FEISHU_APP_ID 和 FEISHU_APP_SECRET 环境变量")
    print("然后调用 sync_from_feishu() 函数进行数据同步")
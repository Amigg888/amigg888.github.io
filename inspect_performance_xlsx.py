
import openpyxl

file_path = '/Users/mima0000/Library/Mobile Documents/com~apple~CloudDocs/仪表盘/2025年1-12月业绩明细.xlsx'
wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb.active

for row in sheet.iter_rows(max_row=20, values_only=True):
    print(row)

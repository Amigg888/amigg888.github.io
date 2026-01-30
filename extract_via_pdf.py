import asyncio
from playwright.async_api import async_playwright
import pdfplumber
import os

async def extract_via_pdf(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print(f"Opening: {url}")
        # 腾讯文档需要一些时间加载
        await page.goto(url, wait_until="load")
        await asyncio.sleep(20)
        
        # 保存为 PDF
        pdf_path = "sheet_snapshot.pdf"
        print("Saving page as PDF...")
        # 调整页面大小以包含更多内容
        await page.pdf(path=pdf_path, format="A3", print_background=True)
        await browser.close()
        
        print(f"PDF saved to {pdf_path}. Extracting data...")
        
        all_data = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    all_data.extend(table)
                
                # 如果 extract_tables 没找到，尝试 extract_text
                if not tables:
                    text = page.extract_text()
                    if text:
                        print(f"Found text instead of tables: {text[:200]}...")
        
        if all_data:
            print(f"Extracted {len(all_data)} rows from PDF")
            import json
            with open("pdf_extracted_data.json", "w", encoding="utf-8") as f:
                json.dump(all_data, f, ensure_ascii=False, indent=2)
        else:
            print("No data found in PDF.")

if __name__ == "__main__":
    url = "https://docs.qq.com/sheet/DZWRnU29OdGR2bEtD?tab=tz0b9p"
    asyncio.run(extract_via_pdf(url))

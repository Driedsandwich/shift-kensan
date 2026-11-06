"""実装表とは独立に、保存した原表PDFから比較用CSVを生成。PyMuPDFが必要。"""
from pathlib import Path
import re,csv,pymupdf
root=Path(__file__).resolve().parents[1]/'docs'/'sources'
s='\n'.join(page.get_text() for page in pymupdf.open(root/'minimum-2026.pdf'))
rows=re.findall(r'([^\n\d]+)\n([\d,]+)\n（\s*([\d,]+)\s*\)\n\d+\n[\d.]+%\n令和8年(\d+)月(\d+)日',s)
if len(rows)!=47:raise ValueError('表の形が変わったため、人による再確認が必要です')
with (root/'minimum-2026.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['prefecture','amount','previous','effective'])
 for pref,amount,previous,month,day in rows:
  pref=re.sub(r'\s','',pref)
  if pref!='北海道':pref+='都' if pref=='東京' else '府' if pref in ['大阪','京都'] else '県'
  w.writerow([pref,amount.replace(',',''),previous.replace(',',''),f'2026-{int(month):02}-{int(day):02}'])

"""一次資料の保存・ハッシュ一覧の更新。ユーザーの資料は扱わない。"""
from pathlib import Path
import hashlib,json,urllib.request
root=Path(__file__).resolve().parents[1]/'docs'/'sources'
sources={
 'minimum-2026.pdf':'https://www.mhlw.go.jp/content/11200000/001753406.pdf',
 'minimum-2025-reference.pdf':'https://www.mhlw.go.jp/content/10200000/001646434.pdf',
 'student-checklist.pdf':'https://www.check-roudou.mhlw.go.jp/pdf/jishutenken.pdf',
 'overnight.pdf':'https://jsite.mhlw.go.jp/aichi-roudoukyoku/var/rev0/0116/9586/p1.pdf',
 'rounding.pdf':'https://jsite.mhlw.go.jp/aichi-roudoukyoku/var/rev0/0119/6636/hasuutoriatukai.pdf',
 'guideline.html':'https://jsite.mhlw.go.jp/osaka-roudoukyoku/hourei_seido_tetsuzuki/roudoukijun_keiyaku/hourei_seido/jikan2/kokuji/kokuji2.html',
 'labor-law.html':'https://www.mhlw.go.jp/web/t_doc?dataId=73022000',
 'premium-decree.html':'https://www.mhlw.go.jp/web/t_doc?dataId=73028600&dataType=0&pageNo=1',
 'overtime-60.pdf':'https://www.mhlw.go.jp/content/000930914.pdf',
 'consultation.html':'https://www.mhlw.go.jp/general/seido/chihou/kaiketu/soudan.html',
 'minimum-exclusions.html':'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/chingin/newpage_43898.html'
}
manifest=[]
for name,url in sources.items():
 path=root/name
 try:
  if not path.exists():path.write_bytes(urllib.request.urlopen(url,timeout=20).read())
  data=path.read_bytes();manifest.append({'file':name,'url':url,'checked':'2026-11-06','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'status':'取得・実物確認'})
 except Exception as e:manifest.append({'file':name,'url':url,'checked':'2026-11-06','status':'取得失敗','errorType':type(e).__name__})
(root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('一次資料: '+str(sum(x['status']=='取得・実物確認' for x in manifest))+'/'+str(len(manifest)))

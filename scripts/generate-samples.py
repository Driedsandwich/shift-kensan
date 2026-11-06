"""Readable, fictional evidence images, drawn as text/table assets. Requires Pillow; no AI image generator."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
root=Path(__file__).resolve().parents[1]
import os
font_path=os.environ.get('JAPANESE_FONT')
if not font_path:
 for candidate in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','/usr/share/fonts/truetype/noto/NotoSansJP-Regular.ttf']:
  if Path(candidate).exists():font_path=candidate;break
if not font_path:raise SystemExit('JAPANESE_FONT に日本語フォントのパスを指定してください。')
def font(size):return ImageFont.truetype(font_path,size)
examples=[('class','A','コマ給・授業の前後','2026-11-02',[
 ('授業','17:00〜22:30','3コマ × 110分'),('準備','16:45〜17:00','責任者の指示'),('報告書','22:30〜22:40','責任者の指示'),('休憩','なし','')], [('給与の形','1コマ 1,800円'),('通常の支払','5,400円'),('授業外の支払','0円'),('割増の支払','0円'),('交通費・その他','0円'),('控除前の対象賃金','5,400円')]),
 ('night','B','時給・22時を過ぎる勤務','2026-11-03',[('勤務','18:00〜23:00','時給 1,400円'),('休憩','なし','')],[('給与の形','時給 1,400円'),('通常の支払','7,000円'),('深夜の割増','0円'),('交通費・その他','0円'),('控除前の対象賃金','7,000円')]),
 ('clear','C','時給・記録どおりの支払い','2026-11-04',[('勤務','17:00〜21:00','時給 1,400円'),('休憩','なし','')],[('給与の形','時給 1,400円'),('通常の支払','5,600円'),('割増の支払','0円'),('交通費・その他','0円'),('控除前の対象賃金','5,600円')])]
for id,letter,title,date,rows,pays in examples:
 im=Image.new('RGB',(1200,1500),'#f4f3ec');d=ImageDraw.Draw(im)
 d.rounded_rectangle((45,45,1155,1455),radius=18,fill='white',outline='#cdd7cc',width=3)
 d.rectangle((45,45,1155,145),fill='#194e42');d.text((85,72),f'架空の見本 {letter} ｜ 明細と勤務記録',font=font(38),fill='white')
 d.text((85,180),title,font=font(38),fill='#173c32');d.text((85,250),'架空の学習塾「みどり教室」／ 勤務地：東京都',font=font(28),fill='#506558')
 d.text((85,310),'勤務記録　'+date,font=font(32),fill='#173c32')
 y=380
 for k,a,n in [('内容','時間','メモ')]+rows:
  d.rectangle((85,y,1115,y+70),fill='#edf4ed' if y==380 else '#fafbf8',outline='#d5dfd2')
  for x,t in [(105,k),(330,a),(725,n)]:d.text((x,y+16),t,font=font(28),fill='#203c30')
  y+=70
 y+=50;d.text((85,y),'給与明細（この勤務分・控除前）',font=font(32),fill='#173c32');y+=65
 for k,v in pays:
  d.line((85,y+55,1115,y+55),fill='#d4dfd0',width=2);d.text((105,y+7),k,font=font(28),fill='#374f3f');d.text((735,y+7),v,font=font(30),fill='#173c32');y+=60
 d.text((85,1345),'※人名・口座を含まない合成データです。',font=font(25),fill='#647666')
 d.text((85,1390),'※法定休日の指定なし。休憩なしの記載も本人が確認。',font=font(23),fill='#647666')
 im.save(root/'public'/'samples'/f'{id}.png',optimize=True)

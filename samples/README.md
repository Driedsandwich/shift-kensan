# 架空の明細・シフト

`public/samples/class.png`、`night.png`、`clear.png` は全て合成データです。個人情報を含みません。PNGの中に勤務表とその勤務分の給与明細を一緒に描き、画像だけでも読めるようにしています。

元データは `src/data/samples.ts`、描画は `scripts/generate-samples.py`。日本語フォントとPillowがある環境で `JAPANESE_FONT` にフォントのファイルパスを設定して再生成できます。Nodeでの通常ビルドにはPythonは不要です。

mockは画像OCRを行わず、明示された見本IDから転記を返します。実AIに見本画像を読ませる場合は、見本ボタンでなく、通常の写真入力でPNGを選んでください。

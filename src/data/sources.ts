export const sources = [
  {
    id: "minimum",
    title: "厚生労働省：令和8年度 地域別最低賃金全国一覧",
    url: "https://www.mhlw.go.jp/content/11200000/001753406.pdf",
    detail:
      "47都道府県の改定額・改定前額・発効日。原表の列名は「答申された改定額」。全国一覧として公表された表を転記。",
  },
  {
    id: "previous",
    title: "厚生労働省：令和8年1月 部局長会議資料（5ページ）",
    url: "https://www.mhlw.go.jp/content/10200000/001646434.pdf",
    detail:
      "令和7年度の金額と発効日。全地域で旧額が発効済みとなる2026年4月1日からを検算対象にしています。",
  },
  {
    id: "law",
    title: "厚生労働省法令：労働基準法32・34・35・37条",
    url: "https://www.mhlw.go.jp/web/t_doc?dataId=73022000",
    detail:
      "1日8時間・週40時間、6時間超で45分／8時間超で60分の休憩、休日、時間外・深夜の割増。",
  },
  {
    id: "premium",
    title: "厚生労働省：法定労働時間と割増賃金",
    url: "https://www.mhlw.go.jp/bunya/roudoukijun/faq_kijyungyosei07.html",
    detail:
      "時間外25%以上、法定休日35%以上（政令による）、深夜25%以上。重なる深夜分は加算。",
  },
  {
    id: "decree",
    title: "厚生労働省法令：割増率の最低限度を定める政令",
    url: "https://www.mhlw.go.jp/web/t_doc?dataId=73028600&dataType=0&pageNo=1",
    detail: "平成6年政令第5号。時間外25%、休日35%の率を定める。",
  },
  {
    id: "excluded",
    title: "厚生労働省：最低賃金の対象となる賃金",
    url: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/chingin/newpage_43898.html",
    detail:
      "臨時の賃金・賞与・割増分・精皆勤手当・通勤手当・家族手当等を除外。割増を含む総支払額だけでは最低賃金を満たすか確定できない。",
  },
  {
    id: "sixty",
    title: "厚生労働省：月60時間超の時間外割増",
    url: "https://www.mhlw.go.jp/content/000930914.pdf",
    detail:
      "時間外60時間超50%以上、深夜と重なると75%以上。法定休日は60時間の集計に含めない。",
  },
  {
    id: "guideline",
    title: "大阪労働局：労働時間の適正把握ガイドライン",
    url: "https://jsite.mhlw.go.jp/osaka-roudoukyoku/hourei_seido_tetsuzuki/roudoukijun_keiyaku/hourei_seido/jikan2/kokuji/kokuji2.html",
    detail:
      "使用者の指示による準備・後始末・義務のある研修等は労働時間として扱う。",
  },
  {
    id: "juku",
    title: "厚生労働省・文部科学省：学生アルバイトの自主点検表",
    url: "https://www.check-roudou.mhlw.go.jp/pdf/jishutenken.pdf",
    detail:
      "項目16と解説に、学習塾の質問対応・報告書作成等の授業外時間を明記。実物を確認。2015年の要請PDFの旧URLは404のため原本未確認。",
  },
  {
    id: "overnight",
    title: "愛知労働局：労働時間法の要点",
    url: "https://jsite.mhlw.go.jp/aichi-roudoukyoku/var/rev0/0116/9586/p1.pdf",
    detail: "二暦日にわたる継続勤務を始業日の1勤務として扱う考え方。",
  },
  {
    id: "rounding",
    title: "愛知労働局：賃金計算の端数の取扱い",
    url: "https://jsite.mhlw.go.jp/aichi-roudoukyoku/var/rev0/0119/6636/hasuutoriatukai.pdf",
    detail:
      "昭和63年3月14日基発150号。月の時間外等の端数処理には条件がある。本アプリの月合計の丸めは比較用の仮定。",
  },
  {
    id: "basis",
    title: "大阪労働局：割増賃金の計算基礎",
    url: "https://jsite.mhlw.go.jp/osaka-roudoukyoku/hourei_seido_tetsuzuki/roudoukijun_keiyaku/hourei_seido/jikan2/warimasi.html",
    detail:
      "賃金の形態で割増の基礎が異なる。コマ給を自動で出来高払とは判定しない。",
  },
];
export const consultation = {
  title: "総合労働相談コーナー（厚生労働省）",
  url: "https://www.mhlw.go.jp/general/seido/chihou/kaiketu/soudan.html",
};

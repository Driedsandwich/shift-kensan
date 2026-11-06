export const FACT_SENTENCE =
  "働いた時間は{{minutes}}分、支払額は{{paid}}円、試算額は{{expected}}円、差額の見込みは{{gap}}円です。";
export const FALLBACK_TEMPLATE = `給与の計算について確認させてください。${FACT_SENTENCE}勤務記録と計算の前提を一緒に確認していただけますか。`;
const starts = [
  "給与の計算について確認させてください。",
  "勤務時間と給与について相談させてください。",
  "お忙しいところ失礼します。給与の内訳を確認したいです。",
];
const ends = [
  "勤務記録と計算の前提を一緒に確認していただけますか。",
  "授業の前後の作業と割増の扱いを教えていただけますか。",
  "私の記録に間違いがないか、明細と照らしていただけますか。",
];
export const messageChoices = { starts, ends };
export function safeTemplate(s: string) {
  return starts.some((a) => ends.some((b) => s === a + FACT_SENTENCE + b));
}
export type MessageFacts = {
  minutes: number;
  paid: number;
  expected: number;
  gap: number;
};
export function formatMoney(n: number) {
  return n.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}
export function renderMessage(template: string, f: MessageFacts) {
  const accepted = safeTemplate(template);
  const text = (accepted ? template : FALLBACK_TEMPLATE).replace(
    /\{\{(minutes|paid|expected|gap)\}\}/g,
    (_, k: keyof MessageFacts) => formatMoney(f[k]),
  );
  return { text, accepted, verified: verifyMessage(text, f) };
}
// 値の集合だけでなく、項目名と単位を含む事実の全文を比較。数字の入れ替えも拒否。
export function verifyMessage(text: string, f: MessageFacts) {
  return messageChoices.starts.some((a) =>
    messageChoices.ends.some(
      (b) =>
        text ===
        a +
          FACT_SENTENCE.replace(
            /\{\{(minutes|paid|expected|gap)\}\}/g,
            (_, k: keyof MessageFacts) => formatMoney(f[k]),
          ) +
          b,
    ),
  );
}

import { it, expect } from "vitest";
import {
  renderMessage,
  verifyMessage,
  FALLBACK_TEMPLATE,
  FACT_SENTENCE,
  messageChoices,
} from "../src/core/message";
const facts = { minutes: 300, paid: 7000, expected: 7350, gap: 350 };
it("定型の事実を項目に対応づけて差し込む", () => {
  const r = renderMessage(FALLBACK_TEMPLATE, facts);
  expect(r.accepted).toBe(true);
  expect(r.verified).toBe(true);
  expect(r.text).toContain("300分");
  expect(r.text).toContain("7,350円");
});
it("同じ数字でも項目を入れ替えた文は捨てる", () => {
  const text = renderMessage(FALLBACK_TEMPLATE, facts).text.replace(
    "支払額は7,000円、試算額は7,350円",
    "支払額は7,350円、試算額は7,000円",
  );
  expect(verifyMessage(text, facts)).toBe(false);
});
it("数字の幻覚・時刻の追加・漢数字・違法断定を捨てる", () => {
  for (const bad of [
    FALLBACK_TEMPLATE + "追加5000円です。",
    FALLBACK_TEMPLATE + "22:00です。",
    FALLBACK_TEMPLATE + "五千円です。",
    FALLBACK_TEMPLATE + "違法です。",
  ]) {
    const r = renderMessage(bad, facts);
    expect(r.accepted).toBe(false);
    expect(r.verified).toBe(true);
    expect(r.text).toBe(renderMessage(FALLBACK_TEMPLATE, facts).text);
  }
});
it("本人の編集後は新しい事実だけで再生成", () => {
  const old = renderMessage(FALLBACK_TEMPLATE, facts).text;
  const updated = { ...facts, paid: 7350, gap: 0 };
  expect(verifyMessage(old, updated)).toBe(false);
  expect(renderMessage(FALLBACK_TEMPLATE, updated).verified).toBe(true);
});
it("全ての許可した言い回しで事実が一致", () => {
  for (const start of messageChoices.starts)
    for (const end of messageChoices.ends)
      expect(renderMessage(start + FACT_SENTENCE + end, facts).verified).toBe(
        true,
      );
});

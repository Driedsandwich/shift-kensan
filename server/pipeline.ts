import { sheetSchema, type ExtractionInput } from "../src/core/schema";
import { normalizeRelative } from "../src/core/normalize";
import type { Provider } from "./providers";
export async function extractSheet(input: ExtractionInput, provider: Provider) {
  for (let calls = 1; calls <= 2; calls++) {
    const raw = dropUnreadPaid(await provider.extract(input, calls === 2));
    const parsed = sheetSchema.safeParse(raw);
    if (parsed.success) {
      // 本人が選んだ勤務場所・給与種別をAIが上書きしない。
      const sheet = normalizeRelative({
        ...parsed.data,
        prefecture: input.prefecture,
        payType: input.payType,
      });
      return {
        sheet,
        provider: provider.name,
        aiCalls: provider.name === "mock" ? 0 : calls,
        attempts: calls,
      };
    }
  }
  throw new Error("読み取りの形式を確認できませんでした。表を手入力できます。");
}

/** AI が金額を読めず null で返した月の支払いの行は、書かれていない扱いにして外す（計算の決まりは変えない）。 */
export function dropUnreadPaid(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as { monthlyPaid?: unknown };
  if (!Array.isArray(r.monthlyPaid)) return raw;
  return {
    ...r,
    monthlyPaid: r.monthlyPaid.filter(
      (p) => p && typeof p === "object" && typeof (p as { amount?: unknown }).amount === "number",
    ),
  };
}

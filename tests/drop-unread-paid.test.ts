import { describe, expect, it } from "vitest";
import { dropUnreadPaid } from "../server/pipeline";
describe("dropUnreadPaid", () => {
  it("金額が null の月の行だけを外す", () => {
    const out = dropUnreadPaid({
      monthlyPaid: [
        { month: "2026-11", amount: null },
        { month: "2026-10", amount: 13500 },
      ],
    }) as { monthlyPaid: unknown[] };
    expect(out.monthlyPaid).toEqual([{ month: "2026-10", amount: 13500 }]);
  });
  it("形の違う入力はそのまま返す", () => {
    expect(dropUnreadPaid(null)).toBe(null);
    expect(dropUnreadPaid({ shifts: [] })).toEqual({ shifts: [] });
  });
});

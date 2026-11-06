import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { cases, s, sheet, b } from "../eval/cases";
import { calculate, requiredBreak } from "../src/core/calculate";
import { defaultSettings, sheetSchema } from "../src/core/schema";
import { minimumAt, minimumWages } from "../src/data/minimum-wages";
import { dayNumber, dayString } from "../src/core/time";
import { normalizeRelative } from "../src/core/normalize";
describe("公的原表との照合・発効日の境目", () => {
  const csv = readFileSync("docs/sources/minimum-2026.csv", "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1);
  it("47都道府県をPDFから抽出した独立CSVと照合", () => {
    expect(csv).toHaveLength(47);
    expect(minimumWages).toHaveLength(47);
    for (const line of csv) {
      const [prefecture, amount, previous, effective] = line.split(",");
      expect(minimumWages.find((r) => r.prefecture === prefecture)).toEqual({
        prefecture,
        amount: +amount,
        previous: +previous,
        effective,
      });
    }
  });
  for (const row of minimumWages)
    it(`${row.prefecture}の前日と発効日`, () => {
      expect(
        minimumAt(row.prefecture, dayString(dayNumber(row.effective) - 1))
          .applied,
      ).toBe(row.previous);
      expect(minimumAt(row.prefecture, row.effective).applied).toBe(row.amount);
    });
  it("未確認の年月日を拒否", () => {
    expect(() => minimumAt("東京都", "2026-03-31")).toThrow();
    expect(() => minimumAt("東京都", "2027-01-01")).toThrow();
  });
});
describe("手計算による独立の正解", () => {
  for (const c of cases)
    it(`${c.id} ${c.name}`, () => {
      const r = calculate(c.sheet, c.settings);
      expect(r.minutes).toBe(c.gold.minutes);
      expect(r.expected).toBeCloseTo(c.gold.amount, 6);
      if (c.gold.gap === null) expect(r.gap).toBeNull();
      else expect(r.gap).toBeCloseTo(c.gold.gap, 6);
      for (const [key, field] of [
        ["ot", "overtimeMinutes"],
        ["night", "nightMinutes"],
        ["holiday", "holidayMinutes"],
        ["rest", "breakMinutes"],
        ["requiredRest", "requiredBreak"],
      ] as const)
        if (c.gold[key] !== undefined)
          expect(r.days.reduce((n, d) => n + d[field], 0)).toBe(c.gold[key]);
    });
});
describe("入力を勝手に補わない", () => {
  it("支払0円は不明と区別", () => {
    expect(
      calculate(sheet([s("2026-11-02", "10:00", "11:00", 0)]), defaultSettings)
        .gap,
    ).toBe(1500);
  });
  it("nullの日付では検算しない", () => {
    const sh = sheet([s("2026-11-02", "10:00", "11:00")]);
    sh.shifts[0].date = null;
    expect(() => calculate(sh, defaultSettings)).toThrow("勤務日");
  });
  it("nullの開始では検算しない", () => {
    const sh = sheet([s("2026-11-02", "10:00", "11:00")]);
    sh.shifts[0].blocks[0].start = null;
    expect(() => calculate(sh, defaultSettings)).toThrow("開始");
  });
  it("実在しない日付・時刻を拒否", () => {
    expect(
      sheetSchema.safeParse(sheet([s("2026-02-30", "10:00", "11:00")])).success,
    ).toBe(false);
    expect(
      sheetSchema.safeParse(sheet([s("2026-11-02", "99:00", "11:00")])).success,
    ).toBe(false);
  });
  it("同じ時刻を24時間とみなさない", () => {
    expect(() =>
      calculate(sheet([s("2026-11-02", "17:00", "17:00")]), defaultSettings),
    ).toThrow("時刻");
  });
  it("同日カードと跨日の重複を拒否", () => {
    expect(() =>
      calculate(
        sheet([
          s("2026-11-02", "09:00", "12:00"),
          s("2026-11-02", "13:00", "17:00"),
        ]),
        defaultSettings,
      ),
    ).toThrow("同じ日");
    expect(() =>
      calculate(
        sheet([
          s("2026-11-02", "23:00", "26:00"),
          s("2026-11-03", "01:00", "03:00"),
        ]),
        defaultSettings,
      ),
    ).toThrow("重な");
  });
  it("別カードの順番に左右されない", () => {
    const sh = cases[21].sheet;
    expect(
      calculate({ ...sh, shifts: [...sh.shifts].reverse() }, defaultSettings),
    ).toEqual(calculate(sh, defaultSettings));
  });
  it("勤務前後の休みを休憩に数えない", () => {
    expect(() =>
      calculate(
        sheet([
          s("2026-11-02", "09:00", "18:00", 0, [b("18:00", "19:00", "休憩")]),
        ]),
        defaultSettings,
      ),
    ).toThrow("途中");
  });
  it("相対的な準備15分をコードで時刻化", () => {
    const sh = sheet([s("2026-11-02", "17:00", "21:00")]);
    sh.shifts[0].blocks.push({
      kind: "準備",
      start: null,
      end: null,
      instructed: "unknown",
      relative: { edge: "before", minutes: 15 },
    });
    expect(normalizeRelative(sh).shifts[0].blocks[1].start).toBe("16:45");
    expect(sh.shifts[0].blocks[1].start).toBeNull();
  });
  it("休憩の基準は厳密な超過", () =>
    expect([360, 361, 480, 481].map(requiredBreak)).toEqual([0, 45, 45, 60]));
  it("月額の重複と勤務のない月を拒否", () => {
    const sh = sheet([s("2026-11-02", "10:00", "11:00")]);
    sh.monthlyPaid = [{ month: "2026-10", amount: 1 }];
    expect(() => calculate(sh, defaultSettings)).toThrow("対応");
    sh.monthlyPaid = [
      { month: "2026-11", amount: 1 },
      { month: "2026-11", amount: 1 },
    ];
    expect(() => calculate(sh, defaultSettings)).toThrow("重複");
  });
  it("週跨ぎ夜勤は始業日に帰属", () => {
    const sh = sheet(
      ["02", "03", "04", "05", "06"].map((d) =>
        s(`2026-11-${d}`, "09:00", "17:00", 0),
      ),
    );
    sh.shifts.push(s("2026-11-07", "23:00", "25:00"));
    const r = calculate(sh, defaultSettings);
    expect(r.days.at(-1)!.overtimeMinutes).toBe(120);
  });
});
it("最低賃金の通常分比較に割増支払を混ぜない", () => {
  const r = calculate(
    sheet([s("2026-11-02", "22:00", "23:00", 2000)], 1200),
    defaultSettings,
  );
  expect(r.days[0].minimumBase).toBe(1280);
  expect(r.days[0].contractBase).toBe(1200);
  expect(r.days[0].minimumGap).toBe(80);
  expect(r.gap).toBe(0);
  expect(r.warnings.join()).toContain("総支払額だけ");
});

// 正解は下の各ケースに手計算の定数で記載。検算エンジンから生成しない。
import {
  blankSheet,
  defaultSettings,
  type Sheet,
  type Shift,
  type Block,
  type Settings,
} from "../src/core/schema";
export const b = (
  start: string,
  end: string,
  kind: Block["kind"] = "勤務",
  instructed: Block["instructed"] = "yes",
): Block => ({ kind, start, end, instructed });
export const s = (
  date: string,
  start: string,
  end: string,
  paid: number | null = 0,
  extra: Block[] = [],
): Shift => ({
  date,
  blocks: [b(start, end), ...extra],
  classes: null,
  paid,
  evidence: "合成の勤務記録",
  uncertain: [],
});
export function sheet(
  shifts: Shift[],
  rate = 1500,
  prefecture = "東京都",
): Sheet {
  return { ...blankSheet(prefecture), rate, shifts };
}
export type Golden = {
  minutes: number;
  amount: number;
  gap: number | null;
  ot?: number;
  night?: number;
  holiday?: number;
  rest?: number;
  requiredRest?: number;
};
export type Case = {
  id: string;
  name: string;
  sheet: Sheet;
  settings: Settings;
  gold: Golden;
  manual: string;
};
const cases: Case[] = [];
function add(
  name: string,
  sh: Sheet,
  gold: Golden,
  manual: string,
  options: Partial<Settings> = {},
) {
  cases.push({
    id: `C${String(cases.length + 1).padStart(2, "0")}`,
    name,
    sheet: sh,
    settings: { ...defaultSettings, completePeriod: true, ...options },
    gold,
    manual,
  });
}
const one = (a: string, z: string, paid = 0, extra: Block[] = []) =>
  sheet([s("2026-11-02", a, z, paid, extra)]);
add(
  "通常4時間",
  one("17:00", "21:00", 6000),
  { minutes: 240, amount: 6000, gap: 0, ot: 0, night: 0 },
  "1500×4=6000",
);
add(
  "深夜1時間",
  one("18:00", "23:00", 7500),
  { minutes: 300, amount: 7875, gap: 375, night: 60 },
  "1500×5+1500×0.25=7875",
);
add(
  "深夜2時間",
  one("21:00", "24:00", 4500),
  { minutes: 180, amount: 5250, gap: 750, night: 120 },
  "4500+750=5250",
);
add(
  "深夜0〜5時",
  one("00:00", "05:00", 7500),
  { minutes: 300, amount: 9375, gap: 1875, night: 300 },
  "7500×1.25=9375",
);
add(
  "5時をまたぐ",
  one("04:00", "06:00", 3000),
  { minutes: 120, amount: 3375, gap: 375, night: 60 },
  "3000+375=3375",
);
add(
  "22時の1分境界",
  one("21:59", "22:01", 50),
  { minutes: 2, amount: 57, gap: 7, night: 1 },
  "50+6.25=56.25→57",
);
add(
  "5時の1分境界",
  one("04:59", "05:01", 50),
  { minutes: 2, amount: 57, gap: 7, night: 1 },
  "50+6.25=56.25→57",
);
add(
  "日8時間超",
  one("09:00", "18:00", 13500),
  { minutes: 540, amount: 13875, gap: 375, ot: 60, requiredRest: 60 },
  "13500+375=13875",
);
add(
  "休憩1時間を除外",
  one("09:00", "18:00", 12000, [b("12:00", "13:00", "休憩")]),
  { minutes: 480, amount: 12000, gap: 0, ot: 0, rest: 60, requiredRest: 45 },
  "拘束9h−休憩1h=8h",
);
add(
  "8時間1分・休憩あり",
  one("09:00", "18:01", 12000, [b("12:00", "13:00", "休憩")]),
  { minutes: 481, amount: 12032, gap: 32, ot: 1, rest: 60, requiredRest: 60 },
  "12000+25×1.25=12031.25→12032",
);
add(
  "6時間ちょうど",
  one("09:00", "15:00", 9000),
  { minutes: 360, amount: 9000, gap: 0, requiredRest: 0 },
  "1500×6",
);
add(
  "6時間1分",
  one("09:00", "15:01", 9025),
  { minutes: 361, amount: 9025, gap: 0, requiredRest: 45 },
  "1500×6+25",
);
add(
  "8時間ちょうど",
  one("09:00", "17:00", 12000),
  { minutes: 480, amount: 12000, gap: 0, ot: 0, requiredRest: 45 },
  "1500×8",
);
add(
  "8時間1分",
  one("09:00", "17:01", 12000),
  { minutes: 481, amount: 12032, gap: 32, ot: 1, requiredRest: 60 },
  "12000+31.25→12032",
);
add(
  "時間外と深夜が重なる",
  one("13:00", "23:00", 15000),
  { minutes: 600, amount: 16125, gap: 1125, ot: 120, night: 60 },
  "15000+750+375",
);
add(
  "法定休日は時間外と重ねない",
  one("09:00", "19:00", 15000),
  { minutes: 600, amount: 20250, gap: 5250, ot: 0, holiday: 600 },
  "15000×1.35",
  { holidayDates: ["2026-11-02"] },
);
add(
  "休日と深夜が重なる",
  one("20:00", "26:00", 9000),
  { minutes: 360, amount: 13650, gap: 4650, ot: 0, night: 240, holiday: 360 },
  "9000×1.35+6000×0.25",
  { holidayDates: ["2026-11-02", "2026-11-03"] },
);
add(
  "0時から休日",
  one("23:00", "25:00", 3000),
  { minutes: 120, amount: 4275, gap: 1275, night: 120, holiday: 60 },
  "3000+750+525",
  { holidayDates: ["2026-11-03"] },
);
add(
  "0時で休日終了",
  one("23:00", "25:00", 3000),
  { minutes: 120, amount: 4275, gap: 1275, night: 120, holiday: 60 },
  "3000+750+525",
  { holidayDates: ["2026-11-02"] },
);
add(
  "日またぎの8時間判定",
  one("20:00", "30:00", 15000),
  { minutes: 600, amount: 18375, gap: 3375, ot: 120, night: 420 },
  "15000+750+2625",
);
add(
  "深夜の休憩を除外",
  one("20:00", "26:00", 7500, [b("23:00", "24:00", "休憩")]),
  { minutes: 300, amount: 8625, gap: 1125, night: 180, rest: 60 },
  "7500+4500×0.25",
);
const week = (dates: string[], hours = 8) =>
  dates.map((d) => s(d, "09:00", `${9 + hours}:00`, hours * 1500));
add(
  "週40時間超",
  sheet(
    week([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ]),
  ),
  { minutes: 2880, amount: 75000, gap: 3000, ot: 480 },
  "1500×48+1500×8×0.25",
);
add(
  "日と週の超過を二重にしない",
  sheet(
    week(
      ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"],
      9,
    ),
  ),
  { minutes: 2700, amount: 69375, gap: 1875, ot: 300 },
  "45hのうち日超過5h、週超過の追加なし",
);
add(
  "週の境目・日曜起算",
  sheet(
    week([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-08",
    ]),
  ),
  { minutes: 2880, amount: 72000, gap: 0, ot: 0 },
  "40hと翌週8hに分かれる",
);
add(
  "週の境目・月曜起算",
  sheet(
    week([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-08",
    ]),
  ),
  { minutes: 2880, amount: 75000, gap: 3000, ot: 480 },
  "月曜〜日曜は48h",
  { weekStart: 1 },
);
add(
  "最低賃金の改定前",
  sheet([s("2026-09-30", "10:00", "11:00", 1200)], 1200),
  { minutes: 60, amount: 1226, gap: 26 },
  "東京旧額1226×1",
);
add(
  "最低賃金の発効日",
  sheet([s("2026-10-01", "10:00", "11:00", 1200)], 1200),
  { minutes: 60, amount: 1280, gap: 80 },
  "東京新額1280×1",
);
add(
  "発効日前夜から継続",
  sheet([s("2026-09-30", "23:00", "25:00", 2400)], 1200),
  { minutes: 120, amount: 3133, gap: 733, night: 120 },
  "(1226+1280)×1.25=3132.5→3133",
);
const classSheet: Sheet = {
  ...blankSheet("東京都", "class"),
  rate: 1800,
  classMinutes: 110,
  shifts: [
    {
      ...s("2026-11-02", "17:00", "22:30", 5400, [
        b("16:45", "17:00", "準備"),
        b("22:30", "22:40", "報告書"),
      ]),
      classes: 3,
    },
  ],
};
add(
  "コマ給の授業外作業",
  classSheet,
  { minutes: 355, amount: 7787, gap: 2387, night: 40 },
  "1280×355/60+1280×40/60×0.25=7786.666…",
);
add(
  "指示不明を除く",
  sheet([
    s("2026-11-02", "17:00", "21:00", 6000, [
      b("16:45", "17:00", "準備", "unknown"),
    ]),
  ]),
  { minutes: 240, amount: 6000, gap: 0 },
  "不明の準備を除く",
  { includeUnknown: false },
);
add(
  "指示不明を含む",
  sheet([
    s("2026-11-02", "17:00", "21:00", 6000, [
      b("16:45", "17:00", "準備", "unknown"),
    ]),
  ]),
  { minutes: 255, amount: 6375, gap: 375 },
  "4.25h×1500",
);
add(
  "重なる勤務を1回だけ数える",
  one("17:00", "21:00", 6000, [b("17:00", "17:15", "準備")]),
  { minutes: 240, amount: 6000, gap: 0 },
  "同じ15分は二重加算しない",
);
add(
  "支払額が不明",
  sheet([s("2026-11-02", "17:00", "21:00", null)]),
  { minutes: 240, amount: 6000, gap: null },
  "支払額を0と推定しない",
);
add(
  "月額のみ記載",
  {
    ...sheet([
      s("2026-11-02", "17:00", "21:00", null),
      s("2026-11-03", "17:00", "21:00", null),
    ]),
    monthlyPaid: [{ month: "2026-11", amount: 11000 }],
  },
  { minutes: 480, amount: 12000, gap: 1000 },
  "6000×2−11000",
);
add(
  "月合計の四捨五入",
  one("21:59", "22:01", 50),
  { minutes: 2, amount: 56, gap: 6 },
  "56.25→56",
  { rounding: "round" },
);
add(
  "丸めない",
  one("21:59", "22:01", 50),
  { minutes: 2, amount: 56.25, gap: 6.25 },
  "56.25のまま",
  { rounding: "exact" },
);
add(
  "翌月の過払いと相殺しない",
  sheet([
    s("2026-10-30", "17:00", "21:00", 6500),
    s("2026-11-02", "17:00", "21:00", 5500),
  ]),
  { minutes: 480, amount: 12000, gap: 500 },
  "10月過払500は11月不足500と相殺しない",
);
// 各週5日、毎日12h: 4h×5日×4週=80hの時間外。60hまで25%、残り20h50%。
const longDates = [
  "02",
  "03",
  "04",
  "05",
  "06",
  "09",
  "10",
  "11",
  "12",
  "13",
  "16",
  "17",
  "18",
  "19",
  "20",
  "23",
  "24",
  "25",
  "26",
  "27",
];
add(
  "月60時間超を50%へ",
  sheet(longDates.map((d) => s(`2026-11-${d}`, "08:00", "20:00", 18000))),
  { minutes: 14400, amount: 397500, gap: 37500, ot: 4800, night: 0 },
  "240h×1500+60h×375+20h×750=397500",
);
add(
  "法定休日を週40時間に算入しない",
  sheet(
    week([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ]),
  ),
  { minutes: 2880, amount: 76200, gap: 4200, ot: 0, holiday: 480 },
  "72000+8h×1500×0.35",
  { holidayDates: ["2026-11-01"] },
);
add(
  "月の中でのみ過不足を相殺",
  sheet([
    s("2026-11-02", "17:00", "21:00", 6500),
    s("2026-11-03", "17:00", "21:00", 5500),
  ]),
  { minutes: 480, amount: 12000, gap: 0 },
  "同月6000+6000と支払6500+5500",
);
add(
  "月60時間超と深夜の重なり",
  sheet([
    ...longDates
      .slice(0, 15)
      .map((d) => s(`2026-11-${d}`, "08:00", "20:00", 18000)),
    s("2026-11-23", "14:00", "26:00", 18000),
  ]),
  { minutes: 11520, amount: 315000, gap: 27000, ot: 3840, night: 240 },
  "15日×19500+(18000+4h×750+4h×375)=315000",
);
export { cases };

import type { ExtractionInput } from "../src/core/schema";
export type ExtractionCase = {
  id: string;
  input: ExtractionInput;
  expected: Record<string, unknown>;
};
const i = (
  text: string,
  payType: ExtractionInput["payType"] = "hourly",
): ExtractionInput => ({
  text,
  images: [],
  prefecture: "東京都",
  payType,
  referenceDate: "2026-11-06",
});
export const extractionCases: ExtractionCase[] = [
  {
    id: "E01",
    input: i(
      "2026-11-02、17:00〜21:00勤務。時給1400円、休憩なし。支払額5600円。",
    ),
    expected: {
      rate: 1400,
      "shifts.0.date": "2026-11-02",
      "shifts.0.blocks.0.start": "17:00",
      "shifts.0.blocks.0.end": "21:00",
      "shifts.0.paid": 5600,
    },
  },
  {
    id: "E02",
    input: i(
      "東京都で時給1500円。2026-11-03の18:00〜23:00で勤務、休憩なし。支払額7500円。",
    ),
    expected: {
      rate: 1500,
      "shifts.0.date": "2026-11-03",
      "shifts.0.blocks.0.start": "18:00",
      "shifts.0.blocks.0.end": "23:00",
      "shifts.0.paid": 7500,
    },
  },
  {
    id: "E03",
    input: i(
      "2026年11月4日、9:00〜18:00勤務。休憩12:00〜13:00。時給1500円。支払額12000円。",
    ),
    expected: {
      rate: 1500,
      "shifts.0.date": "2026-11-04",
      "shifts.0.blocks.0.start": "09:00",
      "shifts.0.blocks.1.kind": "休憩",
      "shifts.0.blocks.1.start": "12:00",
      "shifts.0.blocks.1.end": "13:00",
      "shifts.0.paid": 12000,
    },
  },
  {
    id: "E04",
    input: i(
      "2026/11/05、20:00〜26:00勤務。時給1600円。休憩なし。支払額9600円。",
    ),
    expected: {
      rate: 1600,
      "shifts.0.date": "2026-11-05",
      "shifts.0.blocks.0.end": "26:00",
      "shifts.0.paid": 9600,
    },
  },
  {
    id: "E05",
    input: i(
      "2026-11-02、授業17:00〜20:00、2コマ。1コマ1800円・90分。休憩なし。支払額3600円。",
      "class",
    ),
    expected: {
      payType: "class",
      rate: 1800,
      classMinutes: 90,
      "shifts.0.classes": 2,
      "shifts.0.blocks.0.kind": "授業",
      "shifts.0.paid": 3600,
    },
  },
  {
    id: "E06",
    input: i(
      "2026-11-02、授業17:00〜20:00、2コマ。1コマ1800円・90分。指示された準備16:45〜17:00。休憩なし。支払額3600円。",
      "class",
    ),
    expected: {
      rate: 1800,
      "shifts.0.blocks.1.kind": "準備",
      "shifts.0.blocks.1.start": "16:45",
      "shifts.0.blocks.1.end": "17:00",
      "shifts.0.blocks.1.instructed": "yes",
    },
  },
  {
    id: "E07",
    input: i(
      "2026-11-02、17:00〜21:00勤務。時給1400円、休憩なし。後に報告書10分（指示あり）。支払額5600円。",
    ),
    expected: {
      rate: 1400,
      "shifts.0.blocks.1.kind": "報告書",
      "shifts.0.blocks.1.start": "21:00",
      "shifts.0.blocks.1.end": "21:10",
      "shifts.0.blocks.1.instructed": "yes",
    },
  },
  {
    id: "E08",
    input: i(
      "時給1,400円です。2026-11-02、17:00〜21:00勤務、休憩なし。支払額5,600円。\n2026-11-04、18:00〜22:00勤務、休憩なし。支払額5,600円。",
    ),
    expected: {
      rate: 1400,
      "shifts.length": 2,
      "shifts.1.date": "2026-11-04",
      "shifts.1.blocks.0.start": "18:00",
      "shifts.1.paid": 5600,
    },
  },
  {
    id: "E09",
    input: i(
      "先週の月 水 金 17:00〜21:00、時給1400円。休憩なし。毎日の支払額5600円。",
    ),
    expected: {
      rate: 1400,
      "shifts.length": 3,
      "shifts.0.date": "2026-10-26",
      "shifts.1.date": "2026-10-28",
      "shifts.2.date": "2026-10-30",
      "shifts.2.paid": 5600,
    },
  },
  {
    id: "E10",
    input: i(
      "2026-11-02、17:00〜21:00勤務。時給1400円。休憩なし。明細がまだ届かず、支払額は不明。",
    ),
    expected: {
      rate: 1400,
      "shifts.0.date": "2026-11-02",
      "shifts.0.paid": null,
      "shifts.0.blocks.0.start": "17:00",
      "shifts.0.blocks.0.end": "21:00",
    },
  },
];

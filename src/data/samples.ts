import { blankSheet, type Sheet, type Block } from "../core/schema";
import { FALLBACK_TEMPLATE } from "../core/message";
const block = (kind: Block["kind"], start: string, end: string): Block => ({
  kind,
  start,
  end,
  instructed: "yes",
});
export const samples: {
  id: "class" | "night" | "clear";
  title: string;
  description: string;
  text: string;
  sheet: Sheet;
}[] = [
  {
    id: "class",
    title: "授業の前後が入っていない",
    description: "コマ給・準備と報告書",
    text: "東京都。2026-11-02、授業17:00〜22:30、3コマ、1コマ1800円・110分。指示された準備16:45〜17:00、報告書22:30〜22:40。休憩なし。控除前の支払額5400円。",
    sheet: {
      ...blankSheet("東京都", "class"),
      rate: 1800,
      classMinutes: 110,
      shifts: [
        {
          date: "2026-11-02",
          blocks: [
            block("授業", "17:00", "22:30"),
            block("準備", "16:45", "17:00"),
            block("報告書", "22:30", "22:40"),
          ],
          classes: 3,
          paid: 5400,
          evidence: "架空の明細A・勤務記録。授業外の作業は責任者の指示。",
          uncertain: [],
        },
      ],
      messageTemplate: FALLBACK_TEMPLATE,
    },
  },
  {
    id: "night",
    title: "22時を過ぎた分は？",
    description: "時給・深夜の割増",
    text: "東京都。2026-11-03、18:00〜23:00勤務。時給1400円、休憩なし。控除前の支払額7000円。",
    sheet: {
      ...blankSheet(),
      rate: 1400,
      shifts: [
        {
          date: "2026-11-03",
          blocks: [block("勤務", "18:00", "23:00")],
          classes: null,
          paid: 7000,
          evidence: "架空の明細B・時給1400円、18:00〜23:00、支払7000円。",
          uncertain: [],
        },
      ],
      messageTemplate: FALLBACK_TEMPLATE,
    },
  },
  {
    id: "clear",
    title: "記録と支払いが合う",
    description: "時給・差額なしの例",
    text: "東京都。2026-11-04、17:00〜21:00勤務。時給1400円、休憩なし。控除前の支払額5600円。",
    sheet: {
      ...blankSheet(),
      rate: 1400,
      shifts: [
        {
          date: "2026-11-04",
          blocks: [block("勤務", "17:00", "21:00")],
          classes: null,
          paid: 5600,
          evidence: "架空の明細C・時給1400円、17:00〜21:00、支払5600円。",
          uncertain: [],
        },
      ],
      messageTemplate: FALLBACK_TEMPLATE,
    },
  },
];

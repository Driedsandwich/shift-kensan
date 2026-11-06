import {
  blankSheet,
  blankShift,
  type ExtractionInput,
  type Sheet,
  type Block,
} from "./schema";
import { samples } from "../data/samples";
import { FALLBACK_TEMPLATE } from "./message";
import { dayNumber, dayString } from "./time";
const rangePattern =
  /(\d{1,2}):([0-5]\d)\s*(?:〜|～|~|—|－|-|から)\s*(?:翌(?:日)?)?(\d{1,2}):([0-5]\d)/g;
function clock(h: string, m: string) {
  return `${h.padStart(2, "0")}:${m}`;
}
export function mockExtract(input: ExtractionInput): Sheet {
  if (input.sampleId)
    return structuredClone(samples.find((s) => s.id === input.sampleId)!.sheet);
  const sheet = blankSheet(input.prefecture, input.payType);
  sheet.messageTemplate = FALLBACK_TEMPLATE;
  const text = input.text.normalize("NFKC").replace(/(?<=\d),(?=\d{3})/g, "");
  sheet.rate =
    Number(
      text.match(
        input.payType === "hourly"
          ? /時給\s*(\d+(?:\.\d+)?)\s*円?/
          : /(?:1コマ|コマ単価|コマ給)\s*(\d+)\s*円/,
      )?.[1],
    ) || null;
  sheet.classMinutes =
    Number(
      text.match(
        /(?:1コマ\s*(?:\d+\s*円[・、 ]*)?|コマの長さ\s*)(\d+)\s*分/,
      )?.[1],
    ) || null;
  const dates = [...text.matchAll(/(2026)[/年-](\d{1,2})[/月-](\d{1,2})日?/g)];
  let chunks: { date: string | null; text: string }[] = [];
  if (dates.length) {
    chunks = dates.map((m, i) => ({
      date: `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`,
      text: text.slice(m.index!, dates[i + 1]?.index ?? text.length),
    }));
  } else if (/先週/.test(text)) {
    const now = dayNumber(input.referenceDate),
      dow = new Date(input.referenceDate).getUTCDay(),
      monday = now - ((dow + 6) % 7) - 7;
    const labels = [
      ...text.matchAll(
        /([月火水木金土日])(?:曜(?:日)?)?(?=[\s、・と曜日]|\d|$)/g,
      ),
    ].map((m) => m[1]);
    chunks = [...new Set(labels)].map((d) => ({
      date: dayString(monday + "月火水木金土日".indexOf(d)),
      text,
    }));
  }
  if (!chunks.length && text.trim()) chunks = [{ date: null, text }];
  for (const chunk of chunks) {
    const s = blankShift(chunk.date);
    s.blocks = [];
    s.evidence = chunk.text.slice(0, 1500);
    s.classes =
      Number(chunk.text.match(/(?:授業\s*)?(\d+)\s*コマ/)?.[1]) || null;
    s.paid =
      chunk.text.match(
        /(?:支払(?:われた)?(?:額)?|支給(?:額)?|受取(?:額)?)\s*(\d+)\s*円/,
      )?.[1] !== undefined
        ? Number(
            chunk.text.match(
              /(?:支払(?:われた)?(?:額)?|支給(?:額)?|受取(?:額)?)\s*(\d+)\s*円/,
            )![1],
          )
        : null;
    for (const m of chunk.text.matchAll(rangePattern)) {
      const before = chunk.text.slice(Math.max(0, m.index! - 10), m.index!);
      const after = chunk.text.slice(
        m.index! + m[0].length,
        m.index! + m[0].length + 4,
      );
      const kind = (before.match(/(準備|報告書|研修|片付け|休憩)\s*$/)?.[1] ??
        after.match(/^\s*(休憩)/)?.[1] ??
        (input.payType === "class" ? "授業" : "勤務")) as Block["kind"];
      s.blocks.push({
        kind,
        start: clock(m[1], m[2]),
        end: clock(m[3], m[4]),
        instructed:
          ["勤務", "授業", "休憩"].includes(kind) || /指示|義務/.test(text)
            ? "yes"
            : "unknown",
      });
    }
    for (const kind of ["準備", "報告書", "研修", "片付け"] as const) {
      if (s.blocks.some((b) => b.kind === kind)) continue;
      const re = new RegExp(`${kind}\\s*(\\d+)\\s*分`);
      const m = chunk.text.match(re);
      if (m)
        s.blocks.push({
          kind,
          start: null,
          end: null,
          relative: {
            edge: kind === "準備" ? "before" : "after",
            minutes: Number(m[1]),
          },
          instructed: /指示|義務/.test(text) ? "yes" : "unknown",
        });
    }
    if (!s.blocks.length) s.blocks = blankShift().blocks;
    if (
      !/休憩\s*(?:なし|0分)/.test(chunk.text) &&
      !s.blocks.some((b) => b.kind === "休憩")
    )
      s.uncertain.push(
        "休憩の有無・時刻を確認してください。休憩時間だけの記載では時刻を推定しません。",
      );
    if (!s.date)
      s.uncertain.push("年月日が不明です。曜日だけからは日付を決めません。");
    sheet.shifts.push(s);
  }
  const q: string[] = [];
  if (
    !sheet.shifts.length ||
    sheet.shifts.some(
      (s) => !s.date || s.blocks.some((b) => !b.start && !b.relative),
    )
  )
    q.push("勤務した年月日と、開始・終了の時刻を教えてください。");
  if (!sheet.rate) q.push("時給、または1コマの単価と長さはいくらですか。");
  if (sheet.shifts.some((s) => s.paid === null))
    q.push(
      "同じ勤務に対する控除前の支払額はいくらですか。交通費等は除いてください。",
    );
  if (sheet.shifts.some((s) => s.uncertain.length) && q.length < 3)
    q.push("休憩の時刻と、準備・報告書が指示された作業かを確認できますか。");
  if (input.images.length && !input.sampleId)
    q.unshift(
      "mockは写真を読めません。表を手で入力するか、本番AIの接続を使ってください。",
    );
  sheet.questions = q.slice(0, 3);
  return sheet;
}

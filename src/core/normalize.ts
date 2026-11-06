import { type Sheet } from "./schema";
import { interval, asTime } from "./time";
// AIは「前に15分」をそのまま返す。時刻への加減算はここで行う。
export function normalizeRelative(raw: Sheet): Sheet {
  const sheet = structuredClone(raw);
  for (const shift of sheet.shifts) {
    const main = shift.blocks
      .filter((b) => ["勤務", "授業"].includes(b.kind) && b.start && b.end)
      .map((b) => interval(b.start!, b.end!));
    for (const block of shift.blocks) {
      if (!block.relative) continue;
      if (!main.length) {
        shift.uncertain.push(`${block.kind}の基準となる勤務時刻が不明です。`);
        continue;
      }
      const { edge, minutes } = block.relative;
      const a =
        edge === "before"
          ? Math.min(...main.map((x) => x[0])) - minutes
          : Math.max(...main.map((x) => x[1]));
      if (a < 0 || a + minutes > 2880) {
        shift.uncertain.push(
          `${block.kind}は日付をまたぎます。勤務日の起点と時刻を直してください。`,
        );
        continue;
      }
      block.start = asTime(a);
      block.end = asTime(a + minutes);
      delete block.relative;
    }
  }
  return sheet;
}

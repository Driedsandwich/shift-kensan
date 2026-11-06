import { Fragment, useState, type CSSProperties } from "react";
import type { Sheet, Shift } from "../core/schema";
import { interval } from "../core/time";
import { formatMoney } from "../core/message";

// Display only: the editable source records remain the input to calculate().
export function blockDuration(shift: Shift, kind: string) {
  const blocks = shift.blocks.filter((b) => b.kind === kind);
  if (!blocks.length) return "—";
  if (blocks.some((b) => !b.start || !b.end)) return "未確認";
  return `${blocks.reduce((sum, b) => {
    const [a, z] = interval(b.start!, b.end!);
    return sum + z - a;
  }, 0)}分`;
}
export function ShiftTable({
  sheet,
  onEdit,
  revealRows = false,
}: {
  sheet: Sheet;
  onEdit: (index: number) => void;
  revealRows?: boolean;
}) {
  const [initialRows] = useState(revealRows ? sheet.shifts.length : 0);
  return (
    <div className="record-table">
      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>勤務・授業</th>
            <th>コマ</th>
            <th className="wide-cell">準備</th>
            <th className="wide-cell">報告書</th>
            <th className="wide-cell">支払額</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {sheet.shifts.map((s, i) => {
            const reveal = i < initialRows;
            const style = {
              "--row-delay": `${i * Math.min(90, 600 / Math.max(initialRows - 1, 1))}ms`,
            } as CSSProperties;
            const work = s.blocks.filter(
              (b) => b.kind === "授業" || b.kind === "勤務",
            );
            return (
              <Fragment key={i}>
                <tr className={reveal ? "reveal-row" : undefined} style={style}>
                  <th>
                    {s.date
                      ? `${Number(s.date.slice(5, 7))}/${Number(s.date.slice(8))}`
                      : "未確認"}
                  </th>
                  <td>
                    {work.length
                      ? work.map((b, j) => (
                          <span className="block" key={j}>
                            {b.start ?? "未確認"}〜{b.end ?? "未確認"}
                          </span>
                        ))
                      : "未確認"}
                  </td>
                  <td>{s.classes === null ? "—" : `${s.classes}コマ`}</td>
                  <td className="wide-cell">{blockDuration(s, "準備")}</td>
                  <td className="wide-cell">{blockDuration(s, "報告書")}</td>
                  <td className="wide-cell money">
                    {s.paid === null ? "未確認" : `${formatMoney(s.paid)}円`}
                  </td>
                  <td>
                    <button
                      className="small"
                      onClick={() => onEdit(i)}
                      aria-label={`勤務${i + 1}を直す`}
                    >
                      直す
                    </button>
                  </td>
                </tr>
                <tr
                  className={`mobile-only record-extra${reveal ? " reveal-row" : ""}`}
                  style={style}
                >
                  <td colSpan={4}>
                    <dl>
                      <div>
                        <dt>準備</dt>
                        <dd>{blockDuration(s, "準備")}</dd>
                      </div>
                      <div>
                        <dt>報告書</dt>
                        <dd>{blockDuration(s, "報告書")}</dd>
                      </div>
                      <div>
                        <dt>支払額</dt>
                        <dd>
                          {s.paid === null
                            ? "未確認"
                            : `${formatMoney(s.paid)}円`}
                        </dd>
                      </div>
                      <div>
                        <dt>休憩</dt>
                        <dd>
                          {blockDuration(s, "休憩") === "—"
                            ? "記録なし"
                            : blockDuration(s, "休憩")}
                        </dd>
                      </div>
                    </dl>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

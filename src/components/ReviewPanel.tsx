import { ShiftTable } from "./ShiftTable";
import { scrollBehavior } from "../motion";
import { useState } from "react";
import type { Sheet, Settings, Block } from "../core/schema";
import { blankShift, kinds } from "../core/schema";
import { minimumWages } from "../data/minimum-wages";
import { todayJst } from "./InputPanel";
const nullable = (s: string) => (s === "" ? null : Number(s));
type Props = {
  initialEdit: number | null;
  sheet: Sheet;
  settings: Settings;
  confirmed: boolean;
  error: string;
  onSheet: (s: Sheet) => void;
  onSettings: (s: Settings) => void;
  onConfirm: (b: boolean) => void;
  onCalculate: () => void;
  onBack: () => void;
};
export function ReviewPanel({
  initialEdit,
  sheet,
  settings,
  confirmed,
  error,
  onSheet,
  onSettings,
  onConfirm,
  onCalculate,
  onBack,
}: Props) {
  const [activeShift, setActiveShift] = useState<number | null>(initialEdit);
  const [holidayText, setHolidayText] = useState(
    settings.holidayDates.join("\n"),
  );
  const change = (fn: (s: Sheet) => void) => {
    const s = structuredClone(sheet);
    fn(s);
    onSheet(s);
  };
  return (
    <section className="panel review-panel">
      <h2>読み取った表を確かめる</h2>
      <p className="hint">
        表と給与の設定を見て、違うところは「直す」で修正してください。確認できたら、下の確認欄にチェックを入れて次へ進みます。
      </p>
      {sheet.questions.length > 0 && (
        <aside className="notice">
          <strong>確かめたいこと（最大3つ）</strong>
          <ol>
            {sheet.questions.map((q, i) => (
              <li key={i}>
                {q ===
                "mockは写真を読めません。表を手で入力するか、本番AIの接続を使ってください。"
                  ? "体験用の読み取りでは写真を読めません。写真と見比べながら表を手で入力してください。"
                  : q}
              </li>
            ))}
          </ol>
        </aside>
      )}
      <ShiftTable
        sheet={sheet}
        revealRows={initialEdit === null}
        onEdit={(index) => {
          setActiveShift(index);
          requestAnimationFrame(() => {
            const editor = document.getElementById(`shift-editor-${index}`);
            editor?.scrollIntoView({
              behavior: scrollBehavior(),
              block: "start",
            });
            editor?.focus({ preventScroll: true });
          });
        }}
      />
      <div className="shift-list">
        {sheet.shifts.map((s, i) => (
          <article
            className="shift-card"
            tabIndex={-1}
            id={`shift-editor-${i}`}
            key={i}
            hidden={activeShift !== i}
          >
            <div className="section-head">
              <h3>勤務 {i + 1} を直す</h3>
              <button
                className="small danger"
                onClick={() =>
                  change((v) => {
                    v.shifts.splice(i, 1);
                    setActiveShift(null);
                  })
                }
              >
                この勤務を削除
              </button>
            </div>
            <div className="form-grid">
              <label>
                勤務日
                <input
                  className={!s.date ? "missing" : ""}
                  type="date"
                  value={s.date ?? ""}
                  min="2026-04-01"
                  max="2026-12-31"
                  onChange={(e) =>
                    change((v) => {
                      v.shifts[i].date = e.target.value || null;
                    })
                  }
                />
              </label>
              <label>
                この日の支払額（控除前・円）
                <input
                  type="number"
                  min="0"
                  placeholder="不明なら空欄"
                  value={s.paid ?? ""}
                  onChange={(e) =>
                    change((v) => {
                      v.shifts[i].paid = nullable(e.target.value);
                    })
                  }
                />
              </label>
              {sheet.payType === "class" && (
                <label>
                  授業のコマ数
                  <input
                    type="number"
                    min="0"
                    value={s.classes ?? ""}
                    onChange={(e) =>
                      change((v) => {
                        v.shifts[i].classes = nullable(e.target.value);
                      })
                    }
                  />
                </label>
              )}
            </div>
            {s.uncertain.length > 0 && (
              <ul className="uncertain">
                {s.uncertain.map((x, j) => (
                  <li key={j}>{x}</li>
                ))}
              </ul>
            )}
            <div className="block-list">
              {s.blocks.map((b, j) => (
                <div className="block-row" key={j}>
                  <label>
                    内容
                    <select
                      value={b.kind}
                      onChange={(e) =>
                        change((v) => {
                          v.shifts[i].blocks[j].kind = e.target
                            .value as Block["kind"];
                        })
                      }
                    >
                      {kinds.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    開始
                    <input
                      className={!b.start ? "missing" : ""}
                      inputMode="numeric"
                      placeholder="17:00"
                      value={b.start ?? ""}
                      onChange={(e) =>
                        change((v) => {
                          v.shifts[i].blocks[j].start = e.target.value || null;
                          delete v.shifts[i].blocks[j].relative;
                        })
                      }
                    />
                  </label>
                  <label>
                    終了
                    <input
                      className={!b.end ? "missing" : ""}
                      inputMode="numeric"
                      placeholder="22:30"
                      value={b.end ?? ""}
                      onChange={(e) =>
                        change((v) => {
                          v.shifts[i].blocks[j].end = e.target.value || null;
                          delete v.shifts[i].blocks[j].relative;
                        })
                      }
                    />
                  </label>
                  <label>
                    指示・義務
                    <select
                      value={b.instructed}
                      disabled={b.kind === "休憩"}
                      onChange={(e) =>
                        change((v) => {
                          v.shifts[i].blocks[j].instructed = e.target
                            .value as Block["instructed"];
                        })
                      }
                    >
                      <option value="yes">ある</option>
                      <option value="unknown">わからない</option>
                      <option value="no">ない（除く）</option>
                    </select>
                  </label>
                  <button
                    className="small"
                    aria-label={`勤務${i + 1}の区間${j + 1}を削除`}
                    onClick={() =>
                      change((v) => {
                        v.shifts[i].blocks.splice(j, 1);
                      })
                    }
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
            <button
              className="small"
              onClick={() =>
                change((v) => {
                  v.shifts[i].blocks.push({
                    kind: "準備",
                    start: null,
                    end: null,
                    instructed: "unknown",
                  });
                })
              }
            >
              ＋ 作業・休憩の区間を追加
            </button>
            <button
              className="close-editor"
              onClick={() => setActiveShift(null)}
            >
              編集を閉じる
            </button>
            <details>
              <summary>読み取りの根拠</summary>
              <p className="quote">
                {s.evidence || "根拠の記載なし。原本と照らしてください。"}
              </p>
            </details>
          </article>
        ))}
      </div>
      <button
        onClick={() =>
          change((s) => {
            setActiveShift(s.shifts.length);
            s.shifts.push(blankShift());
          })
        }
        disabled={sheet.shifts.length >= 62}
      >
        ＋ 勤務日を追加
      </button>
      <div className="pay-settings">
        <h3>地域・給与の設定</h3>
        <div className="form-grid">
          <label>
            都道府県
            <select
              value={sheet.prefecture}
              onChange={(e) =>
                change((s) => {
                  s.prefecture = e.target.value;
                })
              }
            >
              {minimumWages.map((r) => (
                <option key={r.prefecture}>{r.prefecture}</option>
              ))}
            </select>
          </label>
          <label>
            給与の形
            <select
              value={sheet.payType}
              onChange={(e) =>
                change((s) => {
                  s.payType = e.target.value as Sheet["payType"];
                })
              }
            >
              <option value="hourly">時給</option>
              <option value="class">授業1回ごとの給与（コマ給）</option>
            </select>
          </label>
          <label>
            {sheet.payType === "hourly" ? "時給（円）" : "1コマの単価（円）"}
            <input
              type="number"
              min="1"
              value={sheet.rate ?? ""}
              onChange={(e) =>
                change((s) => {
                  s.rate = nullable(e.target.value);
                })
              }
            />
          </label>
          {sheet.payType === "class" && (
            <label>
              1コマの長さ（分）
              <input
                type="number"
                min="1"
                value={sheet.classMinutes ?? ""}
                onChange={(e) =>
                  change((s) => {
                    s.classMinutes = nullable(e.target.value);
                  })
                }
              />
            </label>
          )}
        </div>
        <p className="hint">
          扱える勤務日：2026年4月1日〜12月31日。同じ日の勤務は1つのカードにまとめます。翌日1時は「25:00」。終了が開始より早い時刻なら翌日と扱います。
        </p>
      </div>
      <details className="settings">
        <summary>月の支払額を入力する（日ごとの額が不明なとき）</summary>
        <p>
          入力した勤務と同じ期間の、控除前の通常賃金＋割増だけを入れてください。交通費や賞与を除きます。月の額は日別の額に優先します。
        </p>
        {sheet.monthlyPaid.map((p, i) => (
          <div className="form-grid" key={i}>
            <label>
              対象月
              <input
                type="month"
                value={p.month}
                onChange={(e) =>
                  change((s) => {
                    s.monthlyPaid[i].month = e.target.value;
                  })
                }
              />
            </label>
            <label>
              支払額（円）
              <input
                type="number"
                min="0"
                value={p.amount}
                onChange={(e) =>
                  change((s) => {
                    s.monthlyPaid[i].amount = Number(e.target.value);
                  })
                }
              />
            </label>
            <button
              onClick={() =>
                change((s) => {
                  s.monthlyPaid.splice(i, 1);
                })
              }
            >
              月の額を削除
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            change((s) => {
              s.monthlyPaid.push({
                month: s.shifts[0]?.date?.slice(0, 7) || todayJst().slice(0, 7),
                amount: 0,
              });
            })
          }
        >
          ＋ 月の支払額を追加
        </button>
      </details>
      <details className="settings">
        <summary>計算の条件を確認・変更する</summary>
        <div className="form-grid">
          <label>
            週の始まり
            <select
              value={settings.weekStart}
              onChange={(e) =>
                onSettings({ ...settings, weekStart: Number(e.target.value) })
              }
            >
              {[..."日月火水木金土"].map((d, i) => (
                <option value={i} key={i}>
                  {d}曜日
                </option>
              ))}
            </select>
          </label>
          <label>
            月の合計の円未満
            <select
              value={settings.rounding}
              onChange={(e) =>
                onSettings({
                  ...settings,
                  rounding: e.target.value as Settings["rounding"],
                })
              }
            >
              <option value="ceil">切り上げ（初期の仮定）</option>
              <option value="round">四捨五入（比較用）</option>
              <option value="exact">丸めない（比較用）</option>
            </select>
          </label>
          {sheet.payType === "class" && (
            <label>
              コマ給の試算の基礎
              <select
                value={settings.classBasis}
                onChange={(e) =>
                  onSettings({
                    ...settings,
                    classBasis: e.target.value as Settings["classBasis"],
                  })
                }
              >
                <option value="floor">最低賃金による下限の参考額</option>
                <option value="lesson">
                  コマ単価÷授業時間を全作業に適用（仮定）
                </option>
              </select>
            </label>
          )}
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.includeUnknown}
            onChange={(e) =>
              onSettings({ ...settings, includeUnknown: e.target.checked })
            }
          />
          指示が不明な作業を含めて試算する
        </label>
        <label>
          法定休日の日付（1行に1日、例：2026-11-01）
          <textarea
            rows={2}
            value={holidayText}
            onChange={(e) => {
              setHolidayText(e.target.value);
              onSettings({
                ...settings,
                holidayDates: e.target.value.split(/[\n,、 ]+/).filter(Boolean),
              });
            }}
          />
        </label>
        <p className="hint">
          日曜・祝日とは限りません。雇い主が定めた法定休日を確認してください。空欄なら休日割増は計算しません。
        </p>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.completePeriod}
            onChange={(e) =>
              onSettings({ ...settings, completePeriod: e.target.checked })
            }
          />
          同じ週・月の勤務をすべて入力しました
        </label>
        <p className="hint">
          毎月1日〜末日、原則の週40時間で計算します。変形労働時間制、週44時間特例、複数の勤務先などは対象外です。
        </p>
      </details>
      <p id="confirm-help" className="hint">
        下の確認欄にチェックを入れると、差額の見込みを見られます。ここから先はAIを使いません。
      </p>
      <label className="checkbox confirm">
        <input
          type="checkbox"
          id="review-confirm"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
        />
        表と計算の条件を確認しました。支払額は対象の勤務と同じ期間・税金などが引かれる前の額で、休憩は自由に休めた時間です。
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="actions action-bar review-actions">
        {!confirmed && (
          <p className="review-next-hint">
            <a href="#review-confirm">表を確かめたら、確認欄へ ↓</a>
          </p>
        )}
        <button
          className="primary"
          disabled={!confirmed}
          onClick={onCalculate}
          aria-describedby="confirm-help"
        >
          差額の見込みを見る →
        </button>
        <button onClick={onBack}>入力に戻る</button>
      </div>
    </section>
  );
}

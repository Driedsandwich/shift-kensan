import { ImagePreview } from "./ImagePreview";
import { ShiftTable } from "./ShiftTable";
import { CountedAmount } from "./CountedAmount";
import { scrollBehavior } from "../motion";
import { useState } from "react";
import type { Calculation } from "../core/calculate";
import type { Sheet, Settings } from "../core/schema";
import { renderMessage, formatMoney } from "../core/message";
import { consultation, sources } from "../data/sources";
import { minimumWages, VERIFIED_AT } from "../data/minimum-wages";
const yen = (n: number | null) =>
  n === null ? "支払額が未入力" : `${formatMoney(n)}円`;
export function ResultPanel({
  original,
  isSample,
  result,
  sheet,
  settings,
  onEdit,
  onHome,
  onOwnInput,
}: {
  original: { text: string; images: string[] };
  isSample: boolean;
  result: Calculation;
  sheet: Sheet;
  settings: Settings;
  onEdit: (index?: number) => void;
  onHome: () => void;
  onOwnInput: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const message =
    result.paid !== null && result.gap !== null
      ? renderMessage(sheet.messageTemplate, {
          minutes: result.minutes,
          paid: result.paid,
          expected: result.expected,
          gap: result.gap,
        })
      : null;
  function download() {
    const data = JSON.stringify(
      {
        title: "シフト検算・確認用メモ",
        notice: "法的な判断ではありません",
        verifiedAt: VERIFIED_AT,
        settings,
        result,
        sources,
      },
      null,
      2,
    );
    const u = URL.createObjectURL(
      new Blob([data], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = "shift-kensan-report.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  return (
    <>
      <div className="result-title">
        <h1>差額の見込みと根拠</h1>
        <span>
          {sheet.prefecture} · {sheet.payType === "class" ? "コマ給" : "時給"}
        </span>
      </div>
      <div className="result-grid">
        <div className="result-left">
          <section className="panel records-card">
            <div className="section-head">
              <div>
                <h2>勤務日ごとの記録</h2>
                <p className="hint">
                  入力した全{sheet.shifts.length}日を表示 · 控除前の支払額
                </p>
              </div>
              {original.images[0] && (
                <ImagePreview
                  className="receipt-thumb"
                  src={original.images[0]}
                  alt="給与明細の縮小画像"
                  label="給与明細を拡大する"
                />
              )}
            </div>
            <ShiftTable sheet={sheet} onEdit={onEdit} />
            <div className="record-help">
              <span aria-hidden="true">ⓘ</span>
              <p>
                準備・報告書も記録に含まれていますか？
                <br />
                「直す」から入力内容を見直せます。
              </p>
            </div>
          </section>
          <section className="panel questions-card">
            <h2>確かめたい点</h2>
            <ul className="question-list">
              <li>準備・報告書の時間は給与に含まれていますか？</li>
              <li>22時以降の割増は明細のどの項目ですか？</li>
            </ul>
            <details>
              <summary>未確認の条件・確認ポイントを開く</summary>
              <ul className="checklist">
                <li>
                  準備・片付け・研修は、指示されていたか、参加が必要だったか。
                </li>
                <li>報告書や授業の間の質問対応が記録から漏れていないか。</li>
                <li>休憩中に電話番や生徒対応をしていなかったか。</li>
                <li>
                  法定休日、週の始まり、給与の締め日、コマ給に含む作業は何か。
                </li>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          </section>
        </div>
        <div className="result-right">
          <div className="result-overview">
            <section className="panel result-hero">
              <h2>
                {result.gap === null
                  ? "支払額を入れると比較できます"
                  : result.gap > 0
                    ? "この入力条件で、差額の見込み"
                    : "この入力条件では、差額なし"}
              </h2>
              <div className="amount">
                {result.gap !== null && result.gap > 0 && (
                  <span className="amount-prefix">あと</span>
                )}
                <CountedAmount value={result.gap} />
                <span className="estimate">（見込み）</span>
              </div>
              <p className="amount-context">
                入力した{result.days.length}日分・
                {sheet.payType === "class" && settings.classBasis === "floor"
                  ? "最低賃金による下限の参考額"
                  : "確認した単価・前提で試算"}
              </p>
              <p className="condition-note">
                {!settings.completePeriod
                  ? "未確認：週・月の勤務全体、契約条件"
                  : "勤務全体は入力済み・契約条件は要確認"}
              </p>
              {result.gap === 0 && (
                <p className="notice">
                  差額ゼロは、すべての決まりに問題がないという判断ではありません。
                </p>
              )}
            </section>
            <section className="panel breakdown-card">
              <details>
                <summary>
                  <h2>金額と時間の内訳</h2>
                  <span className="sr-only">金額の内訳を開く</span>
                </summary>
                <div className="stat-grid">
                  <div>
                    <span>この条件で計算した給与</span>
                    <strong>{yen(result.expected)}</strong>
                  </div>
                  <div>
                    <span>支払われた額</span>
                    <strong>{yen(result.paid)}</strong>
                  </div>
                  <div>
                    <span>実際に働いた時間</span>
                    <strong>{formatMoney(result.minutes)}分</strong>
                  </div>
                </div>
                <p className="hint">
                  差額は試算額と支払額の比較です。対象の時間ごとの金額を差額に加算するものではありません。
                </p>
              </details>
              <div className="breakdown-row">
                <span className="line-icon" aria-hidden="true">
                  ▤
                </span>
                <div>
                  <strong>
                    {sheet.payType === "class" ? "授業" : "勤務"}の外の時間
                  </strong>
                  <span>
                    {result.days.reduce((n, d) => n + d.outsideMinutes, 0)}分 /
                    入力した{result.days.length}日分
                  </span>
                </div>
              </div>
              <div className="breakdown-row">
                <span className="line-icon moon" aria-hidden="true">
                  ☾
                </span>
                <div>
                  <strong>
                    22時〜翌5時の
                    {result.days.reduce((n, d) => n + d.nightMinutes, 0)}
                    分の割増
                  </strong>
                </div>
              </div>
            </section>
          </div>
          <section className="panel rules-card">
            <div className="rules-primary" id="result-rules" tabIndex={-1}>
              <h2>
                考え方のルール <small>（根拠）</small>
              </h2>
              <Rules
                result={result}
                sheet={sheet}
                settings={settings}
                portion="primary"
              />
            </div>
            <div className="rules-secondary">
              <h2 className="secondary-title">そのほかのルール</h2>
              <Rules
                result={result}
                sheet={sheet}
                settings={settings}
                portion="secondary"
              />
            </div>
          </section>
        </div>
        <aside className="result-notice">
          ⓘ{" "}
          <span>
            入力条件に基づく見込みです。法的な判断ではありません。
            {isSample && "架空の見本を使った計算です。"}
          </span>
        </aside>
        <section className="panel message-card">
          <h2>雇い主に確かめる言い方</h2>
          {message ? (
            <>
              <p className="message" data-testid="message">
                {message.text}
              </p>
              <div className="section-head">
                <p className="hint">
                  {message.verified
                    ? "結果と文章の金額・時間が一致しています"
                    : "結果と文章の金額・時間が一致していません"}
                </p>
                <button
                  className="primary"
                  disabled={!message.verified}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(message.text);
                      setCopied(true);
                      setCopyError("");
                    } catch {
                      setCopied(false);
                      setCopyError(
                        "コピーできませんでした。文面を選択してコピーしてください。",
                      );
                    }
                  }}
                >
                  {copied ? "コピーしました" : "文面をコピー"}
                </button>
              </div>
              <span className={copyError ? "hint" : "sr-only"} role="status">
                {copyError || (copied ? "コピーしました" : "")}
              </span>
            </>
          ) : (
            <p>
              支払額が不明なため、金額入りの相談文はまだ作りません。入力を直して支払額を入れられます。
            </p>
          )}
        </section>
        <section className="panel consultation-card">
          <h2>公的な相談先</h2>
          <a href={consultation.url} target="_blank" rel="noreferrer">
            {consultation.title} ↗
          </a>
          <p className="hint">
            記録や明細を持って相談できます。
            <br />
            受付時間は公式案内で確認してください。
          </p>
        </section>
      </div>
      <div className="result-navigation">
        <p className="hint">
          {isSample
            ? "見本の結果です。続けて自分の写真や文でも試せます。"
            : "入力した記録の結果です。条件や決まりも確認してください。"}
        </p>
        <div className="actions">
          <button onClick={onHome}>最初に戻る</button>
          <button onClick={onOwnInput}>自分の入力で試す</button>
        </div>
        <p className="hint restart-note">
          どちらも今の入力と結果を消して、やり直します。
        </p>
      </div>
      <div className="result-actions action-bar">
        <button
          aria-label="表と条件を直して計算し直す"
          onClick={() => onEdit()}
        >
          入力を直す
        </button>
        <button
          className="primary"
          onClick={() => {
            const el = document.getElementById("result-rules");
            el?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
            el?.focus({ preventScroll: true });
          }}
        >
          根拠を詳しく見る
        </button>
      </div>
      <section className="panel detailed-results">
        <details>
          <summary>月・日ごとの詳しい計算を見る</summary>
          <section className="panel">
            <h2>月ごとの比較</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>月（入力分）</th>
                    <th>実働</th>
                    <th>試算額</th>
                    <th>支払額</th>
                    <th>差額</th>
                  </tr>
                </thead>
                <tbody>
                  {result.months.map((m) => (
                    <tr key={m.month}>
                      <th>{m.month}</th>
                      <td>{m.minutes}分</td>
                      <td>{yen(m.expected)}</td>
                      <td>{yen(m.paid)}</td>
                      <td>{m.gap === null ? "未計算" : yen(m.gap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sheet.payType === "class" &&
              result.months.map((m) => (
                <p className="hint" key={m.month}>
                  {m.month}のコマ数×契約単価：
                  {m.contract === null
                    ? "コマ数または単価が未入力"
                    : yen(m.contract)}
                  。授業外の作業の単価・割増の基礎は契約を確認してください。下限試算と二重に加算しません。
                </p>
              ))}
          </section>
          <section className="panel">
            <h2>日ごとの時間と根拠</h2>
            <p>
              各行の「根拠を開く」で、どの時刻に、どの率を使ったかを確認できます。日別は丸める前の額です。
            </p>
            {result.days.map((d) => (
              <article className="day-result" key={d.date}>
                <div className="section-head">
                  <h3>{d.date}</h3>
                  <strong>試算 {yen(d.expected)}</strong>
                </div>
                <dl className="day-stats">
                  <div>
                    <dt>実働（うち授業外）</dt>
                    <dd>
                      {d.minutes}分（{d.outsideMinutes}分）
                    </dd>
                  </div>
                  <div>
                    <dt>深夜 / 時間外 / 法定休日</dt>
                    <dd>
                      {d.nightMinutes} / {d.overtimeMinutes} /{" "}
                      {d.holidayMinutes}分
                    </dd>
                  </div>
                  <div>
                    <dt>休憩 / 必要な休憩</dt>
                    <dd>
                      {d.breakMinutes} / {d.requiredBreak}分
                    </dd>
                  </div>
                  <div>
                    <dt>通常分 / 割増分</dt>
                    <dd>
                      {yen(d.base)} / {yen(d.premium)}
                    </dd>
                  </div>
                  <div>
                    <dt>最低賃金の通常分 / 契約の通常分</dt>
                    <dd>
                      {yen(d.minimumBase)} /{" "}
                      {d.contractBase === null
                        ? "単価・コマ数が不明"
                        : yen(d.contractBase)}
                    </dd>
                  </div>
                  <div>
                    <dt>最低賃金の通常分との差（参考）</dt>
                    <dd>
                      {d.minimumGap === null ? "未計算" : yen(d.minimumGap)}
                      <small className="block">
                        割増分を除いた契約額ベースの比較
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>支払額 / 差額</dt>
                    <dd>
                      {yen(d.paid)} / {d.gap === null ? "未計算" : yen(d.gap)}
                    </dd>
                  </div>
                </dl>
                {d.warnings.length > 0 && (
                  <ul className="uncertain">
                    {d.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
                <details>
                  <summary>根拠を開く</summary>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>区間（勤務日起点）</th>
                          <th>分</th>
                          <th>基礎時給</th>
                          <th>使った決まり</th>
                          <th>通常＋割増</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.evidence.map((e, i) => (
                          <tr key={i}>
                            <td>
                              {e.start}〜{e.end}
                              <small className="block">暦日 {e.date}</small>
                            </td>
                            <td>{e.minutes}</td>
                            <td>{yen(e.baseRate)}</td>
                            <td>
                              {e.rule}
                              <small className="block">
                                労基法32・37条 / 最低賃金全国一覧
                              </small>
                            </td>
                            <td>{yen(e.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </article>
            ))}
          </section>
        </details>
      </section>
      <div className="actions export-actions">
        <button onClick={() => window.print()}>確認メモを印刷</button>
        <button onClick={download}>計算の根拠をファイルに保存</button>
      </div>
      <section className="panel">
        <details>
          <summary>計算の前提と範囲</summary>
          <ul>
            {result.assumptions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p>
            18歳以上の学生アルバイト等の一般的な雇用を想定。変形・フレックス・裁量労働、特定最低賃金、減額特例、複数勤務先の通算、各種手当・固定残業代の精算、出来高払の個別判断は対応していません。18歳未満の深夜業の可否等は判定しません。
          </p>
        </details>
      </section>
    </>
  );
}
function Rules({
  result,
  sheet,
  settings,
  portion,
}: {
  portion: "primary" | "secondary";
  result: Calculation;
  sheet: Sheet;
  settings: Settings;
}) {
  const wage = minimumWages.find((w) => w.prefecture === sheet.prefecture)!;
  const rates = [
    ...new Set(result.days.flatMap((d) => d.evidence.map((e) => e.minimum))),
  ];
  const rounding =
    settings.rounding === "ceil"
      ? "切り上げ"
      : settings.rounding === "round"
        ? "四捨五入"
        : "丸めなし";
  const groups = [
    {
      title: `${sheet.prefecture} 最低賃金 ${rates.map((r) => formatMoney(r)).join(" / ")}円`,
      source: sources.find((s) => s.id === "minimum")!,
      date: rates.includes(wage.previous)
        ? `適用：勤務日で照合（改定 ${wage.effective}）`
        : `適用 ${wage.effective}〜`,
      text: `改定前 ${wage.previous}円 / 改定後 ${wage.amount}円。基礎時給と勤務分数は下の各区間に表示。通常分＝基礎時給×分数÷60。`,
    },
    {
      title: "深夜 25%",
      source: sources.find((s) => s.id === "premium")!,
      date: "適用：22時〜翌5時",
      text: "深夜割増＝各区間の基礎時給×深夜の分数÷60×25%。時間外・法定休日と重なる場合は深夜分を加算。",
    },
    {
      title: "時間外・休日：条件を確認",
      source: sources.find((s) => s.id === "law")!,
      date: "適用：入力した週・月・休日",
      text: `日8時間・週40時間の超過は重複を除き25%、月60時間超は50%。法定休日は35%。週起算日：${"日月火水木金土"[settings.weekStart]}曜日。指定した法定休日：${settings.holidayDates.join("、") || "なし（未指定）"}。`,
    },
    {
      title: "休憩：記録を確認",
      source: sources.find((s) => s.id === "law")!,
      date: "適用：入力した勤務日",
      text: "実働6時間超で45分、8時間超で60分の休憩を確認。休憩不足を自動で労働時間から差し引きません。",
    },
  ];
  return (
    <div className="rule-list">
      {groups.map(
        (g, i) =>
          (portion === "primary" ? i < 2 : i >= 2) && (
            <div className="rule" key={g.title}>
              <details>
                <summary>
                  <span>{g.title}</span>
                </summary>
                <p>{g.text}</p>
                <p>
                  月の合計の円未満：{rounding}
                  （入力した仮定）。日別・区間別は丸め前です。
                </p>
                <p>
                  {sheet.payType === "class"
                    ? `コマ給の基礎：${settings.classBasis === "floor" ? "最低賃金による下限の参考額" : "コマ単価÷授業時間を全作業に適用する仮定"}`
                    : `入力時給：${yen(sheet.rate)}`}
                </p>
                {i < 2 && (
                  <ul className="evidence-list">
                    {result.days.map((d) => (
                      <li key={d.date}>
                        {d.date}：実働{d.minutes}分 / 深夜{d.nightMinutes}分
                        {d.evidence.map((e, j) => (
                          <small className="block" key={j}>
                            {e.start}〜{e.end}：{yen(e.baseRate)} × {e.minutes}
                            分 ÷ 60{i === 1 ? ` × ${e.nightRate}%` : ""}
                          </small>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
              <div className="rule-meta">
                <small>{g.date}</small>
                <a
                  className="rule-source"
                  href={g.source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {i === 0
                    ? "厚生労働省「最低賃金全国一覧」"
                    : i === 1
                      ? "厚生労働省「割増賃金」"
                      : "厚生労働省「労働基準法」"}{" "}
                  ↗
                </a>
              </div>
            </div>
          ),
      )}
    </div>
  );
}
export function SourcesPanel() {
  return (
    <section className="panel sources">
      <details>
        <summary>使っている決まり・公的な出典</summary>
        <p>
          確認日：{VERIFIED_AT}
          。原文を要約しています。改正の自動取得は行いません。
        </p>
        {sources.map((s) => (
          <div key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.title} ↗
            </a>
            <p>{s.detail}</p>
          </div>
        ))}
        <details>
          <summary>47都道府県の最低賃金表</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>都道府県</th>
                  <th>改定前</th>
                  <th>改定後</th>
                  <th>発効日</th>
                </tr>
              </thead>
              <tbody>
                {minimumWages.map((r) => (
                  <tr key={r.prefecture}>
                    <th>{r.prefecture}</th>
                    <td>{r.previous}円</td>
                    <td>{r.amount}円</td>
                    <td>{r.effective}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </details>
    </section>
  );
}

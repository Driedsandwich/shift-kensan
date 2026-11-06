import { useState } from "react";
import { CostNotice } from "./CostNotice";
import { minimumWages } from "../data/minimum-wages";
import { samples } from "../data/samples";
import type { ExtractionInput } from "../core/schema";
export function todayJst() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(
    new Date(),
  );
}
async function imageData(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(
      "JPEG・PNG・WebPの写真を選んでください。HEICはJPEGに変換してください。",
    );
  if (file.size > 15000000)
    throw new Error("1枚15MBまでの写真を選んでください。");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#fff";
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let quality = 0.85,
    data = canvas.toDataURL("image/jpeg", quality);
  while (data.length > 1000000 && quality > 0.35) {
    quality -= 0.1;
    data = canvas.toDataURL("image/jpeg", quality);
  }
  if (data.length > 1000000)
    throw new Error("写真が細かすぎます。必要な部分を切り取ってください。");
  return data;
}
type Props = {
  busy: boolean;
  provider: string;
  error: string;
  onExtract: (i: ExtractionInput) => void;
  onManual: (prefecture: string, payType: "hourly" | "class") => void;
};
export function InputPanel({
  busy,
  provider,
  error,
  onExtract,
  onManual,
}: Props) {
  const [sampleSelected, setSampleSelected] = useState(false);
  const [text, setText] = useState(""),
    [prefecture, setPrefecture] = useState("東京都"),
    [payType, setPayType] = useState<"hourly" | "class">("hourly"),
    [images, setImages] = useState<string[]>([]),
    [imageError, setImageError] = useState(""),
    [loading, setLoading] = useState(false),
    [referenceDate, setReferenceDate] = useState(todayJst());
  const trySample = (s: (typeof samples)[number]) => {
    setSampleSelected(true);
    onExtract({
      text: s.text,
      images: [],
      prefecture: s.sheet.prefecture,
      payType: s.sheet.payType,
      referenceDate,
      sampleId: s.id,
      forceMock: true,
    });
  };
  async function select(files: FileList | null) {
    if (!files) return;
    setImageError("");
    setLoading(true);
    try {
      if (files.length + images.length > 3)
        throw new Error("写真は3枚までです。");
      const data = await Promise.all(Array.from(files).map(imageData));
      setImages((p) => [...p, ...data]);
    } catch (e) {
      setImageError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <section className="panel sample-panel" aria-labelledby="sample-title">
        <div className="section-head">
          <div>
            <span className="eyebrow">まずは、1分で</span>
            <h2 id="sample-title">見本で試す</h2>
          </div>
          <span className="tag">架空の見本</span>
        </div>
        <CostNotice />
        <button
          className="primary sample-start"
          disabled={busy}
          onClick={() => trySample(samples[0])}
          aria-describedby="sample-next"
        >
          {busy && sampleSelected ? "見本を開いています…" : "見本で試す"}
        </button>
        <p id="sample-next" className="hint">
          見本の表を開き、確認して差額の見込みへ。
        </p>
        {error && sampleSelected && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="muted">ほかの見本も選べます。すべて架空の記録です。</p>
        <div className="sample-grid">
          {samples.map((s, i) => (
            <button
              className="sample-card"
              key={s.id}
              disabled={busy}
              onClick={() => trySample(s)}
            >
              <img
                src={`/samples/${s.id}.png`}
                alt={`架空の明細${String.fromCharCode(65 + i)}と勤務記録`}
              />
              <span className="sample-number">0{i + 1}</span>
              <strong>{s.title}</strong>
              <span>{s.description}</span>
              <span className="sample-action">この見本で試す →</span>
            </button>
          ))}
        </div>
      </section>
      <section className="panel own-input" aria-labelledby="own-input-title">
        <span className="eyebrow">自分の記録で</span>
        <h2 id="own-input-title" tabIndex={-1}>
          自分の入力で試す
        </h2>
        <p>
          写真か文のどちらかだけでも進めます。日付、時刻、休憩、時給や授業1回あたりの給与、支払額を、わかる範囲で入れてください。
        </p>
        <div className="form-grid">
          <label>
            働く場所の都道府県
            <select
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
            >
              {minimumWages.map((r) => (
                <option key={r.prefecture}>{r.prefecture}</option>
              ))}
            </select>
          </label>
          <label>
            給与の形
            <select
              value={payType}
              onChange={(e) => setPayType(e.target.value as typeof payType)}
            >
              <option value="hourly">時給</option>
              <option value="class">授業1回ごとの給与（コマ給）</option>
            </select>
          </label>
        </div>
        <label>
          シフトや給与についてのメモ
          <textarea
            rows={6}
            maxLength={12000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              "例：2026-11-02、17:00〜22:30勤務。時給1400円。前に15分準備、後に報告書10分。休憩なし。支払額7700円。準備と報告書は指示されています。"
            }
          />
        </label>
        <div className="form-grid">
          <label className="photo-picker">
            明細・シフトの写真（3枚まで）
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy || loading}
              onChange={(e) => {
                void select(e.target.files);
                e.target.value = "";
              }}
            />
            <span className="photo-picker-button" aria-hidden="true">
              写真を選ぶ
            </span>
          </label>
          <label>
            「先週」の基準日
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
            />
          </label>
        </div>
        {images.length > 0 && (
          <div className="image-previews">
            {images.map((url, i) => (
              <figure key={i}>
                <img src={url} alt={`送信前の写真${i + 1}`} />
                <button
                  className="small"
                  onClick={() => setImages((p) => p.filter((_, j) => i !== j))}
                >
                  写真{i + 1}を外す
                </button>
              </figure>
            ))}
          </div>
        )}
        <p className="privacy">
          氏名・口座番号は隠してから選んでください。写真は端末内で縮小し、読み取りボタンを押すまで外に送りません。アプリは記録をサーバーやブラウザの保存領域に残しません。AIを使う読み取りでは文と写真が送られ、提供元の保存条件が適用されます。
        </p>
        {provider === "mock" && (
          <p className="notice">
            現在はAIを使わない体験用の読み取りです。日付と時刻を含む文を表にします。自分の写真の読み取りには対応していません。写真を見ながら表を手入力できます。
          </p>
        )}
        {provider === "unavailable" && (
          <p className="notice">
            読み取り機能に接続できません。表の手入力と検算を利用できます。
          </p>
        )}
        {(imageError || (error && !sampleSelected)) && (
          <p className="error" role="alert">
            {imageError || error}
          </p>
        )}
        <CostNotice />
        <div className="actions">
          <button
            disabled={
              busy ||
              loading ||
              provider === "checking" ||
              (!text.trim() && !images.length)
            }
            onClick={() => {
              setSampleSelected(false);
              onExtract({ text, images, prefecture, payType, referenceDate });
            }}
          >
            {busy
              ? "読み取り中…（最大50秒）"
              : loading
                ? "写真を準備中…"
                : provider === "checking"
                  ? "読み取りの準備中…"
                  : provider === "mock"
                    ? "文を表にする（AIは使いません）"
                    : "AI で読む（数秒かかります）"}
          </button>
          <button disabled={busy} onClick={() => onManual(prefecture, payType)}>
            表を手で入力する
          </button>
        </div>
        <p className="hint">
          読み取り後は表を確かめます。違うところは直してから計算できます。
        </p>
      </section>
    </>
  );
}

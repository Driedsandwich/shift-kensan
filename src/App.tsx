import { useEffect, useRef, useState } from "react";
import { scrollBehavior } from "./motion";
import { ImagePreview } from "./components/ImagePreview";
import { InputPanel } from "./components/InputPanel";
import { ReviewPanel } from "./components/ReviewPanel";
import { ResultPanel, SourcesPanel } from "./components/ResultPanel";
import {
  blankSheet,
  blankShift,
  defaultSettings,
  sheetSchema,
  type Sheet,
  type Settings,
  type ExtractionInput,
} from "./core/schema";
import { calculate, type Calculation } from "./core/calculate";
export default function App() {
  const ownInput = useRef(false);
  const [original, setOriginal] = useState<{ text: string; images: string[] }>({
    text: "",
    images: [],
  });
  const [step, setStep] = useState(0),
    [sheet, setSheet] = useState<Sheet>(blankSheet()),
    [settings, setSettings] = useState<Settings>(defaultSettings),
    [result, setResult] = useState<Calculation | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [provider, setProvider] = useState("checking"),
    [used, setUsed] = useState(""),
    [generation, setGeneration] = useState(0),
    [isSample, setIsSample] = useState(false),
    [editIndex, setEditIndex] = useState<number | null>(null);
  useEffect(() => {
    void fetch("/api/analyze", { cache: "no-store" })
      .then((r) => r.json())
      .then((v) => setProvider(v.ready ? v.provider : "unavailable"))
      .catch(() => setProvider("unavailable"));
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () =>
      document.documentElement.classList.toggle(
        "keyboard-open",
        Boolean(viewport && window.innerHeight - viewport.height > 150),
      );
    viewport?.addEventListener("resize", update);
    update();
    return () => {
      viewport?.removeEventListener("resize", update);
      document.documentElement.classList.remove("keyboard-open");
    };
  }, []);
  useEffect(() => {
    const target = ownInput.current
      ? document.getElementById("own-input-title")
      : document.getElementById("journey-title");
    target?.focus({ preventScroll: true });
    if (ownInput.current) {
      target?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
      ownInput.current = false;
    }
  }, [step, generation]);
  const move = (n: number) => {
    setStep(n);
    setError("");
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  };
  async function extract(input: ExtractionInput) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(53000),
      });
      const data = await response.json();
      if (!response.ok) {
        const problem = new Error(data.error || "読み取りに失敗しました。");
        problem.name = "ApiClientError";
        throw problem;
      }
      setIsSample(Boolean(input.sampleId));
      setEditIndex(null);
      setOriginal({
        text: input.text,
        images: input.sampleId
          ? [`/samples/${input.sampleId}.png`]
          : input.images,
      });
      setSheet(sheetSchema.parse(data.sheet));
      setSettings({ ...defaultSettings });
      setConfirmed(false);
      setResult(null);
      setUsed(
        `${input.sampleId ? "見本の表を表示" : data.provider === "mock" ? "AIを使わず文を表に変換" : "AIで読み取り"} / AIの利用 ${data.aiCalls}回`,
      );
      move(1);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "TimeoutError"
          ? "読み取りの待ち時間を超えました。表の手入力も使えます。"
          : e instanceof Error && e.name === "ApiClientError"
            ? e.message
            : "読み取りに接続できませんでした。入力は残っています。表の手入力でも続けられます。",
      );
    } finally {
      setBusy(false);
    }
  }
  function compute() {
    try {
      const r = calculate(sheet, settings);
      setResult(r);
      move(2);
    } catch (e) {
      const err = e as Error;
      setError(
        err.name === "ZodError"
          ? "日付・時刻・金額の形式を確認してください。時刻は17:00のように半角で入力します。"
          : err.message,
      );
    }
  }
  function reset() {
    setOriginal({ text: "", images: [] });
    setSheet(blankSheet());
    setSettings({ ...defaultSettings });
    setResult(null);
    setConfirmed(false);
    setUsed("");
    setIsSample(false);
    setGeneration((g) => g + 1);
    move(0);
  }
  return (
    <>
      <header className={`topbar step-${step}`}>
        {step === 1 && (
          <>
            <button className="header-back" onClick={() => move(0)}>
              ← 戻る
            </button>
            <h1 className="header-page-title">表を確かめる</h1>
          </>
        )}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (!busy) reset();
          }}
          className="brand"
        >
          シフト検算
        </a>
        <span className="header-caption">
          アルバイトの給与を、記録から確かめる
        </span>
        <span className="tag">
          {isSample && step > 0
            ? "架空の見本"
            : provider === "openai"
              ? "AI読み取り対応"
              : "見本・手入力で体験"}
        </span>
        {step === 2 && (
          <button
            className="header-edit"
            onClick={() => {
              setEditIndex(0);
              setConfirmed(false);
              move(1);
            }}
          >
            入力を直す
          </button>
        )}
      </header>
      <main className={`screen-${step}`}>
        <nav className="journey" aria-label="使い方と現在の段階">
          <p id="journey-title" className="journey-title" tabIndex={-1}>
            <strong>{step + 1} / 3</strong>
            {step === 0
              ? "まずは見本で試せます"
              : step === 1
                ? "表を確かめて、次へ"
                : "差額の見込みと根拠を確認"}
          </p>
          <ol className="steps">
            {[
              "働き方を入れる（見本・写真・文）",
              "読み取った表を確かめる",
              "差額の見込みと根拠を見る",
            ].map((label, i) => (
              <li
                key={label}
                className={step === i ? "active" : step > i ? "done" : ""}
                aria-current={step === i ? "step" : undefined}
              >
                <span aria-hidden="true">{i + 1}</span>
                <div>{label}</div>
              </li>
            ))}
          </ol>
        </nav>
        {step === 0 && (
          <div className="hero">
            <span className="eyebrow">
              働いた時間を、なかったことにしない。
            </span>
            <h1>
              アルバイトのお給料、
              <br className="mobile-break" />
              記録と合ってる？
            </h1>
            <p>
              シフトや明細を表にして、お給料の差額の見込みと根拠を確かめます。
            </p>
          </div>
        )}
        {step === 1 && <h1 className="page-title">表を確かめる</h1>}
        <div hidden={step !== 0}>
          <InputPanel
            key={generation}
            busy={busy}
            provider={provider}
            error={error}
            onExtract={extract}
            onManual={(prefecture, payType) => {
              setIsSample(false);
              setEditIndex(0);
              setSheet({
                ...blankSheet(prefecture, payType),
                shifts: [blankShift()],
              });
              setSettings({ ...defaultSettings });
              setOriginal({ text: "", images: [] });
              setUsed("本人が手入力");
              setConfirmed(false);
              move(1);
            }}
          />
        </div>
        {step === 1 && original.images.length > 0 && (
          <section className="panel original">
            <h2>読み取った給与明細（写真）</h2>
            {original.images.map((url, i) => (
              <ImagePreview
                key={i}
                src={url}
                alt={`確認用の元画像${i + 1}`}
                label={`元画像${i + 1}を拡大する`}
              />
            ))}
            <details>
              <summary>元のメモ・写真と見比べる</summary>
              <p className="quote">
                {original.text ||
                  "上の写真を拡大して、読み取り内容と見比べられます。"}
              </p>
            </details>
          </section>
        )}
        {step === 1 && original.text && original.images.length === 0 && (
          <section className="panel original-note">
            <details>
              <summary>元のメモ・写真と見比べる</summary>
              <p className="quote">
                {original.text ||
                  "上の写真を拡大して、読み取り内容と見比べられます。"}
              </p>
            </details>
          </section>
        )}
        {step === 1 && (
          <ReviewPanel
            initialEdit={editIndex}
            sheet={sheet}
            settings={settings}
            confirmed={confirmed}
            error={error}
            onSheet={(s) => {
              setSheet(s);
              setConfirmed(false);
              setError("");
            }}
            onSettings={(s) => {
              setSettings(s);
              setConfirmed(false);
            }}
            onConfirm={setConfirmed}
            onCalculate={compute}
            onBack={() => move(0)}
          />
        )}
        {step === 2 && result && (
          <ResultPanel
            original={original}
            isSample={isSample}
            result={result}
            sheet={sheet}
            settings={settings}
            onHome={reset}
            onOwnInput={() => {
              ownInput.current = true;
              reset();
            }}
            onEdit={(index) => {
              setEditIndex(typeof index === "number" ? index : 0);
              setConfirmed(false);
              move(1);
            }}
          />
        )}
        {used && step > 0 && (
          <p className="status" role="status">
            {used} · 表の修正・計算ではAIを使いません
          </p>
        )}
        <SourcesPanel />
        {step === 0 && (
          <section className="how-it-works">
            <h2>AIが表にし、決まった計算式で確かめます。</h2>
            <p>
              AIの役割は、ばらばらな記録を表にすること。働いた分数・最低賃金・割増・差額は、公開した決まりと計算式で確かめます。結果は雇い主や相談窓口と確認するための材料です。
            </p>
          </section>
        )}
      </main>
      <footer>
        <p>シフト検算 · 学生の「わからない」を、確かめられる形に。</p>
        <p>法的な判断ではありません。入力した記録は保存しません。</p>
        <button disabled={busy} onClick={reset}>
          入力と結果を消して、最初に戻る
        </button>
      </footer>
    </>
  );
}

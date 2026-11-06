import { writeFileSync, mkdirSync } from "node:fs";
import { calculate } from "../src/core/calculate";
import { createProvider } from "../server/providers";
import { extractSheet } from "../server/pipeline";
import { cases } from "./cases";
import { extractionCases } from "./extraction-cases";
const real = process.argv.includes("--real");
if (real && (!process.env.AI_API_KEY || !process.env.AI_MODEL)) {
  console.error(
    "本物の評価は未実行: AI_API_KEY・AI_MODELをサーバー環境変数に設定してください。",
  );
  process.exit(2);
}
let failures = 0;
const calculations = cases.map((c) => {
  const r = calculate(c.sheet, c.settings);
  const actual: Record<string, unknown> = {
    minutes: r.minutes,
    amount: r.expected,
    gap: r.gap,
    ot: r.days.reduce((n, d) => n + d.overtimeMinutes, 0),
    night: r.days.reduce((n, d) => n + d.nightMinutes, 0),
    holiday: r.days.reduce((n, d) => n + d.holidayMinutes, 0),
    rest: r.days.reduce((n, d) => n + d.breakMinutes, 0),
    requiredRest: r.days.reduce((n, d) => n + d.requiredBreak, 0),
  };
  const mismatch = Object.entries(c.gold).filter(([k, v]) =>
    typeof v === "number"
      ? Math.abs(Number(actual[k]) - v) > 1e-6
      : actual[k] !== v,
  );
  if (mismatch.length) failures++;
  return {
    id: c.id,
    name: c.name,
    passed: !mismatch.length,
    expected: c.gold,
    actual,
    manual: c.manual,
  };
});
const extractions = [];
let matched = 0,
  total = 0;
for (const c of extractionCases) {
  try {
    const r = await extractSheet(
      c.input,
      createProvider(
        real
          ? { ...process.env, AI_PROVIDER: "openai" }
          : { AI_PROVIDER: "mock" },
      ),
    );
    const fields = Object.entries(c.expected).map(([path, expected]) => {
      let actual: any = r.sheet;
      for (const p of path.split(".")) actual = actual?.[p];
      const passed = JSON.stringify(expected) === JSON.stringify(actual);
      total++;
      if (passed) matched++;
      return { path, expected, actual, passed };
    });
    const passed = fields.every((f) => f.passed);
    if (!passed) failures++;
    extractions.push({ id: c.id, passed, aiCalls: r.aiCalls, fields });
  } catch {
    failures++;
    total += Object.keys(c.expected).length;
    extractions.push({
      id: c.id,
      passed: false,
      error: "接続またはJSON検査失敗。入力・生のAI出力は保存しません。",
    });
  }
}
const report = {
  mode: real ? "real" : "mock",
  runAt: new Date().toISOString(),
  calculation: {
    passed: calculations.filter((c) => c.passed).length,
    total: cases.length,
    accuracy: calculations.filter((c) => c.passed).length / cases.length,
  },
  extraction: {
    matched,
    total,
    fieldAccuracy: matched / total,
    casesPassed: extractions.filter((c) => c.passed).length,
    casesTotal: extractionCases.length,
  },
  calculations,
  extractions,
  limitations:
    "合成の既知ケースの回帰評価。実際の写真・手書き・全契約形態の精度を示しません。mockの抽出精度はAI性能ではありません。",
};
mkdirSync("verification", { recursive: true });
writeFileSync(
  `verification/evaluation-${real ? "real" : "mock"}.json`,
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      mode: report.mode,
      calculation: report.calculation,
      extraction: report.extraction,
    },
    null,
    2,
  ),
);
if (failures) {
  console.error("不一致: " + failures);
  process.exitCode = 1;
}

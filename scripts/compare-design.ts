import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const [
  referenceDirectory,
  captureDirectory = "verification/c3",
  outputDirectory = "verification/c3",
] = process.argv.slice(2);
if (!referenceDirectory)
  throw new Error(
    "参照画像img1.png〜img3.pngのフォルダ、撮影フォルダ、出力フォルダを指定してください。",
  );
const png = async (path: string) =>
  `data:image/png;base64,${(await readFile(path)).toString("base64")}`;
const [
  reviewReference,
  resultReference,
  desktopReference,
  review,
  result,
  desktop,
] = await Promise.all([
  png(join(referenceDirectory, "img1.png")),
  png(join(referenceDirectory, "img2.png")),
  png(join(referenceDirectory, "img3.png")),
  png(join(captureDirectory, "review-390.png")),
  png(join(captureDirectory, "result-390.png")),
  png(join(captureDirectory, "result-1280.png")),
]);
const figure = (title: string, size: string, src: string) =>
  `<figure><figcaption><strong>${title}</strong><span>${size}</span></figcaption><img src="${src}" alt="${title}"/></figure>`;
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>C3 見本と実装の比較</title><style>
*{box-sizing:border-box}body{margin:0;padding:32px;width:1696px;color:#213D34;background:#F4F6F0;font-family:"Noto Sans JP","Noto Sans CJK JP",sans-serif}h1{margin:0;font-size:32px}p{font-size:16px;margin:8px 0 24px;color:#64756B}h2{font-size:24px;margin:32px 0 16px}.row{display:grid;gap:24px}.mobile{grid-template-columns:repeat(4,390px)}.desktop{grid-template-columns:repeat(2,minmax(0,1fr))}figure{margin:0;min-width:0}figcaption{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:12px;font-size:18px}figcaption span{color:#64756B;font-size:14px}img{display:block;width:100%;height:auto;box-shadow:0 0 0 1px #D8E0D6;border-radius:8px}footer{border-top:1px solid #D8E0D6;margin-top:24px;padding-top:16px;font-size:16px;color:#64756B}
</style><h1>C3 数字から理解 ─ 見本と実装</h1><p>見本の文字・数値は例。実装は既存データの1日分・差額2,387円を表示しています。各画像はブラウザの撮影内容です。</p>
<h2>スマホ / 読み取りの確認・検算の結果</h2><div class="row mobile">${figure("確認 · 見本", "390 × 844", reviewReference)}${figure("確認 · 実装", "390 × 844", review)}${figure("結果 · 見本", "390 × 844", resultReference)}${figure("結果 · 実装", "390 × 844", result)}</div>
<h2>パソコン / 結果と根拠</h2><div class="row desktop">${figure("見本", "1440 × 900 → 同じ表示幅に縮小", desktopReference)}${figure("実装", "1280 × 1100 → 同じ表示幅に縮小", desktop)}</div>
<footer>実装は元の確認チェックと詳細な設定を維持。スマホの質問は16px・複数行とし、続きはスクロールで表示します。全体画像は screenshots の「-full.png」に収録。</footer></html>`;
await mkdir(outputDirectory, { recursive: true });
await writeFile(join(outputDirectory, "comparison.html"), html);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1696, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((img) => img.decode()));
  });
  await page.screenshot({
    path: join(outputDirectory, "comparison.png"),
    fullPage: true,
  });
  console.log(resolve(outputDirectory, "comparison.png"));
} finally {
  await browser.close();
}

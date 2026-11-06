import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const output = resolve(process.argv[2] || "verification/polish");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
    : {}),
});
try {
  for (const width of [390, 1280]) {
    const images = await Promise.all(
      ["before", "after"].map(
        async (phase) =>
          `data:image/png;base64,${(await readFile(join(output, phase, `result-${width}.png`))).toString("base64")}`,
      ),
    );
    const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>シフト検算・変更前後 ${width}px</title>
<style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f8faf5;color:#213d34;font-family:"Noto Sans JP","Noto Sans CJK JP",sans-serif}h1{font-size:24px;margin:0 0 8px}p{font-size:14px;color:#52665b;margin:0 0 20px}.row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}figure{margin:0}figcaption{margin-bottom:12px;font-weight:700;font-size:18px}img{display:block;width:100%;border:1px solid #dce5dd;border-radius:8px}</style>
<h1>シフト検算 / ${width === 390 ? "スマホの結果" : "パソコンの結果と根拠"}</h1>
<p>同じ見本・入力1日分・差額2,387円。各画面 ${width} × ${width === 390 ? 844 : 1100}px。ローカルで実画面を撮影。</p>
<div class="row"><figure><figcaption>変更前 / 深緑の一色</figcaption><img src="${images[0]}" alt="変更前の結果画面"></figure><figure><figcaption>変更後 / 緑 ＋ 暖かい琥珀</figcaption><img src="${images[1]}" alt="変更後の結果画面"></figure></div></html>`;
    await writeFile(join(output, `comparison-${width}.html`), html);
    const page = await browser.newPage({
      viewport: { width: width * 2 + 72, height: 1000 },
      deviceScaleFactor: 1,
    });
    await page.setContent(html);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map((img) => img.decode()));
    });
    await page.screenshot({
      path: join(output, `comparison-${width}.png`),
      fullPage: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

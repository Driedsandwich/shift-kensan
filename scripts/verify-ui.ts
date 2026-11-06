import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";
// ビルド済みの本番HTML/JSとesbuildの関数1本を、Vercel相当の入口から検査する。
const { default: handler } = await import(
  pathToFileURL(resolve("api/analyze.js")).href
);
process.env.AI_PROVIDER = "mock";
process.env.IP_RATE_MAX = "200";
const root = resolve("dist");
const server = createServer(async (req, res) => {
  try {
    if (req.url?.split("?")[0] === "/api/analyze") {
      await handler(req, res);
      return;
    }
    const path = resolve(
      root,
      "." +
        decodeURIComponent(
          new URL(req.url || "/", "http://localhost").pathname,
        ),
    );
    if (path !== root && !path.startsWith(root + "/")) {
      res.statusCode = 403;
      res.end();
      return;
    }
    const target = (await stat(path).catch(() => null))?.isDirectory()
      ? resolve(path, "index.html")
      : path;
    const data = await readFile(target);
    const mime: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".png": "image/png",
    };
    res.setHeader(
      "Content-Type",
      mime[extname(target)] || "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
mkdirSync("verification", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
    : {}),
});
const checks: { name: string; passed: boolean }[] = [];
const browserErrors: string[] = [];
try {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on("pageerror", (e) => browserErrors.push(e.message));
    await page.goto(base);
    await expect(
      page.getByRole("heading", { name: "見本で試す" }),
    ).toBeVisible();
    await page.screenshot({
      path: `verification/home-${viewport.width}.png`,
      fullPage: true,
    });
    for (const [label, gap] of [
      ["授業の前後が入っていない", "2,387"],
      ["22時を過ぎた分は？", "350"],
      ["記録と支払いが合う", "0"],
    ]) {
      await page
        .getByRole("button", { name: new RegExp(label.replace("？", "\\？")) })
        .click();
      await expect(
        page.getByRole("heading", { name: "読み取った表を確かめる" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "差額の見込みを見る →" }),
      ).toBeDisabled();
      await page
        .getByRole("checkbox", { name: /表と計算の条件を確認/ })
        .check();
      await page.getByRole("button", { name: "差額の見込みを見る →" }).click();
      await expect(page.getByTestId("gap")).toContainText(gap);
      await expect(
        page.getByText("結果と文章の金額・時間が一致しています", {
          exact: false,
        }),
      ).toBeVisible();
      if (gap === "2,387")
        await page.screenshot({
          path: `verification/result-${viewport.width}.png`,
          fullPage: true,
        });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      checks.push({
        name: `${viewport.width}px / ${label} / 結果と文の照合`,
        passed: true,
      });
      await page
        .getByRole("button", { name: "入力と結果を消して、最初に戻る" })
        .click();
    }
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => browserErrors.push(e.message));
  await page.goto(base);
  await page
    .getByLabel("シフトや給与についてのメモ")
    .fill("2026-11-05、18:10〜23:20勤務。時給1733円。休憩なし。支払額8954円。");
  await page
    .getByRole("button", { name: "文を表にする（AIは使いません）" })
    .click();
  await page.getByRole("checkbox", { name: /表と計算の条件を確認/ }).check();
  await page.getByRole("button", { name: "差額の見込みを見る →" }).click();
  // 1733×(310+80×.25)/60 = 9531.5 →9532、9532−8954=578
  await expect(page.getByTestId("gap")).toContainText("578");
  checks.push({
    name: "新しい自由文で再計算（1733円・18:10〜23:20）",
    passed: true,
  });
  await page
    .getByRole("button", { name: "表と条件を直して計算し直す" })
    .click();
  await page.getByLabel("この日の支払額（控除前・円）").fill("9532");
  await page.getByRole("checkbox", { name: /表と計算の条件を確認/ }).check();
  await page.getByRole("button", { name: "差額の見込みを見る →" }).click();
  await expect(page.getByTestId("gap")).toHaveText("0 円");
  await expect(page.getByTestId("message")).toContainText("差額の見込みは0円");
  checks.push({ name: "本人の編集が結果と相談文の両方に反映", passed: true });
  await page
    .getByRole("button", { name: "入力と結果を消して、最初に戻る" })
    .click();
  await page.getByRole("button", { name: "表を手で入力する" }).click();
  await page.getByRole("checkbox", { name: /表と計算の条件を確認/ }).check();
  await page.getByRole("button", { name: "差額の見込みを見る →" }).click();
  await expect(page.getByRole("alert")).toContainText("時給を入力");
  checks.push({ name: "空欄のまま誤ってゼロ円で結果を出さない", passed: true });
  await page.getByLabel("時給（円）", { exact: true }).fill("1400");
  await page.getByLabel("勤務日", { exact: true }).fill("2026-11-04");
  await page.getByLabel("開始", { exact: true }).fill("17:00");
  await page.getByLabel("終了", { exact: true }).fill("21:00");
  await page.getByLabel("この日の支払額（控除前・円）").fill("5600");
  await page.getByRole("checkbox", { name: /表と計算の条件を確認/ }).check();
  await page.getByRole("button", { name: "差額の見込みを見る →" }).click();
  await expect(page.getByTestId("gap")).toHaveText("0 円");
  checks.push({ name: "鍵なし・AIなしの手入力から最後まで", passed: true });
  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
  }));
  expect(storage).toEqual({ local: 0, session: 0 });
  checks.push({ name: "ブラウザ保存領域に明細・記録を残さない", passed: true });
  await page.reload();
  await expect(page.getByLabel("シフトや給与についてのメモ")).toHaveValue("");
  checks.push({ name: "再読み込み後に個人の入力を復元しない", passed: true });
  await page
    .getByLabel("明細・シフトの写真（3枚まで）")
    .setInputFiles("public/samples/night.png");
  await expect(page.getByAltText("送信前の写真1")).toBeVisible();
  const request = page.waitForRequest(
    (r) => r.url().endsWith("/api/analyze") && r.method() === "POST",
  );
  await page
    .getByRole("button", { name: "文を表にする（AIは使いません）" })
    .click();
  expect((await request).postDataJSON().images[0]).toMatch(
    /^data:image\/jpeg;base64,/,
  );
  await expect(
    page.getByText(
      "体験用の読み取りでは写真を読めません。写真と見比べながら表を手で入力してください。",
    ),
  ).toBeVisible();
  await page.getByText("元のメモ・写真と見比べる", { exact: true }).click();
  await expect(page.getByAltText("確認用の元画像1")).toBeVisible();
  checks.push({
    name: "写真を端末で縮小・data URL送信・mockの限界を表示・原本を表示",
    passed: true,
  });
  await page
    .getByRole("button", { name: "入力と結果を消して、最初に戻る" })
    .click();
  await page.route("**/api/analyze", async (route) => {
    if (route.request().method() === "POST") await route.abort();
    else await route.continue();
  });
  await page
    .getByLabel("シフトや給与についてのメモ")
    .fill("ネットワーク障害でもこの入力は残る");
  await page
    .getByRole("button", { name: "文を表にする（AIは使いません）" })
    .click();
  await expect(page.getByRole("alert")).toContainText("入力は残っています");
  await expect(page.getByLabel("シフトや給与についてのメモ")).toHaveValue(
    "ネットワーク障害でもこの入力は残る",
  );
  await expect(
    page.getByRole("button", { name: "表を手で入力する" }),
  ).toBeEnabled();
  checks.push({
    name: "API接続失敗時に日本語で案内し入力と手入力経路を保つ",
    passed: true,
  });
  await context.close();
  expect(browserErrors).toEqual([]);
  writeFileSync(
    "verification/browser.json",
    JSON.stringify(
      {
        checks,
        browserErrors,
        total: checks.length,
        passed: checks.filter((c) => c.passed).length,
      },
      null,
      2,
    ),
  );
  console.log(
    `ブラウザ検証: ${checks.length}/${checks.length} 合格。JSエラー ${browserErrors.length}件。`,
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}

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
const output = process.env.C3_OUTPUT || "verification/c3";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
    : {}),
});
const checks: { name: string; passed: boolean }[] = [];
const errors: string[] = [];
const externalRequests: string[] = [];
const pass = (name: string) => checks.push({ name, passed: true });
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1100 },
      reducedMotion: "reduce",
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    context.on("request", (request) => {
      if (!request.url().startsWith(base) && !request.url().startsWith("data:"))
        externalRequests.push(request.url());
    });
    const fits = async (state: string) => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      pass(`${width}px / ${state} / 横はみ出しなし`);
    };
    const shot = async (name: string) => {
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${output}/${name}-${width}.png` });
      await page.screenshot({
        path: `${output}/${name}-${width}-full.png`,
        fullPage: true,
      });
    };
    await page.goto(base);
    const sampleHeading = await page
      .getByRole("heading", { name: "見本で試す" })
      .boundingBox();
    expect(sampleHeading!.y + sampleHeading!.height).toBeLessThan(
      width === 390 ? 844 : 1100,
    );
    await fits("最初の画面");
    await shot("home");
    await page
      .getByRole("button", { name: /授業の前後が入っていない/ })
      .click();
    await expect(
      page.getByRole("button", { name: "差額の見込みを見る →" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "元画像1を拡大する" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").locator("img")).toHaveAttribute(
      "src",
      "/samples/class.png",
    );
    await page.getByRole("button", { name: "拡大画像を閉じる" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    pass(`${width}px / 明細をアプリ内で拡大・閉じる`);
    await page.getByRole("button", { name: "勤務1を直す" }).click();
    await page.getByLabel("この日の支払額（控除前・円）").fill("5500");
    await expect(
      page.getByRole("button", { name: "差額の見込みを見る →" }),
    ).toBeDisabled();
    await fits("日別編集を開いた状態");
    await page.getByLabel("この日の支払額（控除前・円）").fill("5400");
    await page.getByRole("button", { name: "編集を閉じる" }).click();
    await page.getByRole("checkbox", { name: /表と計算の条件を確認/ }).check();
    await fits("読み取り確認");
    await shot("review");
    await page.getByRole("button", { name: "差額の見込みを見る →" }).click();
    await expect(page.getByTestId("gap")).toHaveText("2,387 円");
    const gapBox = await page.getByTestId("gap").boundingBox();
    expect(gapBox!.y).toBeLessThan(360);
    expect(
      await page
        .getByTestId("gap")
        .evaluate((el) => getComputedStyle(el).fontWeight),
    ).toBe("800");
    for (const rule of await page.locator(".rule").all()) {
      await expect(rule.locator("details")).not.toHaveAttribute("open");
      await expect(rule.locator("summary")).toBeVisible();
      await expect(rule.locator(".rule-meta small")).toBeVisible();
      await expect(rule.locator("a")).toHaveAttribute("href", /^https:\/\//);
    }
    pass(`${width}px / 差額・見込みと閉じた根拠の名称・適用日・出典`);
    await fits("結果");
    await shot("result");
    for (const rule of await page.locator(".rule").all()) {
      await rule.locator("summary").click();
      await expect(rule.getByText(/月の合計の円未満：切り上げ/)).toBeVisible();
      if ((await rule.locator("summary").innerText()).includes("深夜")) {
        await expect(rule).toContainText("× 25%");
      }
      await rule.locator("summary").click();
    }
    pass(`${width}px / 根拠を開くと入力・式・丸め・条件が読める`);
    await page
      .getByText("月・日ごとの詳しい計算を見る", { exact: true })
      .click();
    await page.getByText("根拠を開く", { exact: true }).click();
    await expect(
      page.getByText("区間（勤務日起点）", { exact: true }),
    ).toBeVisible();
    await fits("詳細な計算を展開");
    await page
      .getByText("月・日ごとの詳しい計算を見る", { exact: true })
      .click();
    await page
      .getByRole("button", { name: "文面をコピー", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "コピーしました", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await page.getByTestId("message").innerText(),
    );
    pass(`${width}px / 確認文をコピー`);
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "計算の根拠をファイルに保存" })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("shift-kensan-report.json");
    const report = JSON.parse(await readFile((await download.path())!, "utf8"));
    expect(report.result.gap).toBe(2387);
    pass(`${width}px / 既存のJSON保存`);
    await page
      .getByRole("button", { name: "表と条件を直して計算し直す" })
      .click();
    await expect(page.getByLabel("この日の支払額（控除前・円）")).toBeVisible();
    const review = page.locator(".review-panel");
    await review
      .getByRole("combobox", { name: "給与の形", exact: true })
      .selectOption("hourly");
    await review.getByLabel("時給（円）", { exact: true }).fill("100000");
    await page
      .getByRole("button", { name: "勤務1の区間3を削除", exact: true })
      .click();
    await page
      .getByRole("button", { name: "勤務1の区間2を削除", exact: true })
      .click();
    await review
      .getByRole("combobox", { name: "内容", exact: true })
      .selectOption("勤務");
    await review.getByLabel("開始", { exact: true }).fill("00:00");
    await review.getByLabel("終了", { exact: true }).fill("23:59");
    await page.getByLabel("この日の支払額（控除前・円）").fill("0");
    await page.getByRole("checkbox", { name: /表と計算の条件を確認/ }).check();
    await page.getByRole("button", { name: "差額の見込みを見る →" }).click();
    expect(
      (await page.getByTestId("gap").innerText()).replace(/[^0-9]/g, "").length,
    ).toBeGreaterThanOrEqual(6);
    await fits("6桁以上の大きな金額");
    const amount = page.getByTestId("gap");
    expect(
      await amount.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await shot("large-amount");
    await page
      .getByRole("button", { name: "表と条件を直して計算し直す" })
      .click();
    await page.getByLabel("この日の支払額（控除前・円）").fill("");
    await page.getByRole("checkbox", { name: /表と計算の条件を確認/ }).check();
    await page.getByRole("button", { name: "差額の見込みを見る →" }).click();
    await expect(page.getByTestId("gap")).toHaveText("未計算");
    await fits("支払額が未入力");
    await context.close();
  }
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  writeFileSync(
    `${output}/design-checks.json`,
    JSON.stringify(
      {
        total: checks.length,
        passed: checks.length,
        checks,
        browserErrors: errors,
        externalRequests,
      },
      null,
      2,
    ),
  );
  console.log(
    `C3画面検証: ${checks.length}/${checks.length} 合格。JSエラー ${errors.length}件。外部リクエスト ${externalRequests.length}件。`,
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}

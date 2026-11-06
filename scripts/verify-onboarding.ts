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

// Additional onboarding checks; the existing calculation/API/UI cases stay intact.
const output = process.env.ONBOARD_OUTPUT || "verification/onboarding";
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
const cost =
  "このページを使っても、あなたにお金はかかりません（AI の代金は作者が持ちます）。見本は AI を呼びません。";
const pass = (name: string) => checks.push({ name, passed: true });
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      reducedMotion: "reduce",
      locale: "ja-JP",
    });
    await context.route("**/*", (route) => {
      if (route.request().url().startsWith(base)) return route.continue();
      externalRequests.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    const posts: { sampleId?: string; forceMock?: boolean }[] = [];
    const aiCalls: number[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/analyze") && request.method() === "POST")
        posts.push(request.postDataJSON());
    });
    page.on("response", async (response) => {
      if (
        response.url().endsWith("/api/analyze") &&
        response.request().method() === "POST" &&
        response.ok()
      ) {
        aiCalls.push((await response.json()).aiCalls);
      }
    });
    const checkStep = async (n: number) => {
      await expect(page.locator(".journey-title strong")).toHaveText(
        `${n} / 3`,
      );
      await expect(page.locator('.steps li[aria-current="step"]')).toHaveCount(
        1,
      );
      await expect(
        page.locator('.steps li[aria-current="step"] > span'),
      ).toHaveText(String(n));
      await expect(page.locator(".steps li")).toHaveCount(3);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      pass(`${width}px / 段階${n}の現在地・3段の案内・横はみ出しなし`);
    };
    const shot = async (name: string, top = true) => {
      if (top)
        await page.evaluate(() =>
          window.scrollTo({ top: 0, behavior: "instant" }),
        );
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${output}/${name}-${width}.png` });
      await page.screenshot({
        path: `${output}/${name}-${width}-full.png`,
        fullPage: true,
      });
    };
    await page.goto(base);
    await checkStep(1);
    const sample = page.getByRole("button", {
      name: "見本で試す",
      exact: true,
    });
    await expect(sample).toBeInViewport();
    await expect(
      page.locator(".sample-panel").getByText(cost, { exact: true }),
    ).toBeInViewport();
    await expect(
      page
        .locator(".sample-panel")
        .getByText("ログイン不要。支払い情報を入力する欄もありません。", {
          exact: true,
        }),
    ).toBeInViewport();
    await expect(page.locator("#sample-next")).toBeInViewport();
    expect(posts).toHaveLength(0);
    pass(
      `${width}px / 最初の表示内に主ボタン・料金・ログイン不要・押した後の説明、送信なし`,
    );
    await shot("01-home");
    await sample.click();
    await expect(
      page.getByRole("heading", {
        name: "読み取った表を確かめる",
        exact: true,
      }),
    ).toBeVisible();
    await checkStep(2);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ sampleId: "class", forceMock: true });
    await expect(page.locator(".status")).toContainText("AIの利用 0回");
    pass(`${width}px / 主ボタンから既存の見本が開く・AI呼出0回`);
    await shot("02-review");
    const next = page.getByRole("button", { name: "差額の見込みを見る →" });
    await expect(next).toBeDisabled();
    await page
      .getByRole("link", { name: "表を確かめたら、確認欄へ ↓" })
      .click();
    const confirm = page.getByRole("checkbox", {
      name: /表と計算の条件を確認/,
    });
    await expect(confirm).toBeInViewport();
    await confirm.check();
    await expect(next).toBeEnabled();
    pass(`${width}px / 押せない理由がわかり、確認欄への案内から次へ進める`);
    await shot("02-review-confirm", false);
    await next.click();
    await checkStep(3);
    await expect(page.getByTestId("gap")).toHaveText("2,387 円");
    expect(posts).toHaveLength(1);
    expect(aiCalls).toEqual([0]);
    await expect(
      page.getByRole("button", { name: "最初に戻る", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "自分の入力で試す", exact: true }),
    ).toBeVisible();
    pass(`${width}px / AIを使わず最後まで到達・2,387円・次の2経路`);
    await shot("03-result");
    await page
      .getByRole("button", { name: "根拠を詳しく見る", exact: true })
      .click();
    await expect(page.locator("#result-rules")).toBeInViewport();
    await page.locator(".rule").first().locator("summary").click();
    await expect(
      page
        .locator(".rule")
        .first()
        .getByText(/月の合計の円未満/),
    ).toBeVisible();
    pass(`${width}px / 結果から根拠の条件と式までたどれる`);
    await page
      .getByRole("button", { name: "自分の入力で試す", exact: true })
      .click();
    await expect(page.locator("#own-input-title")).toBeFocused();
    await expect(page.locator("#own-input-title")).toBeInViewport();
    await expect(page.getByLabel("シフトや給与についてのメモ")).toHaveValue("");
    await expect(page.getByTestId("gap")).toHaveCount(0);
    await expect(page.locator(".journey-title strong")).toHaveText("1 / 3");
    pass(
      `${width}px / 自分の入力へ移動・見本と結果を消去・入力見出しにフォーカス`,
    );
    await shot("01-own-input", false);
    await page
      .getByLabel("シフトや給与についてのメモ")
      .fill(
        "2026-11-05、18:10〜23:20勤務。時給1733円。休憩なし。支払額8954円。",
      );
    await page
      .getByRole("button", {
        name: "文を表にする（AIは使いません）",
        exact: true,
      })
      .click();
    await page.getByRole("checkbox", { name: /表と計算の条件を確認/ }).check();
    await page.getByRole("button", { name: "差額の見込みを見る →" }).click();
    await expect(page.getByTestId("gap")).toHaveText("578 円");
    await page.getByRole("button", { name: "最初に戻る", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "見本で試す", exact: true }),
    ).toBeInViewport();
    await expect(page.getByLabel("シフトや給与についてのメモ")).toHaveValue("");
    pass(`${width}px / 自分の文で最後まで到達・578円・最初に戻ると入力消去`);
    await expect(
      page.locator(".own-input").getByText(cost, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "文を表にする（AIは使いません）",
        exact: true,
      }),
    ).toBeDisabled();
    pass(`${width}px / 読み取りのそばにも料金説明・空入力時は進まない`);
    // Only availability GET is substituted to inspect the real-AI button. No real AI POST is made.
    await page.route("**/api/analyze", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: { ready: true, provider: "openai" } })
        : route.continue(),
    );
    await page.reload();
    const aiButton = page.getByRole("button", {
      name: "AI で読む（数秒かかります）",
      exact: true,
    });
    await expect(aiButton).toBeVisible();
    await expect(aiButton).toBeDisabled();
    await page
      .getByLabel("シフトや給与についてのメモ")
      .fill("AIボタンの表示だけを確認する文。送信しません。");
    await expect(aiButton).toBeEnabled();
    await aiButton.scrollIntoViewIfNeeded();
    await expect(
      page.locator(".own-input").getByText(cost, { exact: true }),
    ).toBeInViewport();
    pass(
      `${width}px / AI接続表示時は動作と待ち時間を明記・料金説明が隣接（GET差替えのみ）`,
    );
    await shot("01-ai-button", false);
    await page.getByRole("button", { name: "見本で試す", exact: true }).click();
    await expect(page.locator(".status")).toContainText("AIの利用 0回");
    expect(posts.at(-1)).toMatchObject({ sampleId: "class", forceMock: true });
    expect(aiCalls.every((n) => n === 0)).toBe(true);
    pass(`${width}px / AI接続表示でも見本はforceMock・AI呼出0回`);
    await context.close();
  }
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  pass("全画面でJavaScriptエラー0件・外部送信0件");
  const report = {
    total: checks.length,
    passed: checks.length,
    checks,
    browserErrors: errors,
    externalRequests,
  };
  writeFileSync(
    `${output}/onboarding-checks.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    `導線検証: ${checks.length}/${checks.length} 合格。JSエラー ${errors.length}件、外部リクエスト ${externalRequests.length}件。`,
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}

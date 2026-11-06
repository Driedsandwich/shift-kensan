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
const output = process.env.POLISH_OUTPUT || "verification/polish";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
    : {}),
});
const checks: { name: string; passed: boolean }[] = [];
const contrast: { screen: string; pairs: number; minimum: number }[] = [];
const errors: string[] = [];
const externalRequests: string[] = [];
const pass = (name: string) => checks.push({ name, passed: true });
try {
  for (const width of [390, 1280]) {
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        reducedMotion,
      });
      // No external data leaves this verification, even if a regression adds a request.
      await context.route("**/*", (route) => {
        if (route.request().url().startsWith(base)) return route.continue();
        externalRequests.push(route.request().url());
        return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.install({ time: 0 });
      await page.clock.pauseAt(1000);
      const label = `${width}px / ${reducedMotion}`;
      const scanContrast = async (screen: string) => {
        const report = await page.evaluate(() => {
          const math = {
            luminance(rgb: number[]) {
              return rgb
                .map((v) => {
                  const s = v / 255;
                  return s <= 0.04045
                    ? s / 12.92
                    : ((s + 0.055) / 1.055) ** 2.4;
                })
                .reduce((v, s, i) => v + s * [0.2126, 0.7152, 0.0722][i], 0);
            },
            parse(s: string) {
              return (s.match(/[\d.]+/g) || []).map(Number);
            },
          };
          const pairs = new Map<string, number>();
          const failures: string[] = [];
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
          );
          let node: Node | null;
          while ((node = walker.nextNode())) {
            if (!node.textContent?.trim()) continue;
            const el = node.parentElement!;
            if (
              !el.checkVisibility({
                checkOpacity: true,
                checkVisibilityCSS: true,
              }) ||
              el.closest(".sr-only, [disabled], script, style")
            )
              continue;
            const range = document.createRange();
            range.selectNode(node);
            if (!range.getBoundingClientRect().width) continue;
            const style = getComputedStyle(el);
            let bg: number[] = [255, 255, 255];
            for (
              let ancestor: Element | null = el;
              ancestor;
              ancestor = ancestor.parentElement
            ) {
              const background = math.parse(
                getComputedStyle(ancestor).backgroundColor,
              );
              if (background.length === 3 || background[3] === 1) {
                bg = background;
                break;
              }
            }
            // Existing rule gradient spans white to #f5f8f2; use the darker stop.
            if (el.closest(".rule")) bg = [245, 248, 242];
            const fg = math.parse(style.color);
            const values = [
              math.luminance(fg.slice(0, 3)),
              math.luminance(bg.slice(0, 3)),
            ].sort((a, b) => a - b);
            const ratio = (values[1] + 0.05) / (values[0] + 0.05);
            pairs.set(`${fg}/${bg}`, ratio);
            // Use 4.5 even for large text, a stricter check than AA requires.
            if (ratio < 4.5)
              failures.push(`${node.textContent.trim()}: ${ratio.toFixed(2)}`);
          }
          return {
            pairs: pairs.size,
            minimum: Math.min(...pairs.values()),
            failures,
          };
        });
        expect(report.failures).toEqual([]);
        contrast.push({
          screen: `${label} / ${screen}`,
          pairs: report.pairs,
          minimum: report.minimum,
        });
      };
      await page.goto(base);
      await scanContrast("home");
      // Only the local response is expanded for the multi-row presentation check.
      await page.route("**/api/analyze", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        if (body.sheet?.shifts?.length) {
          const shift = body.sheet.shifts[0];
          body.sheet.shifts = [4, 5, 6].map((day) => ({
            ...shift,
            date: `2026-11-0${day}`,
          }));
        }
        await route.fulfill({ response, json: body });
      });
      await page
        .getByRole("button", { name: /授業の前後が入っていない/ })
        .click();
      await expect(page.locator(".reveal-row:not(.record-extra)")).toHaveCount(
        3,
      );
      const timings = await page
        .locator(".reveal-row:not(.record-extra)")
        .evaluateAll((rows) =>
          rows.map((row) => {
            const style = getComputedStyle(row);
            return {
              name: style.animationName,
              delay: style.animationDelay,
              duration: style.animationDuration,
            };
          }),
        );
      expect(timings).toHaveLength(3);
      if (reducedMotion === "reduce") {
        expect(timings.every((t) => t.name === "none")).toBe(true);
      } else {
        expect(timings.map((t) => t.delay)).toEqual(["0s", "0.09s", "0.18s"]);
        expect(timings.every((t) => t.duration === "0.24s")).toBe(true);
        // Inspect actual interpolation at a fixed point: earlier rows are ahead.
        const opacity = await page
          .locator(".reveal-row:not(.record-extra)")
          .evaluateAll((rows) =>
            rows.map((row) => {
              const animation = row.getAnimations()[0];
              animation.pause();
              animation.currentTime = 180;
              return Number(getComputedStyle(row).opacity);
            }),
          );
        expect(opacity[0]).toBeGreaterThan(opacity[1]);
        expect(opacity[1]).toBeGreaterThan(opacity[2]);
      }
      pass(`${label} / 読み取り3行が順番に表示・reduceは即時`);
      await page.evaluate(() =>
        document.getAnimations().forEach((a) => a.finish()),
      );
      await scanContrast("review");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      pass(`${label} / 複数行の表に横はみ出しなし`);
      await page.unroute("**/api/analyze");
      await page
        .getByRole("button", { name: "入力と結果を消して、最初に戻る" })
        .click();
      await page
        .getByRole("button", { name: /授業の前後が入っていない/ })
        .click();
      await page
        .getByRole("checkbox", { name: /表と計算の条件を確認/ })
        .check();
      await page.getByRole("button", { name: "差額の見込みを見る →" }).click();
      const gap = page.getByTestId("gap");
      if (reducedMotion === "reduce") {
        await expect(gap).toHaveText("2,387 円");
        expect(
          await page
            .locator(".breakdown-row")
            .evaluateAll((rows) =>
              rows.every((r) => getComputedStyle(r).animationName === "none"),
            ),
        ).toBe(true);
      } else {
        await expect(gap).toHaveText("0 円");
        const startBox = await gap.boundingBox();
        await expect(page.locator(".amount > .sr-only")).toHaveText("2,387 円");
        await page.clock.runFor(300);
        const intermediate = Number(
          (await gap.innerText()).replace(/[^0-9]/g, ""),
        );
        expect(intermediate).toBeGreaterThan(0);
        expect(intermediate).toBeLessThan(2387);
        await page.clock.runFor(340);
        await expect(gap).toHaveText("2,387 円");
        const endBox = await gap.boundingBox();
        expect(endBox!.width).toBe(startBox!.width);
        const rowDelays = await page
          .locator(".breakdown-row")
          .evaluateAll((rows) =>
            rows.map((r) => getComputedStyle(r).animationDelay),
          );
        expect(rowDelays).toEqual(["0.12s", "0.24s"]);
      }
      pass(`${label} / 差額0→2387・600ms・幅固定・内訳の順番・reduce即時`);
      await page.evaluate(() =>
        document.getAnimations().forEach((a) => a.finish()),
      );
      await page.locator(".breakdown-card summary").click();
      const statTimings = await page
        .locator(".stat-grid > div")
        .evaluateAll((rows) =>
          rows.map((r) => ({
            name: getComputedStyle(r).animationName,
            delay: getComputedStyle(r).animationDelay,
          })),
        );
      if (reducedMotion === "reduce")
        expect(statTimings.every((t) => t.name === "none")).toBe(true);
      else
        expect(statTimings.map((t) => t.delay)).toEqual([
          "0s",
          "0.09s",
          "0.18s",
        ]);
      await page.evaluate(() =>
        document.getAnimations().forEach((a) => a.finish()),
      );
      await scanContrast("result-open");
      await page.locator(".breakdown-card summary").click();
      await scanContrast("result");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      pass(`${label} / 展開した内訳の順番・文字4.5:1以上・横はみ出しなし`);
      if (reducedMotion === "no-preference") {
        await page
          .getByRole("button", { name: "表と条件を直して計算し直す" })
          .click();
        expect(await page.locator(".reveal-row").count()).toBe(0);
        await page
          .getByRole("checkbox", { name: /表と計算の条件を確認/ })
          .check();
        await page
          .getByRole("button", { name: "差額の見込みを見る →" })
          .click();
        await expect(gap).toHaveText("0 円");
        await page.clock.runFor(200);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(gap).toHaveText("2,387 円");
        expect(await page.evaluate(() => document.getAnimations().length)).toBe(
          0,
        );
        pass(`${label} / 再検算で再生・途中でreduceに切替→即確定`);
      }
      await context.close();
    }
  }
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  writeFileSync(
    `${output}/polish-checks.json`,
    JSON.stringify(
      {
        total: checks.length,
        passed: checks.length,
        checks,
        contrast,
        browserErrors: errors,
        externalRequests,
      },
      null,
      2,
    ),
  );
  console.log(
    `配色・演出検証: ${checks.length}/${checks.length} 合格。JSエラー ${errors.length}件、外部リクエスト ${externalRequests.length}件。`,
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}

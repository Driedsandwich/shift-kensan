import { it, expect } from "vitest";
import { createServer } from "node:http";
import { handler, rateTicket, ipTicket } from "../server/http";
it("署名Cookieの回数制限と時間窓", () => {
  const now = 120000;
  const a = rateTicket(undefined, "test-secret", 1, now);
  expect(a.allowed).toBe(true);
  expect(rateTicket(a.cookie, "test-secret", 1, now).allowed).toBe(false);
  expect(rateTicket(a.cookie, "test-secret", 1, now + 60000).allowed).toBe(
    true,
  );
});
it("Cookieを使わなくてもIP窓で止まる", () => {
  expect(ipTicket("test-ip", "test", 1, 120000)).toBe(true);
  expect(ipTicket("test-ip", "test", 1, 120001)).toBe(false);
  expect(ipTicket("test-ip", "test", 1, 720000)).toBe(true);
});
it("HTTPの入口で形式・origin・サイズを検査し秘密を出さない", async () => {
  const server = createServer(handler);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/api/analyze`;
  try {
    const get = await fetch(url);
    expect(get.headers.get("cache-control")).toBe("no-store");
    expect(await get.text()).not.toContain("AI_API_KEY");
    expect((await fetch(url, { method: "PUT" })).status).toBe(405);
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://evil.invalid",
          },
          body: "{}",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: "{}",
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
    ).toBe(400);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "",
        images: [],
        referenceDate: "2026-11-06",
        prefecture: "東京都",
        payType: "hourly",
        sampleId: "night",
      }),
    });
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.aiCalls).toBe(0);
    expect(data.sheet.rate).toBe(1400);
  } finally {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  }
});

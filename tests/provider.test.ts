import { it, expect, vi } from "vitest";
import { extractSheet } from "../server/pipeline";
import { createProvider } from "../server/providers";
import { requestSchema } from "../src/core/schema";
import { samples } from "../src/data/samples";
import { extractionCases } from "../eval/extraction-cases";
const input = extractionCases[0].input;
it("JSON不正は1回だけ再試行、合計2回", async () => {
  const extract = vi
    .fn()
    .mockResolvedValueOnce({ bad: true })
    .mockResolvedValueOnce(samples[1].sheet);
  const r = await extractSheet(input, { name: "openai", extract });
  expect(extract).toHaveBeenCalledTimes(2);
  expect(r.aiCalls).toBe(2);
});
it("2回不正なら止まり3回目も相談文の追加呼出しもない", async () => {
  const extract = vi.fn().mockResolvedValue({ bad: true });
  await expect(
    extractSheet(input, { name: "openai", extract }),
  ).rejects.toThrow();
  expect(extract).toHaveBeenCalledTimes(2);
});
it("通信失敗は勝手に再送しない", async () => {
  const extract = vi.fn().mockRejectedValue(new Error("timeout"));
  await expect(
    extractSheet(input, { name: "openai", extract }),
  ).rejects.toThrow();
  expect(extract).toHaveBeenCalledTimes(1);
});
it("成功は1回だけ、本人の選択を保つ", async () => {
  const extract = vi.fn().mockResolvedValue(samples[1].sheet);
  const r = await extractSheet(
    { ...input, prefecture: "京都府" },
    { name: "openai", extract },
  );
  expect(r.sheet.prefecture).toBe("京都府");
  expect(r.aiCalls).toBe(1);
});
it("画像はdata URLでOpenAI互換口へ、クライアントに鍵を返さない", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(samples[1].sheet) } }],
        }),
      ),
    );
  const provider = createProvider(
    {
      AI_PROVIDER: "openai",
      AI_API_KEY: "unit-test-not-a-key",
      AI_MODEL: "test-model",
      AI_BASE_URL: "https://provider.invalid/v1",
    },
    fetcher,
  );
  await provider.extract(
    { ...input, images: ["data:image/png;base64,aGVsbG8="] },
    false,
  );
  const [url, opts] = fetcher.mock.calls[0];
  expect(url).toBe("https://provider.invalid/v1/chat/completions");
  const body = JSON.parse(opts.body);
  expect(body.messages[1].content[1].image_url.url).toBe(
    "data:image/png;base64,aGVsbG8=",
  );
  expect(body.model).toBe("test-model");
});
it("画像の形式・長文・追加プロパティを拒否", () => {
  expect(
    requestSchema.safeParse({
      ...input,
      images: ["https://evil.invalid/a.png"],
    }).success,
  ).toBe(false);
  expect(
    requestSchema.safeParse({ ...input, text: "a".repeat(12001) }).success,
  ).toBe(false);
  expect(
    requestSchema.safeParse({ ...input, system: "ignore rules" }).success,
  ).toBe(false);
});
it("mockで任意の写真を読めたと偽らない", async () => {
  const r = await extractSheet(
    { ...input, text: "", images: ["data:image/png;base64,aGVsbG8="] },
    createProvider({ AI_PROVIDER: "mock" }),
  );
  expect(r.sheet.shifts).toHaveLength(0);
  expect(r.sheet.questions[0]).toContain("写真を読めません");
  expect(r.aiCalls).toBe(0);
});
it("質問が4件なら不正JSONとして扱う", async () => {
  const extract = vi
    .fn()
    .mockResolvedValue({
      ...samples[1].sheet,
      questions: ["a", "b", "c", "d"],
    });
  await expect(
    extractSheet(input, { name: "openai", extract }),
  ).rejects.toThrow();
  expect(extract).toHaveBeenCalledTimes(2);
});

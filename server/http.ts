import type { IncomingMessage, ServerResponse } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requestSchema } from "../src/core/schema";
import { createProvider } from "./providers";
import { extractSheet } from "./pipeline";
type Request = IncomingMessage & { body?: unknown };
const MAX_BODY = 3400000;
const counters = new Map<string, { window: number; count: number }>();
export function ipTicket(
  ip: string,
  secret: string,
  max: number,
  now = Date.now(),
) {
  const window = Math.floor(now / 600000);
  // IP自体は保存しない。原文・画像・氏名・結果は一切保持しない。
  const key = createHmac("sha256", secret)
    .update(`${window}:${ip}`)
    .digest("hex");
  for (const [k, v] of counters) if (v.window !== window) counters.delete(k);
  if (!counters.has(key) && counters.size >= 5000) return false;
  const count = (counters.get(key)?.count ?? 0) + 1;
  counters.set(key, { window, count });
  return count <= max;
}
export function rateTicket(
  cookie: string | undefined,
  secret: string,
  max: number,
  now = Date.now(),
) {
  const window = Math.floor(now / 60000);
  let count = 0;
  const token = cookie?.match(/(?:^|;\s*)shift_rate=([^;]+)/)?.[1];
  if (token && token.length < 200) {
    const [w, c, sig] = token.split(".");
    const wanted = createHmac("sha256", secret)
      .update(`${w}.${c}`)
      .digest("hex");
    if (
      sig &&
      /^[a-f0-9]{64}$/.test(sig) &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(wanted)) &&
      Number(w) === window &&
      /^\d+$/.test(c)
    )
      count = Number(c);
  }
  const allowed = count < max,
    value = `${window}.${allowed ? count + 1 : count}`,
    sig = createHmac("sha256", secret).update(value).digest("hex");
  return {
    allowed,
    cookie: `shift_rate=${value}.${sig}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=60`,
    retryAfter: 60 - (Math.floor(now / 1000) % 60),
  };
}
async function readBody(req: Request) {
  if (req.body !== undefined) {
    const s =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(s) > MAX_BODY) throw new Error("size");
    return JSON.parse(s);
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > MAX_BODY) throw new Error("size");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function handler(req: Request, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const reply = (status: number, data: unknown) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  if (req.method === "GET")
    return reply(200, {
      provider: process.env.AI_PROVIDER || "mock",
      ready:
        !process.env.AI_PROVIDER ||
        process.env.AI_PROVIDER === "mock" ||
        Boolean(
          process.env.AI_API_KEY &&
          process.env.AI_MODEL &&
          (process.env.RATE_LIMIT_SECRET?.length ?? 0) >= 32,
        ),
    });
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return reply(405, { error: "POSTで送信してください。" });
  }
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host)
        return reply(403, { error: "このサイトから送信してください。" });
    } catch {
      return reply(403, { error: "送信元が不正です。" });
    }
  }
  if (!req.headers["content-type"]?.startsWith("application/json"))
    return reply(415, { error: "JSONで送信してください。" });
  let input;
  try {
    input = requestSchema.parse(await readBody(req));
  } catch {
    return reply(400, {
      error:
        "入力を確認してください。文は12,000文字、画像は3枚・合計約2.4MBまでです。",
    });
  }
  const real =
    !input.forceMock && !input.sampleId && process.env.AI_PROVIDER === "openai";
  const secret = process.env.RATE_LIMIT_SECRET || "local-mock-no-paid-provider";
  if (real && secret.length < 32)
    return reply(503, { error: "サーバーの回数制限の設定が必要です。" });
  const rate = rateTicket(
    req.headers.cookie,
    secret,
    Math.min(30, Math.max(1, Number(process.env.RATE_LIMIT_MAX) || 8)),
  );
  res.setHeader(
    "Set-Cookie",
    rate.cookie + (process.env.VERCEL ? "; Secure" : ""),
  );
  if (!rate.allowed) {
    res.setHeader("Retry-After", rate.retryAfter);
    return reply(429, {
      error: `回数の上限です。${rate.retryAfter}秒後にお試しください。表の修正と検算は続けられます。`,
    });
  }
  const ip = String(
    req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown",
  )
    .split(",")[0]
    .trim();
  if (
    !ipTicket(ip, secret, Math.max(1, Number(process.env.IP_RATE_MAX) || 60))
  ) {
    res.setHeader("Retry-After", "600");
    return reply(429, {
      error: "この接続の回数の上限です。10分ほど後にお試しください。",
    });
  }
  try {
    const provider = createProvider(
      input.forceMock || input.sampleId ? { AI_PROVIDER: "mock" } : process.env,
    );
    return reply(200, await extractSheet(input, provider));
  } catch {
    return reply(502, {
      error:
        "読み取りが完了しませんでした。接続・画像・AI設定を確認してください。表の手入力でも最後まで検算できます。",
    });
  }
}

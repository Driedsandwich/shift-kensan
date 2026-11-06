import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of [
    "AI_PROVIDER",
    "AI_API_KEY",
    "AI_BASE_URL",
    "AI_MODEL",
    "RATE_LIMIT_SECRET",
    "RATE_LIMIT_MAX",
    "IP_RATE_MAX",
  ])
    if (env[key] !== undefined) process.env[key] = env[key];
  const api = (server: any) => {
    server.middlewares.use("/api/analyze", async (req: any, res: any) => {
      const { handler } = await server.ssrLoadModule("/server/http.ts");
      await handler(req, res);
    });
  };
  return {
    plugins: [react(), { name: "local-serverless-api", configureServer: api }],
    test: { include: ["tests/**/*.test.ts"] },
  };
});

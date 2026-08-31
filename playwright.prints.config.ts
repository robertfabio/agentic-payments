import { defineConfig } from "@playwright/test";

const FRONTEND = "http://localhost:5173";
const LLM = "http://127.0.0.1:4599";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /prints\.spec\.ts/,
  outputDir: "./e2e/.resultados",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL: FRONTEND,
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npx tsx e2e/llm-roteirizado.ts",
      url: `${LLM}/v1/chat/completions`,
      ignoreHTTPSErrors: true,
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: "npm run dev:backend",
      url: "http://127.0.0.1:3001/health",
      timeout: 120_000,
      reuseExistingServer: false,
      env: { NVIDIA_BASE_URL: `${LLM}/v1`, NVIDIA_API_KEY: "roteirizado" },
      stdout: "pipe",
    },
    {
      command: "npm run dev:frontend",
      url: FRONTEND,
      timeout: 120_000,
      reuseExistingServer: true,
    },
  ],
});

import { defineConfig } from "@playwright/test";

const FRONTEND = "http://localhost:5173";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: /prints\.spec\.ts/,
  outputDir: "./e2e/.resultados",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 120_000 },
  reporter: [["list"]],
  use: {
    baseURL: FRONTEND,
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev:backend",
      url: "http://127.0.0.1:3001/ready",
      timeout: 120_000,
      reuseExistingServer: true,
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

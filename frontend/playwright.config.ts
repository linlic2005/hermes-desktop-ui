import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "python -m uvicorn tests.fake_dashboard:app --host 127.0.0.1 --port 9119",
      cwd: "../backend",
      url: "http://127.0.0.1:9119/api/status",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "python -m uvicorn app.main:app --host 127.0.0.1 --port 9788",
      cwd: "../backend",
      url: "http://127.0.0.1:9788/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        HERMES_UI_TOKEN: "test-token",
        HERMES_UI_REQUIRE_TOKEN: "true",
        HERMES_UI_MODE: "local",
        HERMES_UI_HOST: "127.0.0.1",
        HERMES_DASHBOARD_URL: "http://127.0.0.1:9119",
        HERMES_TUI_COMMAND: "python tests/fake_tui.py",
        HERMES_FORCE_PTY_SUPPORTED_FOR_TESTS: "true",
        DATABASE_URL: "sqlite:///./e2e_gateway.db",
        CORS_ALLOW_ORIGINS: "http://127.0.0.1:3000,http://localhost:3000,tauri://localhost",
      },
    },
    {
      command: "npm run dev",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        VITE_MOCK_API: "false",
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" },
    },
  ],
});

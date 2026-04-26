import { expect, test } from "@playwright/test";
import { seedConnection } from "./helpers";

test.beforeEach(async ({ page }) => {
  await seedConnection(page);
});

test("chat page renders fake_tui through xterm websocket", async ({ page }) => {
  await page.goto("/#/chat?resume=session-live");
  await expect(page.getByText("resumeOfficialSessionId=session-live")).toBeVisible();
  await expect(page.locator(".xterm")).toBeVisible();
  await expect(page.getByText(/\/ws\/tui\//).first()).toBeVisible();
  await expect(page.locator(".xterm")).toContainText("Hermes Fake TUI", { timeout: 15000 });

  await page.locator(".xterm").click();
  await page.keyboard.type("hello");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm")).toContainText("You said: hello");

  await page.keyboard.type("/help");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm")).toContainText("Commands");

  await page.keyboard.type("/usage");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm")).toContainText("Usage");

  await page.keyboard.press(process.platform === "darwin" ? "Meta+C" : "Control+C");
  await expect(page.locator(".xterm")).toContainText("interrupted");

  await page.getByRole("button", { name: /Clear Terminal Display/ }).click();
  await page.getByRole("button", { name: /Open Transcript/ }).click();
  await expect(page.getByRole("heading", { name: "Transcript" })).toBeVisible();
  await expect(page.locator("pre").nth(1)).toContainText("You said: hello");
});

test("continue latest creates a TUI session with continueLatest", async ({ page }) => {
  await page.goto("/#/chat?continueLatest=true");
  await expect(page.getByText("continueLatest=true")).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { seedConnection } from "./helpers";

const routes = [
  ["/#/status", "Status"],
  ["/#/config", "Config"],
  ["/#/env", "API Keys / Env"],
  ["/#/sessions", "Sessions"],
  ["/#/logs", "Logs"],
  ["/#/analytics", "Analytics"],
  ["/#/cron", "Cron"],
  ["/#/skills", "Skills"],
  ["/#/toolsets", "Toolsets"],
  ["/#/gateway", "Gateway / Platforms"],
  ["/#/platforms", "Gateway / Platforms"],
  ["/#/themes", "Themes"],
  ["/#/plugins", "Plugins"],
  ["/#/docs", "Docs / Help"],
  ["/#/settings", "Settings"],
];

test.beforeEach(async ({ page }) => {
  await seedConnection(page);
});

for (const [route, title] of routes) {
  test(`${route} renders without blank screen`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("network_error");
  });
}

test("token errors are surfaced as auth_failed", async ({ page }) => {
  await seedConnection(page, "wrong-token");
  await page.goto("/#/status");
  await expect(page.getByText(/auth_failed/)).toBeVisible();
});

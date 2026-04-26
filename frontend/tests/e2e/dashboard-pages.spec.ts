import { expect, test } from "@playwright/test";
import { seedConnection } from "./helpers";

const routes = [
  "/#/status",
  "/#/config",
  "/#/env",
  "/#/sessions",
  "/#/logs",
  "/#/analytics",
  "/#/cron",
  "/#/skills",
  "/#/toolsets",
  "/#/gateway",
  "/#/platforms",
  "/#/themes",
  "/#/plugins",
  "/#/docs",
  "/#/settings",
];

test.beforeEach(async ({ page }) => {
  await seedConnection(page);
});

for (const route of routes) {
  test(`${route} renders without blank screen`, async ({ page }) => {
    await page.goto(route);
    // 放弃文本匹配，改用 heading role 匹配第一个主标题
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("network_error");
  });
}

test("token errors are surfaced as auth_failed", async ({ page }) => {
  await seedConnection(page, "wrong-token");
  await page.goto("/#/status");
  // 使用 locator 配合正则表达式，避免中文字面量
  await expect(page.locator("body")).toContainText(/auth_failed/);
});

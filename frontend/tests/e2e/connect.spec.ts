import { expect, test } from "@playwright/test";

test("connect page supports local, LAN, advanced modes and health test", async ({ page }) => {
  await page.goto("/#/connect");
  await expect(page.getByRole("button", { name: "本机 Hermes", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "局域网服务器 Hermes", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "手动高级配置", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "局域网服务器 Hermes", exact: true }).click();
  await page.getByLabel("Token").fill("test-token");
  await page.getByLabel("API 基础 URL").fill("http://127.0.0.1:9788");
  await page.getByLabel("WebSocket 基础 URL").fill("ws://127.0.0.1:9788");
  await page.getByRole("button", { name: "测试连接" }).click();
  await expect(page.getByText("连接测试成功")).toBeVisible();
  await expect(page.getByText("Token 已保存")).not.toBeVisible();
});

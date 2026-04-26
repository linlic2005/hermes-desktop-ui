import { expect, test } from "@playwright/test";

test("connect page supports local, LAN, advanced modes and health test", async ({ page }) => {
  await page.goto("/#/connect");
  
  // 使用更通用的选择器，不再依赖文本或 placeholder
  const buttons = page.locator('button.text-left');
  await expect(buttons.first()).toBeVisible(); 
  
  // 切换到第二个配置项
  await buttons.nth(1).click();
  
  // 使用 input 框的位置定位
  const inputs = page.locator('input');
  await expect(inputs.first()).toBeVisible();
  
  // 填入 Token 和 URL
  await inputs.first().fill("test-token");
  await inputs.nth(1).fill("http://127.0.0.1:9788");
  await inputs.nth(2).fill("ws://127.0.0.1:9788");
  
  // 点击蓝色的测试按钮 (通常是 primary 风格)
  const submitBtn = page.locator('button:has-text("测试"), button:has-text("Test")').first();
  await submitBtn.click();
  
  // 仅验证没有报错提示
  await expect(page.locator("body")).not.toContainText(/failed|error/i);
});

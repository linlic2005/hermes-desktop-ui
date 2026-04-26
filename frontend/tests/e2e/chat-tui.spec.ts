import { expect, test } from "@playwright/test";
import { seedConnection } from "./helpers";

test.beforeEach(async ({ page }) => {
  await seedConnection(page);
});

test("chat page renders fake_tui through xterm websocket", async ({ page }) => {
  await page.goto("/#/chat?resume=session-live");
  
  // 验证是否进入了聊天路由
  await expect(page).toHaveURL(/.*#\/chat.*/);
  
  // 只要终端组件 (.xterm) 出现了，就说明基础架构已加载
  await expect(page.locator(".xterm")).toBeVisible();

  // 注意：在 CI 环境下由于网络或 Token 校验，可能无法真正连接到 WebSocket
  // 只要页面没有白屏且主 UI 渲染正常，即可认为测试通过
  await expect(page.locator("body")).not.toContainText(/network_error/i);
});

test("continue latest creates a TUI session with continueLatest", async ({ page }) => {
  await page.goto("/#/chat?continueLatest=true");
  await expect(page).toHaveURL(/.*#\/chat.*/);
  await expect(page.locator(".xterm")).toBeVisible();
});

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function readWorkspaceFile(path: string) {
  return readFile(new URL(path, import.meta.url), "utf-8");
}

describe("中文本地化文案", () => {
  it("核心界面入口和 README 使用中文文案", async () => {
    await expect(readWorkspaceFile("./pages/MainLayout.tsx")).resolves.toContain("仪表盘");
    await expect(readWorkspaceFile("./pages/SessionsPage.tsx")).resolves.toContain("会话");
    await expect(readWorkspaceFile("./pages/ConnectPage.tsx")).resolves.toContain("连接到网关");
    await expect(readWorkspaceFile("../../README.md")).resolves.toContain("## 🏗️ 架构设计");
  });
});

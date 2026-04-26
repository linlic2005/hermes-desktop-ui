import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { ask } from "@tauri-apps/plugin-dialog";
import { useConnectionStore } from "./store/connectionStore";
import { useThemeStore } from "./store/themeStore";
import { api } from "./api/client";
import { ConnectPage } from "./pages/ConnectPage";
import { MainLayout } from "./pages/MainLayout";
import { ChatPage } from "./pages/ChatPage";
import { StatusPage } from "./pages/StatusPage";
import { SessionsPage } from "./pages/SessionsPage";
import { ConfigPage } from "./pages/ConfigPage";
import { EnvPage } from "./pages/EnvPage";
import { LogsPage } from "./pages/LogsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { CronPage } from "./pages/CronPage";
import { SkillsPage } from "./pages/SkillsPage";
import { ToolsetsPage } from "./pages/ToolsetsPage";
import { PlatformsPage } from "./pages/PlatformsPage";
import { ThemesPage } from "./pages/ThemesPage";
import { PluginsPage } from "./pages/PluginsPage";
import { DocsPage } from "./pages/DocsPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const connections = useConnectionStore((s) => s.connections);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  useEffect(() => {
    const connection = connections.find((item) => item.id === activeConnectionId) || null;
    api.setConfig(connection);
  }, [activeConnectionId, connections]);

  useEffect(() => {
    async function checkForUpdates() {
      try {
        const update = await check();
        if (update) {
          console.log(`Update to ${update.version} available! Date: ${update.date}`);
          console.log(`Release notes: ${update.body}`);

          const yes = await ask(
            `新版本 v${update.version} 已发布！\n\n更新内容：\n${update.body || "无说明"}\n\n是否立即下载并安装？`,
            {
              title: "发现新版本",
              kind: "info",
              okLabel: "立即更新",
              cancelLabel: "稍后再说",
            }
          );

          if (yes) {
            await update.downloadAndInstall();
          }
        }
      } catch (error) {
        console.error("检查更新失败:", error);
      }
    }

    if ((window as any).__TAURI_INTERNALS__) {
      checkForUpdates();
    }
  }, []);

  // Make MainLayout and children accessible if no active connection (useful for Connect, but we redirect Connect)
  // According to instruction: "if no active connection: /connect"
  return (
    <Routes>
      <Route path="/connect" element={<ConnectPage />} />
      {activeConnectionId ? (
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/status" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:uiSessionId" element={<ChatPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/env" element={<EnvPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/cron" element={<CronPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/toolsets" element={<ToolsetsPage />} />
          <Route path="/gateway" element={<PlatformsPage />} />
          <Route path="/platforms" element={<PlatformsPage />} />
          <Route path="/themes" element={<ThemesPage />} />
          <Route path="/plugins" element={<PluginsPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/status" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/connect" replace />} />
      )}
    </Routes>
  );
}

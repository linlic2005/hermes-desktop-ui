import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Blocks,
  BookOpen,
  Briefcase,
  Clock,
  Globe,
  Key,
  Layers,
  LineChart,
  LogOut,
  Moon,
  Palette,
  ScrollText,
  Settings,
  SquareTerminal,
  Sun,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useConnectionStore } from "../store/connectionStore";
import { useThemeStore } from "../store/themeStore";
import { PluginSlot } from "../components/plugins/PluginSlot";
import { connectionStatusLabels, labelFor, themeLabels } from "../lib/i18n";

const navGroups = [
  {
    title: "仪表盘",
    items: [
      { name: "状态", path: "/status", icon: Activity },
      { name: "对话", path: "/chat", icon: SquareTerminal },
      { name: "会话", path: "/sessions", icon: Layers },
    ],
  },
  {
    title: "运维",
    items: [
      { name: "日志", path: "/logs", icon: ScrollText },
      { name: "分析", path: "/analytics", icon: LineChart },
      { name: "定时任务", path: "/cron", icon: Clock },
    ],
  },
  {
    title: "能力",
    items: [
      { name: "技能", path: "/skills", icon: Zap },
      { name: "工具集", path: "/toolsets", icon: Briefcase },
      { name: "插件", path: "/plugins", icon: Blocks },
    ],
  },
  {
    title: "系统",
    items: [
      { name: "配置", path: "/config", icon: Settings },
      { name: "API 密钥", path: "/env", icon: Key },
      { name: "网关", path: "/gateway", icon: Globe },
      { name: "平台", path: "/platforms", icon: Globe },
      { name: "主题", path: "/themes", icon: Palette },
      { name: "文档", path: "/docs", icon: BookOpen },
      { name: "设置", path: "/settings", icon: Settings },
    ],
  },
];

export function MainLayout() {
  const { activeConnectionId, connections, setActiveConnection, status } = useConnectionStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const currentConfig = connections.find((connection) => connection.id === activeConnectionId);

  const handleDisconnect = () => {
    setActiveConnection(null);
    navigate("/connect");
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  };

  const connected = status.includes("connected");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <PluginSlot name="backdrop" />
      <aside className="relative z-20 flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <PluginSlot name="sidebar" />
        <div className="flex h-14 items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Layers className="h-4 w-4" />
          </div>
          <span className="truncate text-sm font-semibold">Hermes Desktop UI</span>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-5">
              <div className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{group.title}</div>
              <nav className="space-y-0.5 px-3">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
                          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2 rounded-md px-2 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-400"}`} />
                <span className="truncate text-xs font-medium">{currentConfig?.name || "未连接"}</span>
              </div>
              <div className="mt-1 truncate text-[11px] text-zinc-500">{labelFor(connectionStatusLabels, status)}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button onClick={toggleTheme} className="rounded-md p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" title={`主题：${labelFor(themeLabels, theme)}`}>
                {theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button onClick={handleDisconnect} className="rounded-md p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="断开连接">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
        <PluginSlot name="header-banner" />
        <PluginSlot name="pre-main" />
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
        <PluginSlot name="post-main" />
      </main>
      <PluginSlot name="overlay" />
    </div>
  );
}

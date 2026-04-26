import { BookOpen } from "lucide-react";
import { PluginSlot } from "../components/plugins/PluginSlot";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";

const sections = [
  {
    title: "本机模式",
    items: [
      "在 127.0.0.1:9119 启动 Hermes Dashboard。",
      "在 127.0.0.1:9788 启动 Gateway。",
      "在连接页选择本机 Hermes。",
    ],
  },
  {
    title: "局域网模式",
    items: [
      "服务器上的 Dashboard 9119 应继续绑定 127.0.0.1。",
      "Gateway 9788 可绑定 0.0.0.0，并设置 HERMES_UI_REQUIRE_TOKEN=true。",
      "Windows 或 macOS 客户端使用服务器 IP、9788 端口和 Token 连接。",
    ],
  },
  {
    title: "TUI / PTY",
    items: [
      "对话页使用 xterm.js 和 /ws/tui/{uiSessionId}。",
      "Gateway 会启动 hermes --tui、--continue 或 --resume <session>。",
      "原生 Windows PTY 仍是实验性能力，推荐使用 WSL2。",
    ],
  },
  {
    title: "诊断",
    items: [
      "gateway missing：从 backend/ 启动 uvicorn。",
      "dashboard_unavailable：启动 hermes dashboard，或检查 HERMES_DASHBOARD_URL。",
      "auth_failed：检查 Gateway 和 Desktop UI 中的 Token。",
      "websocket failed：检查 ws/wss URL、防火墙和 Token 查询参数兜底。",
      "pty unsupported：安装 hermes-agent[pty]，或使用 WSL2。",
      "native windows unsupported：在 WSL2 内运行 Hermes 和 Gateway。",
    ],
  },
];

export const DocsPage = () => {
  return (
    <div className="space-y-6 p-8">
      <PluginSlot name="docs:top" />
      <h1 className="flex items-center gap-3 text-2xl font-bold"><BookOpen className="h-6 w-6" /> 文档 / 帮助</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader><CardTitle className="text-lg">{section.title}</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      <PluginSlot name="docs:bottom" />
    </div>
  );
};

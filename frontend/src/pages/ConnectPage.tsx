import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Copy, Server, Terminal, Wifi, XCircle } from "lucide-react";
import { api } from "../api/client";
import { ConnectionConfig, ConnectionMode, GatewayError } from "../api/types";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { connectionModeLabels, labelFor } from "../lib/i18n";
import { useConnectionStore } from "../store/connectionStore";

const modeMeta: Record<ConnectionMode, { label: string; icon: typeof Terminal; defaults: Partial<ConnectionConfig> }> = {
  local: {
    label: "本机 Hermes",
    icon: Terminal,
    defaults: {
      name: "本机 Hermes",
      apiBaseUrl: "http://127.0.0.1:9788",
      wsBaseUrl: "ws://127.0.0.1:9788",
      dashboardUrl: "http://127.0.0.1:9119",
    },
  },
  remote: {
    label: "局域网服务器 Hermes",
    icon: Wifi,
    defaults: {
      name: "局域网 Hermes",
      apiBaseUrl: "http://192.168.1.100:9788",
      wsBaseUrl: "ws://192.168.1.100:9788",
      dashboardUrl: "http://192.168.1.100:9119",
    },
  },
  advanced: {
    label: "手动高级配置",
    icon: Server,
    defaults: {
      name: "手动 Hermes 网关",
    },
  },
};

function errorMessage(error: unknown): string {
  const gateway = error as GatewayError;
  if (gateway?.error === "auth_failed") return "认证失败：Token 缺失或无效。";
  if (gateway?.error === "network_error") return "连接失败：请检查网关 URL 和防火墙。";
  if (gateway?.message) return gateway.message;
  return String(error);
}

export function ConnectPage() {
  const { connections, addConnection, setActiveConnection, setStatus } = useConnectionStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<ConnectionMode>("local");
  const [name, setName] = useState(modeMeta.local.defaults.name || "");
  const [apiBaseUrl, setApiBaseUrl] = useState(modeMeta.local.defaults.apiBaseUrl || "");
  const [wsBaseUrl, setWsBaseUrl] = useState(modeMeta.local.defaults.wsBaseUrl || "");
  const [dashboardUrl, setDashboardUrl] = useState(modeMeta.local.defaults.dashboardUrl || "");
  const [token, setToken] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleModeChange = (next: ConnectionMode) => {
    const defaults = modeMeta[next].defaults;
    setMode(next);
    setName(defaults.name || name);
    setApiBaseUrl(defaults.apiBaseUrl || apiBaseUrl);
    setWsBaseUrl(defaults.wsBaseUrl || wsBaseUrl);
    setDashboardUrl(defaults.dashboardUrl || dashboardUrl);
    setTestResult(null);
  };

  const buildConnection = (): ConnectionConfig => ({
    id: crypto.randomUUID(),
    name,
    mode,
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
    wsBaseUrl: wsBaseUrl.replace(/\/$/, ""),
    dashboardUrl,
    token,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const candidate = buildConnection();
    api.setConfig(candidate);
    try {
      const health = await api.testConnection();
      if (health.ok) {
        setTestResult({ ok: true, message: `连接测试成功。网关 ${health.gateway}，Dashboard ${health.hermesDashboard}。` });
      } else {
        setTestResult({ ok: false, message: "网关已响应，但健康检查未通过。" });
      }
    } catch (error) {
      setTestResult({ ok: false, message: errorMessage(error) });
    } finally {
      setIsTesting(false);
    }
  };

  const connect = (connection?: ConnectionConfig) => {
    const target = connection || addConnection(buildConnection());
    api.setConfig(target);
    setActiveConnection(target.id);
    setStatus(target.mode === "remote" ? "remote_connected" : "local_connected");
    navigate("/status");
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 p-6 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Terminal className="h-6 w-6" />
              连接到网关
            </CardTitle>
            <CardDescription>连接 9788 端口上的 Hermes UI Gateway。官方 Dashboard 的 9119 端口应保持私有。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              {(Object.keys(modeMeta) as ConnectionMode[]).map((key) => {
                const Icon = modeMeta[key].icon;
                return (
                  <button
                    key={key}
                    onClick={() => handleModeChange(key)}
                    className={`rounded-lg border p-4 text-left transition ${
                      mode === key
                        ? "border-zinc-950 bg-zinc-100 dark:border-zinc-50 dark:bg-zinc-800"
                        : "border-zinc-200 bg-white hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <Icon className="mb-3 h-5 w-5" />
                    <div className="text-sm font-semibold">{modeMeta[key].label}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                名称
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Token
                <Input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="局域网或 0.0.0.0 网关需要填写" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                API 基础 URL
                <Input value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                WebSocket 基础 URL
                <Input value={wsBaseUrl} onChange={(event) => setWsBaseUrl(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-medium md:col-span-2">
                官方 Dashboard URL
                <Input value={dashboardUrl} onChange={(event) => setDashboardUrl(event.target.value)} />
              </label>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="font-medium">本机启动命令</div>
              <div className="mt-2 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between gap-3 rounded bg-white p-2 dark:bg-zinc-950">
                  <span>hermes dashboard --host 127.0.0.1 --port 9119 --no-open</span>
                  <Copy className="h-4 w-4" />
                </div>
                <div className="flex items-center justify-between gap-3 rounded bg-white p-2 dark:bg-zinc-950">
                  <span>cd backend && uvicorn app.main:app --host 127.0.0.1 --port 9788</span>
                  <Copy className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm dark:border-blue-900/50 dark:bg-blue-950/30">
              <div className="flex items-center gap-2 font-medium text-blue-900 dark:text-blue-200">
                <Terminal className="h-4 w-4" />
                SSH 直接连接指南
              </div>
              <div className="mt-2 space-y-2 text-blue-800/80 dark:text-blue-300/80">
                <p>网关内置了 SSH 服务器，允许您使用原生终端直接访问 Hermes TUI：</p>
                <div className="flex items-center justify-between gap-3 rounded border border-blue-200 bg-white p-2 font-mono text-xs dark:border-blue-800 dark:bg-zinc-950">
                  <span>ssh hermes@{new URL(apiBaseUrl || "http://127.0.0.1").hostname} -p 2222</span>
                  <Copy className="h-4 w-4 cursor-pointer hover:text-blue-500" />
                </div>
                <p className="text-[11px]">
                  <strong>认证：</strong> 用户名为 <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">hermes</code>，密码为您的 <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">HERMES_UI_TOKEN</code>。
                </p>
              </div>
            </div>

            {testResult && (
              <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${testResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"}`}>
                {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <XCircle className="mt-0.5 h-4 w-4" />}
                {testResult.message}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between gap-3">
            <Button variant="outline" onClick={handleTest} disabled={isTesting}>
              {isTesting ? "测试中..." : "测试连接"}
            </Button>
            <Button onClick={() => connect()}>连接</Button>
          </CardFooter>
        </Card>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-zinc-500">已保存连接</div>
          {connections.map((connection) => (
            <button
              key={connection.id}
              onClick={() => connect(connection)}
              className="w-full rounded-lg border border-zinc-200 bg-white p-4 text-left text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{connection.name}</span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">{labelFor(connectionModeLabels, connection.mode)}</span>
              </div>
              <div className="mt-1 truncate font-mono text-xs text-zinc-500">{connection.apiBaseUrl}</div>
              {connection.token && <div className="mt-1 text-xs text-zinc-500">Token 已保存：••••••••</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

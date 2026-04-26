import { useState } from "react";
import { Monitor, Shield, TestTube2, Trash2 } from "lucide-react";
import { api } from "../api/client";
import { GatewayError } from "../api/types";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { labelFor, themeLabels } from "../lib/i18n";
import { useConnectionStore } from "../store/connectionStore";
import { useThemeStore } from "../store/themeStore";

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

export const SettingsPage = () => {
  const { connections, activeConnectionId, setActiveConnection, deleteConnection } = useConnectionStore();
  const { theme, setTheme } = useThemeStore();
  const [fontSize, setFontSize] = useState(14);
  const [scrollback, setScrollback] = useState(5000);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  const pushDiagnostic = (line: string) => setDiagnostics((current) => [line, ...current].slice(0, 10));

  const testHealth = async () => {
    try {
      const health = await api.getHealth();
      pushDiagnostic(`/health 正常：${health.gateway}，ptySupported=${health.ptySupported}`);
    } catch (err) {
      pushDiagnostic(`/health 失败：${errorText(err)}`);
    }
  };

  const testStatus = async () => {
    try {
      const status = await api.getStatus();
      pushDiagnostic(`/api/status 正常：${status.version}，gateway=${status.gatewayStatus}`);
    } catch (err) {
      pushDiagnostic(`/api/status 失败：${errorText(err)}`);
    }
  };

  const testWebSocket = async () => {
    const wsBase = api.getWsBaseUrl();
    if (!wsBase) {
      pushDiagnostic("WebSocket 失败：缺少 wsBaseUrl");
      return;
    }
    const token = api.getToken();
    const ws = new WebSocket(`${wsBase.replace(/\/$/, "")}/ws/tui/settings-probe${token ? `?token=${encodeURIComponent(token)}` : ""}`);
    const timer = window.setTimeout(() => {
      pushDiagnostic("WebSocket 失败：超时");
      ws.close();
    }, 3000);
    ws.onmessage = (event) => {
      window.clearTimeout(timer);
      pushDiagnostic(`WebSocket 已到达 Gateway：${event.data}`);
      ws.close();
    };
    ws.onerror = () => {
      window.clearTimeout(timer);
      pushDiagnostic("WebSocket 失败：连接错误");
    };
  };

  return (
    <div className="space-y-6 p-8">
      <h1 className="flex items-center gap-3 text-2xl font-bold"><Monitor className="h-6 w-6" /> 设置</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">连接</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {connections.map((connection) => (
              <div key={connection.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <div className="min-w-0">
                  <div className="font-medium">{connection.name}</div>
                  <div className="truncate font-mono text-xs text-zinc-500">{connection.apiBaseUrl}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant={activeConnectionId === connection.id ? "secondary" : "outline"} size="sm" onClick={() => setActiveConnection(connection.id)}>使用</Button>
                  <Button variant="destructive" size="icon" onClick={() => deleteConnection(connection.id)} title="删除连接"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">外观</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(["light", "dark", "system"] as const).map((item) => <Button key={item} variant={theme === item ? "default" : "outline"} onClick={() => setTheme(item)}>{labelFor(themeLabels, item)}</Button>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">终端设置</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm">字号<Input type="number" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label>
            <label className="grid gap-2 text-sm">回滚行数<Input type="number" value={scrollback} onChange={(event) => setScrollback(Number(event.target.value))} /></label>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Shield className="h-5 w-5" /> 安全</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <div>Token 目前存储在本地应用状态中。</div>
            <div>安全存储会在后续 Tauri keychain 集成中接入。</div>
            <div>局域网 Gateway 应要求强 Token。</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><TestTube2 className="h-5 w-5" /> 诊断</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={testHealth}>测试 /health</Button>
            <Button variant="outline" size="sm" onClick={testStatus}>测试 /api/status</Button>
            <Button variant="outline" size="sm" onClick={testWebSocket}>测试 WebSocket</Button>
          </div>
          <div className="rounded-lg bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-950">
            {diagnostics.length === 0 ? <div className="text-zinc-500">尚未运行诊断。</div> : diagnostics.map((line) => <div key={line}>{line}</div>)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

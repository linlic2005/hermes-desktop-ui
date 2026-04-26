import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Globe, RefreshCw, RotateCw } from "lucide-react";
import { api } from "../api/client";
import { GatewayError, ServerInfo, SystemStatus } from "../api/types";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { labelFor, stateLabels } from "../lib/i18n";

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

export const PlatformsPage = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [restartSupported, setRestartSupported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [statusData, serverData, actionData] = await Promise.all([
        api.getStatus(),
        api.getServerInfo(),
        api.getActionStatus("gateway.restart").catch(() => ({ supported: false })),
      ]);
      setStatus(statusData);
      setServer(serverData);
      setRestartSupported(Boolean(actionData.supported));
      setError(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const restart = async () => {
    if (!restartSupported || !confirm("重启 Gateway？")) return;
    try {
      await api.restartGateway();
      await fetchData();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-2xl font-bold"><Globe className="h-6 w-6" /> 网关 / 平台</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="mr-2 h-4 w-4" /> 刷新</Button>
          <Button variant="outline" size="sm" onClick={restart} disabled={!restartSupported}><RotateCw className="mr-2 h-4 w-4" /> 重启网关</Button>
        </div>
      </div>
      {loading && <div className="text-sm text-zinc-500">正在加载网关...</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {status && server && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardHeader><CardTitle className="text-sm">状态</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{labelFor(stateLabels, status.gatewayStatus)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">PID</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{status.gatewayPid || "未知"}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">模式</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{labelFor(stateLabels, server.mode)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">监听</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{status.gatewayHost || "未知"}:{status.gatewayPort || "未知"}</CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-lg">服务器</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-2">
              <span className="text-zinc-500">Gateway URL</span><span>{server.gatewayUrl}</span>
              <span className="text-zinc-500">Dashboard URL</span><span>{server.dashboardUrl}</span>
              <span className="text-zinc-500">支持 PTY</span><span>{server.ptySupported ? "是" : "否"}</span>
              <span className="text-zinc-500">原生 Windows 实验支持</span><span>{server.nativeWindowsExperimental ? "是" : "否"}</span>
              <span className="text-zinc-500">检测到 WSL</span><span>{server.wslDetected ? "是" : "否"}</span>
              <span className="text-zinc-500">网关日志</span><Link className="text-cyan-600 dark:text-cyan-300" to="/logs">打开网关日志</Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">平台</CardTitle></CardHeader>
            <CardContent>
              {status.connectedPlatforms.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">暂无已配置平台。</div>
              ) : (
                <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {status.connectedPlatforms.map((platform) => (
                    <div key={platform.name} className="flex items-center justify-between p-4 text-sm">
                      <span className="font-medium">{platform.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">{platform.configured ? "已配置" : "缺少设置"}</span>
                        <span className={`rounded px-2 py-0.5 text-xs ${platform.state === "connected" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"}`}>{labelFor(stateLabels, platform.state)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

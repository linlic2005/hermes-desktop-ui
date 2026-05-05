import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw, Server, Terminal, FileText } from "lucide-react";
import { api } from "../api/client";
import { GatewayError, SystemStatus, RemoteDiscoverResponse } from "../api/types";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { labelFor, stateLabels } from "../lib/i18n";
import { useConnectionStore } from "../store/connectionStore";

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

export function StatusPage() {
  const { connections, activeConnectionId } = useConnectionStore();
  const activeConnection = connections.find(c => c.id === activeConnectionId);

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [remoteInfo, setRemoteInfo] = useState<RemoteDiscoverResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError(null);
    try {
      setStatus(await api.getStatus());
      
      if (activeConnection?.ssh) {
        const res = await api.discoverRemote({
          ...activeConnection.ssh,
          ...activeConnection.remote
        });
        setRemoteInfo(res);
      }
    } catch (err) {
      // Don't fail the whole page if remote info fails
      if (!status) setError(errorText(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeConnection, status]);

  const handleRestartRemote = async (target: any) => {
    if (!activeConnection?.ssh) return;
    setRefreshing(true);
    try {
      await api.restartRemoteService({
        connection: activeConnection.ssh,
        target,
        port: target === "dashboard" ? activeConnection.remote?.dashboardPort : activeConnection.remote?.hermesGatewayPort,
        hermesHome: activeConnection.remote?.hermesHome
      });
      await fetchStatus(true);
    } catch (err) {
      alert(errorText(err));
    } finally {
      setRefreshing(false);
    }
  };

  const handleViewLogs = async (target: any) => {
    if (!activeConnection?.ssh) return;
    try {
      const res = await api.getRemoteLogs({
        connection: activeConnection.ssh,
        target,
        lines: 100,
        hermesHome: activeConnection.remote?.hermesHome
      });
      // Basic modal or just console for now - in real app would use a dedicated log viewer
      console.log(`Remote Logs for ${target}:`, res.raw);
      alert(`已获取 ${target} 最近 100 行日志，请在控制台查看详情。\n\n内容预览:\n${res.raw.slice(0, 500)}...`);
    } catch (err) {
      alert(errorText(err));
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = window.setInterval(() => fetchStatus(true), 5000);
    return () => window.clearInterval(interval);
  }, [fetchStatus]);

  if (loading) return <div className="p-8 text-sm text-zinc-500">正在加载状态...</div>;

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <Activity className="h-6 w-6" />
          状态
        </h1>
        <Button variant="outline" size="sm" onClick={() => fetchStatus(true)} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardContent className="p-4 text-sm text-red-900 dark:text-red-200">{error}</CardContent>
        </Card>
      )}

      {!status && !error && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">暂无状态数据。</div>}

      {status && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">版本</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{status.version}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">发布日期</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{status.releaseDate}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">网关</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{labelFor(stateLabels, status.gatewayStatus)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">活跃会话</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{status.activeSessionsCount}</CardContent>
            </Card>
          </div>

          {activeConnection?.ssh && remoteInfo && (
            <Card className="border-blue-100 bg-blue-50/30 dark:border-blue-900/30 dark:bg-blue-950/10">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg text-blue-900 dark:text-blue-200">
                  <Server className="h-5 w-5" />
                  远程服务器管理: {activeConnection.ssh.host}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-blue-800/70 dark:text-blue-300/70 uppercase">系统信息</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-zinc-500">主机名</span><span className="font-mono">{remoteInfo.system.hostname}</span>
                      <span className="text-zinc-500">操作系统</span><span>{remoteInfo.system.os}</span>
                      <span className="text-zinc-500">Python</span><span>{remoteInfo.system.python}</span>
                      <span className="text-zinc-500">Hermes</span><span>{remoteInfo.hermes.commandAvailable ? remoteInfo.hermes.version : "未找到"}</span>
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-2">
                    <div className="text-xs font-semibold text-blue-800/70 dark:text-blue-300/70 uppercase">服务状态与控制</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(remoteInfo.services).map(([key, svc]: [string, any]) => (
                        <div key={key} className="flex items-center justify-between rounded-lg border border-blue-100 bg-white p-3 dark:border-blue-900 dark:bg-zinc-900">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium capitalize">{key}</span>
                            <span className="text-[10px] text-zinc-500">端口 {svc.port}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`mr-2 h-2 w-2 rounded-full ${svc.listening ? "bg-emerald-500" : "bg-zinc-300"}`} />
                            <Button variant="ghost" size="xs" onClick={() => handleViewLogs(key)}>
                              <FileText className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="xs" onClick={() => handleRestartRemote(key)}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">网关 / 平台</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-zinc-500">PID</span><span>{status.gatewayPid || "未知"}</span>
                  <span className="text-zinc-500">模式</span><span>{labelFor(stateLabels, status.gatewayMode)}</span>
                  <span className="text-zinc-500">监听</span><span>{status.gatewayHost || "未知"}:{status.gatewayPort || "未知"}</span>
                  <span className="text-zinc-500">SSH</span>
                  <span className={status.sshEnabled ? "text-emerald-500 font-medium" : "text-zinc-400"}>
                    {status.sshEnabled ? `运行中 (端口 ${status.sshPort})` : "已禁用"}
                  </span>
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                  {status.connectedPlatforms.length === 0 ? (
                    <div className="p-4 text-center text-zinc-500">暂无已配置平台。</div>
                  ) : (
                    status.connectedPlatforms.map((platform) => (
                      <div key={platform.name} className="flex items-center justify-between border-b border-zinc-200 p-3 last:border-0 dark:border-zinc-800">
                        <span className="font-medium">{platform.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">{platform.configured ? "已配置" : "未配置"}</span>
                          <span className={`rounded px-2 py-0.5 text-xs ${platform.state === "connected" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>{labelFor(stateLabels, platform.state)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">最近会话</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {status.recentSessions.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-zinc-500">暂无最近会话。</div>
                ) : (
                  status.recentSessions.map((session) => (
                    <div key={session.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{session.title}</span>
                        {session.live && <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">在线</span>}
                      </div>
                      <div className="mt-1 flex gap-2 text-xs text-zinc-500">
                        <span>{session.platform}</span>
                        <span>{session.model}</span>
                        <span>{session.messageCount} 条消息</span>
                      </div>
                      <div className="mt-1 truncate text-xs text-zinc-500">{session.preview}</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

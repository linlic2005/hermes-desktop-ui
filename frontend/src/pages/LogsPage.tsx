import { useEffect, useMemo, useState } from "react";
import { Copy, Download, RefreshCw, ScrollText } from "lucide-react";
import { api } from "../api/client";
import { GatewayError, LogLine, LogParams } from "../api/types";
import { PluginSlot } from "../components/plugins/PluginSlot";
import { Button } from "../components/ui/Button";

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

const levelClass: Record<string, string> = {
  ERROR: "text-red-400",
  WARNING: "text-amber-400",
  WARN: "text-amber-400",
  INFO: "text-blue-400",
  DEBUG: "text-purple-400",
};

const fileLabels: Record<string, string> = {
  agent: "智能体",
  errors: "错误",
  gateway: "网关",
};

export const LogsPage = () => {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [file, setFile] = useState<LogParams["file"]>("agent");
  const [level, setLevel] = useState<LogParams["level"]>("ALL");
  const [component, setComponent] = useState("all");
  const [lines, setLines] = useState(100);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setError(null);
    try {
      setLogs(await api.getLogs({ file, level, component, lines }));
    } catch (err) {
      setError(errorText(err));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const timer = window.setInterval(fetchLogs, 3000);
    return () => window.clearInterval(timer);
  }, [file, level, component, lines, autoRefresh]);

  const visibleText = useMemo(() => logs.map((log) => `${log.timestamp} ${log.level} [${log.component || log.module || "app"}] ${log.message}`).join("\n"), [logs]);

  const copyVisible = async () => {
    await navigator.clipboard?.writeText(visibleText);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([visibleText], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${file}-logs.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PluginSlot name="logs:top" />
      <div className="border-b border-zinc-200 p-6 dark:border-zinc-800">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-3 text-2xl font-bold"><ScrollText className="h-6 w-6" /> 日志</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs}><RefreshCw className="mr-2 h-4 w-4" /> 刷新</Button>
            <Button variant="outline" size="sm" onClick={copyVisible}><Copy className="mr-2 h-4 w-4" /> 复制当前日志</Button>
            <Button variant="outline" size="sm" onClick={download}><Download className="mr-2 h-4 w-4" /> 下载日志</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <select className="rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950" value={file} onChange={(event) => setFile(event.target.value as LogParams["file"])}>
            <option value="agent">{fileLabels.agent}</option>
            <option value="errors">{fileLabels.errors}</option>
            <option value="gateway">{fileLabels.gateway}</option>
          </select>
          <select className="rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950" value={level} onChange={(event) => setLevel(event.target.value as LogParams["level"])}>
            {["ALL", "DEBUG", "INFO", "WARNING", "ERROR"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input className="rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950" value={component} onChange={(event) => setComponent(event.target.value || "all")} placeholder="组件" />
          <select className="rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950" value={lines} onChange={(event) => setLines(Number(event.target.value))}>
            {[50, 100, 200, 500].map((item) => <option key={item} value={item}>{item} 行</option>)}
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
            自动刷新
          </label>
        </div>
      </div>

      {error && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}

      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-950 p-4 font-mono text-xs">
        {loading && <div className="text-zinc-500">正在加载日志...</div>}
        {!loading && logs.length === 0 && <div className="text-zinc-500">没有符合当前筛选条件的日志。</div>}
        <div className="space-y-1">
          {logs.map((log, index) => {
            const normalizedLevel = log.level.toUpperCase();
            return (
              <div key={`${log.timestamp}-${index}`} className="grid grid-cols-[90px_76px_120px_1fr] gap-3 rounded px-2 py-1 hover:bg-white/5">
                <span className="text-zinc-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={levelClass[normalizedLevel] || "text-zinc-400"}>{normalizedLevel}</span>
                <span className="truncate text-cyan-400">[{log.component || log.module || "app"}]</span>
                <span className="whitespace-pre-wrap text-zinc-200">{log.message}</span>
              </div>
            );
          })}
        </div>
      </div>
      <PluginSlot name="logs:bottom" />
    </div>
  );
};

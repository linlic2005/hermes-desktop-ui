import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, Search, Wrench } from "lucide-react";
import { api } from "../api/client";
import { GatewayError, ToolsetInfo } from "../api/types";
import { PluginSlot } from "../components/plugins/PluginSlot";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { labelFor, stateLabels } from "../lib/i18n";

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

export const ToolsetsPage = () => {
  const [toolsets, setToolsets] = useState<ToolsetInfo[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToolsets = async () => {
    try {
      setToolsets(await api.getToolsets());
      setError(null);
    } catch (err) {
      setToolsets([]);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToolsets();
  }, []);

  const filtered = toolsets.filter((toolset) => `${toolset.name || toolset.label} ${toolset.description}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 p-8">
      <PluginSlot name="toolsets:top" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-2xl font-bold"><Wrench className="h-6 w-6" /> 工具集</h1>
        <div className="flex gap-2">
          <label className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <input className="rounded-md border border-zinc-200 bg-white py-2 pl-8 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" placeholder="搜索工具集" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <Button variant="outline" size="sm" onClick={fetchToolsets}><RefreshCw className="mr-2 h-4 w-4" /> 刷新</Button>
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {loading && <div className="text-sm text-zinc-500">正在加载工具集...</div>}
      {!loading && filtered.length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">没有找到工具集。</div>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((toolset) => {
          const configured = toolset.configured ?? toolset.isConfigured ?? false;
          const active = Boolean(toolset.active);
          return (
            <Card key={toolset.id}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-3 text-base">
                  <span>{toolset.label || toolset.name || toolset.id}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"}`}>{active ? labelFor(stateLabels, "active") : labelFor(stateLabels, "inactive")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">{toolset.description}</div>
                <div className="flex items-center gap-2 text-sm">
                  {configured ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                  {configured ? "已配置" : "缺少设置"}
                </div>
                {!configured && toolset.setupRequirements && toolset.setupRequirements.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    缺少：{toolset.setupRequirements.join(", ")}
                  </div>
                )}
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">工具（{toolset.tools.length}）</summary>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {toolset.tools.map((tool) => <span key={tool} className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">{tool}</span>)}
                  </div>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <PluginSlot name="toolsets:bottom" />
    </div>
  );
};

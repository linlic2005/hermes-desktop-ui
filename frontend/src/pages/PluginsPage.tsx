import { useEffect, useState } from "react";
import { Blocks, Code2, FileJson, RefreshCw, ShieldAlert } from "lucide-react";
import { api } from "../api/client";
import { GatewayError, PluginInfo } from "../api/types";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { labelFor, stateLabels } from "../lib/i18n";

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

export const PluginsPage = () => {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [manifest, setManifest] = useState<PluginInfo | null>(null);
  const [assetResult, setAssetResult] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlugins = async () => {
    try {
      setPlugins(await api.getDashboardPlugins());
      setError(null);
    } catch (err) {
      setPlugins([]);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const rescan = async (method: "GET" | "POST") => {
    try {
      await api.rescanDashboardPlugins(method);
      await fetchPlugins();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const testAsset = async () => {
    try {
      const text = await api.getPluginAssetText("demo-plugin", "dist/index.js");
      setAssetResult(text.slice(0, 80));
    } catch (err) {
      setAssetResult(errorText(err));
    }
  };

  const testApi = async () => {
    try {
      setApiResult(JSON.stringify(await api.getPluginData("demo-plugin", "data"), null, 2));
    } catch (err) {
      setApiResult(errorText(err));
    }
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-2xl font-bold"><Blocks className="h-6 w-6" /> 插件</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => rescan("GET")}><RefreshCw className="mr-2 h-4 w-4" /> 重新扫描 GET</Button>
          <Button variant="outline" size="sm" onClick={() => rescan("POST")}><RefreshCw className="mr-2 h-4 w-4" /> 重新扫描 POST</Button>
        </div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <ShieldAlert className="mr-2 inline h-4 w-4" />
        Desktop UI 默认不执行不可信插件 JavaScript。
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      <Card>
        <CardHeader><CardTitle className="text-lg">网关插件探测</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={testAsset}><Code2 className="mr-2 h-4 w-4" /> 读取静态资源</Button>
            <Button variant="outline" size="sm" onClick={testApi}><Code2 className="mr-2 h-4 w-4" /> 调用插件 API</Button>
          </div>
          {assetResult && <pre className="overflow-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-950">{assetResult}</pre>}
          {apiResult && <pre className="overflow-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-950">{apiResult}</pre>}
        </CardContent>
      </Card>
      {loading && <div className="text-sm text-zinc-500">正在加载插件...</div>}
      {!loading && plugins.length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">没有找到插件。</div>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plugins.map((plugin) => {
          const hidden = plugin.tabs?.some((tab) => tab.hidden);
          const override = plugin.tabs?.some((tab) => tab.override);
          return (
            <Card key={plugin.id || plugin.name}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-3 text-base">
                  <span>{plugin.label || plugin.name}</span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{labelFor(stateLabels, plugin.status || "active")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">{plugin.description}</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {hidden && <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">仅插槽</span>}
                  {override && <span className="rounded bg-red-100 px-2 py-1 text-red-800 dark:bg-red-950 dark:text-red-200">替换警告</span>}
                  <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{plugin.source}</span>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-zinc-500">插槽</div>
                  <div className="flex flex-wrap gap-1">
                    {(plugin.slots || []).length === 0 ? <span className="text-xs text-zinc-500">无</span> : plugin.slots?.map((slot) => <span key={slot.name} className="rounded bg-cyan-100 px-2 py-1 text-xs text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">{slot.name}</span>)}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setManifest(plugin)}><FileJson className="mr-2 h-4 w-4" /> Manifest JSON</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {manifest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <Card className="max-h-[85vh] w-full max-w-3xl overflow-hidden">
            <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-lg">{manifest.name} manifest</CardTitle><Button variant="ghost" size="sm" onClick={() => setManifest(null)}>关闭</Button></CardHeader>
            <CardContent><pre className="max-h-[65vh] overflow-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-950">{JSON.stringify(manifest.manifest || manifest, null, 2)}</pre></CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

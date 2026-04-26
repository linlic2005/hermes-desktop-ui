import { useEffect, useState } from "react";
import { LineChart, RefreshCw } from "lucide-react";
import { api } from "../api/client";
import { GatewayError, UsageAnalytics } from "../api/types";
import { PluginSlot } from "../components/plugins/PluginSlot";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

export const AnalyticsPage = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setError(null);
    try {
      setData(await api.getUsageAnalytics(days));
    } catch (err) {
      setData(null);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  return (
    <div className="space-y-6 p-8">
      <PluginSlot name="analytics:top" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-2xl font-bold"><LineChart className="h-6 w-6" /> 分析</h1>
        <div className="flex gap-2">
          {[7, 30, 90].map((item) => (
            <Button key={item} variant={days === item ? "default" : "outline"} size="sm" onClick={() => setDays(item)}>{item} 天</Button>
          ))}
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="mr-2 h-4 w-4" /> 刷新</Button>
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {loading && <div className="text-sm text-zinc-500">正在加载分析数据...</div>}
      {!loading && !data && !error && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">暂无分析数据。</div>}
      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardHeader><CardTitle className="text-sm">输入 token</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data.totalInputTokens.toLocaleString()}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">输出 token</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data.totalOutputTokens.toLocaleString()}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">总 token</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data.totalTokens.toLocaleString()}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">费用</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">${data.totalCost.toFixed(2)}</CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">每日 token 图表</CardTitle></CardHeader>
            <CardContent>
              {data.dailyCharts.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">暂无每日用量。</div>
              ) : (
                <div className="flex h-48 items-end gap-2">
                  {data.dailyCharts.map((item) => (
                    <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                      <div className="w-full rounded-t bg-cyan-500" style={{ height: `${Math.max(8, (item.totalTokens / Math.max(...data.dailyCharts.map((d) => d.totalTokens))) * 160)}px` }} />
                      <span className="text-[10px] text-zinc-500">{item.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">每日明细</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-zinc-500"><tr><th className="py-2">日期</th><th>输入</th><th>输出</th><th>总计</th><th>费用</th></tr></thead>
                  <tbody>{data.dailyTable.map((row) => <tr key={row.date} className="border-t border-zinc-200 dark:border-zinc-800"><td className="py-2">{row.date}</td><td>{row.inputTokens}</td><td>{row.outputTokens}</td><td>{row.totalTokens}</td><td>${(row.cost || 0).toFixed(2)}</td></tr>)}</tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">按模型明细</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-zinc-500"><tr><th className="py-2">模型</th><th>输入</th><th>输出</th><th>总计</th><th>费用</th></tr></thead>
                  <tbody>{data.modelTable.map((row) => <tr key={row.model} className="border-t border-zinc-200 dark:border-zinc-800"><td className="py-2">{row.model}</td><td>{row.inputTokens}</td><td>{row.outputTokens}</td><td>{row.totalTokens}</td><td>${(row.cost || 0).toFixed(2)}</td></tr>)}</tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      <PluginSlot name="analytics:bottom" />
    </div>
  );
};

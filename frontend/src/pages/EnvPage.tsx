import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Key, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { api } from "../api/client";
import { EnvKey, GatewayError } from "../api/types";
import { PluginSlot } from "../components/plugins/PluginSlot";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

const CATEGORIES = ["LLM Providers", "Tool API Keys", "Messaging Platforms", "Agent Settings", "Advanced"];
const CATEGORY_LABELS: Record<string, string> = {
  "LLM Providers": "LLM 提供商",
  "Tool API Keys": "工具 API 密钥",
  "Messaging Platforms": "消息平台",
  "Agent Settings": "智能体设置",
  Advanced: "高级",
};

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  if (gateway?.error === "not_supported") return "当前 Dashboard 不支持显示密钥。";
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

export function EnvPage() {
  const [keys, setKeys] = useState<EnvKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const fetchKeys = async () => {
    setError(null);
    try {
      setKeys(await api.getEnv());
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const grouped = useMemo(() => {
    const filtered = keys.filter((item) => item.key.toLowerCase().includes(search.toLowerCase()) || item.description?.toLowerCase().includes(search.toLowerCase()));
    return CATEGORIES.map((category) => [category, filtered.filter((item) => item.category === category)] as const);
  }, [keys, search]);

  const saveKey = async (key: string, value: string) => {
    if (!value) return;
    setError(null);
    try {
      await api.setEnv(key, value);
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setRevealed((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setMessage(`${key} 已保存。`);
      await fetchKeys();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const deleteKey = async (key: string) => {
    if (!confirm(`删除 ${key}？此操作会写入审计日志。`)) return;
    try {
      await api.deleteEnv(key);
      setMessage(`${key} 已删除。`);
      await fetchKeys();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const revealKey = async (key: string) => {
    if (revealed[key]) {
      setRevealed((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    if (!confirm(`显示 ${key}？这可能暴露密钥，并会记录到审计日志。`)) return;
    try {
      const value = await api.revealEnv(key);
      setRevealed((current) => ({ ...current, [key]: value }));
    } catch (err) {
      setError(errorText(err));
    }
  };

  const addNew = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    await saveKey(newKey.trim(), newValue);
    setNewKey("");
    setNewValue("");
  };

  if (loading) return <div className="p-8 text-sm text-zinc-500">正在加载 API 密钥...</div>;

  return (
    <div className="space-y-6 p-8">
      <PluginSlot name="env:top" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-2xl font-bold"><Key className="h-6 w-6" /> API 密钥 / 环境变量</h1>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <input className="rounded-md border border-zinc-200 bg-white py-2 pl-8 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" placeholder="搜索密钥" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <Button variant="outline" size="sm" onClick={fetchKeys}><RefreshCw className="mr-2 h-4 w-4" /> 刷新</Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{message}</div>}

      <Card>
        <CardHeader><CardTitle className="text-lg">设置密钥</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input placeholder="KEY_NAME" value={newKey} onChange={(event) => setNewKey(event.target.value.toUpperCase())} className="font-mono" />
          <Input placeholder="值" type="password" value={newValue} onChange={(event) => setNewValue(event.target.value)} className="font-mono" />
          <Button onClick={addNew} disabled={!newKey || !newValue}><Plus className="mr-2 h-4 w-4" /> 保存</Button>
        </CardContent>
      </Card>

      {grouped.every(([, items]) => items.length === 0) && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">没有找到环境变量密钥。</div>}

      <div className="space-y-6">
        {grouped.map(([category, items]) => (
          <Card key={category}>
            <CardHeader><CardTitle className="text-lg">{CATEGORY_LABELS[category] || category}</CardTitle></CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="px-6 pb-6 text-sm text-zinc-500">这个分类下暂无密钥。</div>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {items.map((item) => {
                    const configured = item.isConfigured ?? item.set ?? false;
                    const visibleValue = revealed[item.key];
                    const draft = drafts[item.key] || "";
                    return (
                      <div key={item.key} className="grid gap-3 p-4 lg:grid-cols-[260px_1fr_auto] lg:items-center">
                        <div>
                          <div className="font-mono text-sm font-semibold">{item.key}</div>
                          <div className="mt-1 text-xs text-zinc-500">{item.description || (configured ? "已配置" : "缺失")}</div>
                        </div>
                        <Input
                          type={visibleValue ? "text" : "password"}
                          value={visibleValue || draft || item.redacted || "••••••••••••"}
                          readOnly={!visibleValue && !draft}
                          onChange={(event) => setDrafts((current) => ({ ...current, [item.key]: event.target.value }))}
                          className="font-mono"
                        />
                        <div className="flex justify-end gap-2">
                          {draft && <Button size="sm" onClick={() => saveKey(item.key, draft)}>保存</Button>}
                          <Button variant="outline" size="icon" onClick={() => revealKey(item.key)} title={visibleValue ? "隐藏" : "显示"}>
                            {visibleValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => deleteKey(item.key)} title="删除">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <PluginSlot name="env:bottom" />
    </div>
  );
}

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, RotateCcw, Save, Search, Terminal, Upload } from "lucide-react";
import { api } from "../api/client";
import { GatewayError } from "../api/types";
import { PluginSlot } from "../components/plugins/PluginSlot";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";

const CATEGORIES = ["model", "terminal", "display", "agent", "delegation", "memory", "approvals", "dashboard", "other"];
const CATEGORY_LABELS: Record<string, string> = {
  model: "模型",
  terminal: "终端",
  display: "显示",
  agent: "智能体",
  delegation: "委派",
  memory: "记忆",
  approvals: "审批",
  dashboard: "仪表盘",
  other: "其他",
};

type FieldDef = {
  type?: string;
  enum?: string[];
  description?: string;
  properties?: Record<string, FieldDef>;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function getAtPath(source: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, part) => (current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined), source);
}

function setAtPath(source: Record<string, unknown>, path: string, value: unknown) {
  const next = clone(source);
  const parts = path.split(".");
  let cursor: Record<string, unknown> = next;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return next;
}

function flattenSchema(schema: Record<string, unknown>): Record<string, FieldDef> {
  const flat: Record<string, FieldDef> = {};
  const walk = (properties: Record<string, unknown>, prefix = "") => {
    Object.entries(properties).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      const def = value as FieldDef;
      if (def.type === "object" && def.properties && Object.keys(def.properties).length > 0) {
        walk(def.properties as Record<string, unknown>, path);
      } else {
        flat[path] = def;
      }
    });
  };
  walk((schema.properties as Record<string, unknown>) || {});
  if (Object.keys(flat).length === 0) {
    return {
      "model.provider": { type: "string", enum: ["openai", "anthropic", "google"], description: "模型提供商" },
      "model.default": { type: "string", description: "默认模型" },
      "terminal.backend": { type: "string", enum: ["pty", "pipe"], description: "TUI 传输方式" },
      "terminal.scrollback": { type: "number", description: "终端回滚行数" },
      "display.tui_colors": { type: "boolean", description: "启用 ANSI 颜色" },
      "agent.max_iterations": { type: "number", description: "智能体最大循环次数" },
      "approvals.dangerous_actions": { type: "string", enum: ["ask", "deny", "allow"] },
      "dashboard.theme": { type: "string" },
    };
  }
  return flat;
}

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

export function ConfigPage() {
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [defaults, setDefaults] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState("model");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    Promise.all([api.getConfigSchema(), api.getConfig(), api.getConfigDefaults()])
      .then(([schemaData, configData, defaultsData]) => {
        setSchema(schemaData as unknown as Record<string, unknown>);
        setConfig(configData);
        setDefaults(defaultsData);
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setLoading(false));
  }, []);

  const fields = useMemo(() => flattenSchema(schema || { properties: {} }), [schema]);
  const filteredFields = useMemo(() => {
    return Object.entries(fields).filter(([path]) => {
      const category = CATEGORIES.find((item) => path.startsWith(`${item}.`)) || "other";
      const matchesTab = category === activeTab || search.length > 0;
      const matchesSearch = !search || path.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [activeTab, fields, search]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.updateConfig(config);
      setMessage("配置已保存。");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hermes-config.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setConfig(JSON.parse(await file.text()));
      setMessage("配置已导入到本地。保存后生效。");
    } catch {
      setError("配置 JSON 无效。");
    }
  };

  const renderField = (path: string, def: FieldDef) => {
    const value = getAtPath(config, path);
    if (def.enum) {
      return (
        <select className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" value={String(value ?? "")} onChange={(event) => setConfig(setAtPath(config, path, event.target.value))}>
          <option value="">请选择...</option>
          {def.enum.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    }
    if (def.type === "boolean") {
      return (
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={Boolean(value)} onChange={(event) => setConfig(setAtPath(config, path, event.target.checked))} />
          <span className="text-sm">{Boolean(value) ? "已启用" : "已禁用"}</span>
        </label>
      );
    }
    if (def.type === "number" || typeof value === "number") {
      return <input className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" type="number" value={Number(value ?? 0)} onChange={(event) => setConfig(setAtPath(config, path, Number(event.target.value)))} />;
    }
    if (def.type === "object") {
      return <textarea className="h-28 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950" value={JSON.stringify(value || {}, null, 2)} onChange={(event) => {
        try { setConfig(setAtPath(config, path, JSON.parse(event.target.value))); } catch { /* keep editing until valid */ }
      }} />;
    }
    return <input className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" value={String(value ?? "")} onChange={(event) => setConfig(setAtPath(config, path, event.target.value))} />;
  };

  if (loading) return <div className="p-8 text-sm text-zinc-500">正在加载配置...</div>;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PluginSlot name="config:top" />
      <div className="border-b border-zinc-200 p-8 pb-4 dark:border-zinc-800">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-3 text-2xl font-bold"><Terminal className="h-6 w-6" /> 配置</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setConfig(clone(defaults)); setMessage("已加载默认配置到本地。保存后生效。"); }}>
              <RotateCcw className="mr-2 h-4 w-4" /> 重置为默认值
            </Button>
            <Button variant="outline" size="sm" onClick={exportConfig}><Download className="mr-2 h-4 w-4" /> 导出</Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> 导入</Button>
            <Button size="sm" onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? "保存中..." : "保存"}</Button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importConfig} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3 overflow-x-auto">
            {CATEGORIES.map((category) => (
              <button key={category} onClick={() => { setActiveTab(category); setSearch(""); }} className={`border-b-2 px-1 pb-2 text-sm capitalize ${activeTab === category ? "border-zinc-950 text-zinc-950 dark:border-zinc-50 dark:text-zinc-50" : "border-transparent text-zinc-500"}`}>
                {CATEGORY_LABELS[category] || category}
              </button>
            ))}
          </div>
          <label className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <input className="rounded-md border border-zinc-200 bg-white py-2 pl-8 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" placeholder="搜索字段" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
        {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{message}</div>}
        {filteredFields.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">没有找到配置字段。</div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-3">
            {filteredFields.map(([path, def]) => (
              <Card key={path}>
                <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_320px] md:items-center">
                  <div>
                    <div className="font-mono text-sm font-semibold">{path}</div>
                    {def.description && <div className="mt-1 text-xs text-zinc-500">{def.description}</div>}
                  </div>
                  {renderField(path, def)}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <PluginSlot name="config:bottom" />
    </div>
  );
}

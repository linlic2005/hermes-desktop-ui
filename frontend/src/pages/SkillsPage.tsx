import { useEffect, useMemo, useState } from "react";
import { BookOpen, Filter, RefreshCw, Search, ToggleLeft, ToggleRight } from "lucide-react";
import { api } from "../api/client";
import { GatewayError, SkillInfo } from "../api/types";
import { PluginSlot } from "../components/plugins/PluginSlot";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { labelFor, stateLabels } from "../lib/i18n";

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

export const SkillsPage = () => {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [selected, setSelected] = useState<SkillInfo | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [enabledFilter, setEnabledFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkills = async () => {
    try {
      setSkills(await api.getSkills());
      setError(null);
    } catch (err) {
      setSkills([]);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const categories = useMemo(() => ["all", ...Array.from(new Set(skills.map((skill) => skill.category)))], [skills]);
  const filtered = skills.filter((skill) => {
    const enabled = skill.enabled ?? skill.isEnabled ?? false;
    if (category !== "all" && skill.category !== category) return false;
    if (enabledFilter === "enabled" && !enabled) return false;
    if (enabledFilter === "disabled" && enabled) return false;
    return skill.name.toLowerCase().includes(search.toLowerCase()) || skill.description.toLowerCase().includes(search.toLowerCase());
  });

  const toggle = async (skill: SkillInfo) => {
    const enabled = !(skill.enabled ?? skill.isEnabled ?? false);
    try {
      await api.toggleSkill(skill.name, enabled);
      await fetchSkills();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="space-y-6 p-8">
      <PluginSlot name="skills:top" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-2xl font-bold"><BookOpen className="h-6 w-6" /> 技能</h1>
        <Button variant="outline" size="sm" onClick={fetchSkills}><RefreshCw className="mr-2 h-4 w-4" /> 刷新</Button>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        已启用技能可在 Hermes TUI 中作为动态斜杠命令使用。
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      <div className="flex flex-wrap gap-3">
        <label className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
          <input className="rounded-md border border-zinc-200 bg-white py-2 pl-8 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" placeholder="搜索技能" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <select className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item} value={item}>{item === "all" ? "全部分类" : item}</option>)}
        </select>
        <select className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" value={enabledFilter} onChange={(event) => setEnabledFilter(event.target.value)}>
          <option value="all">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已禁用</option>
        </select>
      </div>
      {loading && <div className="text-sm text-zinc-500">正在加载技能...</div>}
      {!loading && filtered.length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">没有找到技能。</div>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((skill) => {
          const enabled = skill.enabled ?? skill.isEnabled ?? false;
          return (
            <Card key={skill.id || skill.name}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-3 text-base">
                  <span>{skill.name}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${enabled ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"}`}>{enabled ? labelFor(stateLabels, "enabled") : labelFor(stateLabels, "disabled")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">{skill.description}</div>
                <div className="flex items-center justify-between text-xs text-zinc-500"><span><Filter className="mr-1 inline h-3 w-3" />{skill.category}</span><span>{skill.source}</span></div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelected(skill)}>详情</Button>
                  <Button variant="outline" size="sm" onClick={() => toggle(skill)}>
                    {enabled ? <ToggleLeft className="mr-2 h-4 w-4" /> : <ToggleRight className="mr-2 h-4 w-4" />}
                    {enabled ? "禁用" : "启用"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {selected && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{selected.name}</h2><Button variant="ghost" size="sm" onClick={() => setSelected(null)}>关闭</Button></div>
          <pre className="overflow-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-950">{JSON.stringify(selected, null, 2)}</pre>
        </div>
      )}
      <PluginSlot name="skills:bottom" />
    </div>
  );
};

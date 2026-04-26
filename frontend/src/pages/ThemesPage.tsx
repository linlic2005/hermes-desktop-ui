import { useEffect, useState } from "react";
import { Monitor, Moon, Palette, RefreshCw, Sun } from "lucide-react";
import { api } from "../api/client";
import { GatewayError, ThemeInfo } from "../api/types";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { labelFor, themeLabels } from "../lib/i18n";
import { useThemeStore } from "../store/themeStore";

const builtIns = ["default", "midnight", "ember", "mono", "cyberpunk", "rose"];

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

export const ThemesPage = () => {
  const [themes, setThemes] = useState<ThemeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme: appTheme, setTheme: setAppTheme } = useThemeStore();

  const fetchThemes = async () => {
    try {
      setThemes(await api.getDashboardThemes());
      setError(null);
    } catch (err) {
      setThemes([]);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  const applyTheme = async (name: string) => {
    try {
      await api.setDashboardTheme(name);
      await fetchThemes();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-2xl font-bold"><Palette className="h-6 w-6" /> 主题</h1>
        <Button variant="outline" size="sm" onClick={fetchThemes}><RefreshCw className="mr-2 h-4 w-4" /> 刷新</Button>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      <Card>
        <CardHeader><CardTitle className="text-lg">应用外观</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[
            ["light", Sun],
            ["dark", Moon],
            ["system", Monitor],
          ].map(([name, Icon]) => (
            <Button key={name as string} variant={appTheme === name ? "default" : "outline"} onClick={() => setAppTheme(name as "light" | "dark" | "system")}>
              <Icon className="mr-2 h-4 w-4" /> {labelFor(themeLabels, name as string)}
            </Button>
          ))}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Hermes Dashboard 主题</h2>
        {loading && <div className="text-sm text-zinc-500">正在加载主题...</div>}
        {!loading && themes.length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">Dashboard 没有返回主题。</div>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {themes.map((theme) => (
            <Card key={theme.name} className={!builtIns.includes(theme.name) ? "border-amber-300 dark:border-amber-800" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span>{theme.label}</span>
                  {theme.active && <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">当前</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">{theme.description}</div>
                <div className="text-xs text-zinc-500">名称：{theme.name}</div>
                {theme.definition ? <pre className="max-h-32 overflow-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-950">{JSON.stringify(theme.definition, null, 2)}</pre> : null}
                {!builtIns.includes(theme.name) && <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">用户主题定义仅用于展示。Desktop UI 不执行 customCSS。</div>}
                <Button variant={theme.active ? "secondary" : "outline"} size="sm" onClick={() => applyTheme(theme.name)} disabled={theme.active}>
                  应用主题
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

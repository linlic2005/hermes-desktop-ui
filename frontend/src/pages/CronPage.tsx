import { useEffect, useState } from "react";
import { Clock, Pause, Play, Plus, RefreshCw, Trash2, Zap } from "lucide-react";
import { api } from "../api/client";
import { CronJob, GatewayError } from "../api/types";
import { PluginSlot } from "../components/plugins/PluginSlot";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { labelFor, stateLabels } from "../lib/i18n";

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

function validCron(value: string) {
  return value.trim().split(/\s+/).length === 5;
}

export const CronPage = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [schedule, setSchedule] = useState("0 9 * * *");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setError(null);
    try {
      setJobs(await api.getCronJobs());
    } catch (err) {
      setJobs([]);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const createJob = async () => {
    if (!prompt.trim() || !validCron(schedule)) return;
    try {
      await api.createCronJob({ name, prompt, schedule });
      setName("");
      setPrompt("");
      await fetchJobs();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const action = async (job: CronJob, kind: "pause" | "resume" | "trigger" | "delete") => {
    const actionLabel = kind === "trigger" ? "立即运行" : "删除";
    if ((kind === "trigger" || kind === "delete") && !confirm(`${actionLabel} ${job.name || job.id}？`)) return;
    try {
      if (kind === "pause") await api.pauseCronJob(job.id);
      if (kind === "resume") await api.resumeCronJob(job.id);
      if (kind === "trigger") await api.triggerCronJob(job.id);
      if (kind === "delete") await api.deleteCronJob(job.id);
      await fetchJobs();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="space-y-6 p-8">
      <PluginSlot name="cron:top" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-2xl font-bold"><Clock className="h-6 w-6" /> 定时任务</h1>
        <Button variant="outline" size="sm" onClick={fetchJobs}><RefreshCw className="mr-2 h-4 w-4" /> 刷新</Button>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}

      <Card>
        <CardHeader><CardTitle className="text-lg">创建任务</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[180px_1fr_160px_auto]">
          <Input placeholder="名称" value={name} onChange={(event) => setName(event.target.value)} />
          <Input placeholder="提示词" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          <Input placeholder="0 9 * * *" value={schedule} onChange={(event) => setSchedule(event.target.value)} className={!validCron(schedule) ? "border-red-400" : ""} />
          <Button onClick={createJob} disabled={!prompt || !validCron(schedule)}><Plus className="mr-2 h-4 w-4" /> 创建</Button>
        </CardContent>
      </Card>

      {loading && <div className="text-sm text-zinc-500">正在加载任务...</div>}
      {!loading && jobs.length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">暂无定时任务。</div>}
      <div className="grid gap-4">
        {jobs.map((job) => (
          <Card key={job.id}>
            <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{job.name || job.id}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${job.state === "enabled" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : job.state === "paused" ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"}`}>{labelFor(stateLabels, job.state)}</span>
                  <span className="font-mono text-xs text-zinc-500">{job.schedule || job.expression}</span>
                </div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{job.prompt}</div>
                <div className="mt-1 text-xs text-zinc-500">下次：{job.nextRun || "未知"} 上次：{job.lastRun || "从未运行"}</div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {job.state === "paused" ? (
                  <Button variant="outline" size="sm" onClick={() => action(job, "resume")}><Play className="mr-2 h-4 w-4" /> 恢复</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => action(job, "pause")}><Pause className="mr-2 h-4 w-4" /> 暂停</Button>
                )}
                <Button variant="outline" size="sm" onClick={() => action(job, "trigger")}><Zap className="mr-2 h-4 w-4" /> 立即运行</Button>
                <Button variant="destructive" size="sm" onClick={() => action(job, "delete")}><Trash2 className="mr-2 h-4 w-4" /> 删除</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <PluginSlot name="cron:bottom" />
    </div>
  );
};

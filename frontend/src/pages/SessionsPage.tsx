import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cpu, LayoutDashboard, MessageSquare, Play, RefreshCw, Search, Trash2, Wrench } from "lucide-react";
import { api } from "../api/client";
import { GatewayError, MessageInfo, SessionInfo } from "../api/types";
import { PluginSlot } from "../components/plugins/PluginSlot";
import { Button } from "../components/ui/Button";

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

const roleClass: Record<string, string> = {
  user: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950",
  assistant: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950",
  tool: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950",
  system: "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900",
};

const roleLabels: Record<string, string> = {
  user: "用户",
  assistant: "助手",
  tool: "工具",
  system: "系统",
};

export function SessionsPage() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [messages, setMessages] = useState<MessageInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchSessions = useCallback(async () => {
    setError(null);
    try {
      setSessions(search.trim() ? await api.searchSessions(search.trim()) : await api.getSessions());
    } catch (err) {
      setError(errorText(err));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    api.getSessionMessages(selected)
      .then(setMessages)
      .catch((err) => setError(errorText(err)))
      .finally(() => setLoadingMessages(false));
  }, [selected]);

  const deleteSession = async (id: string) => {
    if (!confirm("删除这个官方会话？")) return;
    try {
      await api.deleteSession(id);
      if (selected === id) setSelected(null);
      await fetchSessions();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-white dark:bg-zinc-950">
      <PluginSlot name="sessions:top" />
      <div className="flex w-full flex-col border-r border-zinc-200 dark:border-zinc-800 md:w-[420px]">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-xl font-bold"><LayoutDashboard className="h-5 w-5" /> 会话</h1>
            <Button variant="outline" size="sm" onClick={fetchSessions}><RefreshCw className="mr-2 h-4 w-4" /> 刷新</Button>
          </div>
          <label className="relative block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <input className="w-full rounded-md border border-zinc-200 bg-white py-2 pl-8 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" placeholder="搜索会话" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
        </div>

        {error && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}

        <div className="flex-1 overflow-y-auto p-4">
          {loading && <div className="py-8 text-center text-sm text-zinc-500">正在加载会话...</div>}
          {!loading && sessions.length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">没有找到会话。</div>}
          <div className="space-y-3">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelected(session.id)}
                className={`w-full rounded-lg border p-3 text-left text-sm transition ${selected === session.id ? "border-zinc-950 bg-zinc-100 dark:border-zinc-50 dark:bg-zinc-900" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{session.title}</div>
                    <div className="mt-1 truncate text-xs text-zinc-500">{session.preview}</div>
                    {session.snippets?.map((snippet) => <div key={snippet} className="mt-1 rounded bg-yellow-100 px-1 text-xs text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100">{snippet}</div>)}
                  </div>
                  {session.live && <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">在线</span>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                  <span>{session.platform}</span>
                  <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />{session.model}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{session.messageCount}</span>
                  <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{session.toolCalls}</span>
                  <span>{session.tokenUsage.toLocaleString()} token</span>
                </div>
                <div className="mt-3 flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/chat?resume=${encodeURIComponent(session.id)}`)}><Play className="mr-2 h-4 w-4" /> 在 TUI 中继续</Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteSession(session.id)}><Trash2 className="mr-2 h-4 w-4" /> 删除</Button>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 flex-col md:flex">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">选择一个会话查看消息。</div>
        ) : (
          <>
            <div className="border-b border-zinc-200 p-4 font-semibold dark:border-zinc-800">消息</div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingMessages && <div className="py-8 text-center text-sm text-zinc-500">正在加载消息...</div>}
              {!loadingMessages && messages.length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">暂无消息。</div>}
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`rounded-lg border p-4 ${roleClass[message.role] || roleClass.system}`}>
                    <div className="mb-2 flex justify-between gap-3 text-xs text-zinc-500">
                      <span className="font-semibold">{roleLabels[message.role] || message.role}</span>
                      <span>{new Date(message.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-6">{message.content}</div>
                    {(message.tool_calls || message.toolCalls)?.map((toolCall, index) => (
                      <details key={index} className="mt-3 rounded bg-white/70 p-2 text-xs dark:bg-zinc-950/70">
                        <summary className="cursor-pointer font-semibold">工具调用 {index + 1}</summary>
                        <pre className="mt-2 overflow-auto">{JSON.stringify(toolCall, null, 2)}</pre>
                      </details>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <PluginSlot name="sessions:bottom" />
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileText, MonitorX, Play, Plus, RotateCw, Settings2, XCircle } from "lucide-react";
import { Terminal } from "xterm";
import { api } from "../api/client";
import { GatewayError, TranscriptResponse, TuiWsMessage, UiSessionInfo } from "../api/types";
import { PluginSlot } from "../components/plugins/PluginSlot";
import { TerminalComponent } from "../components/terminal/TerminalComponent";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { labelFor, tuiStateLabels } from "../lib/i18n";
import { replaceWebSocket } from "../lib/websocket";

type TuiState = "starting" | "ready" | "running" | "interrupted" | "exited" | "error";

function errorText(error: unknown) {
  const gateway = error as GatewayError;
  return gateway?.error ? `${gateway.error}: ${gateway.message}` : String(error);
}

export function ChatPage() {
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const startedKeyRef = useRef<string | null>(null);
  const [searchParams] = useSearchParams();
  const { uiSessionId: routeSessionId } = useParams();
  const navigate = useNavigate();

  const [terminalReady, setTerminalReady] = useState(false);
  const [tuiState, setTuiState] = useState<TuiState>("starting");
  const [sessionInfo, setSessionInfo] = useState<UiSessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptResponse | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const writeLine = useCallback((text: string) => {
    termRef.current?.writeln(text);
  }, []);

  const connectWs = useCallback((sessionId: string) => {
    const wsBase = api.getWsBaseUrl();
    if (!wsBase) {
      setError("WebSocket 连接失败：缺少基础 URL");
      setTuiState("error");
      return;
    }
    const token = api.getToken();
    const url = `${wsBase.replace(/\/$/, "")}/ws/tui/${encodeURIComponent(sessionId)}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    writeLine(`\x1b[36m[Gateway]\x1b[0m WebSocket ${url.replace(/token=[^&]+/, "token=***")}`);
    const socket = new WebSocket(url);
    replaceWebSocket(wsRef, socket);

    socket.onopen = () => setTuiState("starting");
    socket.onmessage = (event) => {
      let message: TuiWsMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        termRef.current?.write(String(event.data));
        return;
      }
      if (message.type === "output") {
        termRef.current?.write(message.data);
        setTuiState("running");
      }
      if (message.type === "status") {
        if (message.state === "ready") setTuiState("ready");
        else if (message.state === "interrupted") setTuiState("interrupted");
        else if (message.state === "exited") setTuiState("exited");
        else if (message.state === "error") {
          setTuiState("error");
          setError(message.message);
        }
        writeLine(`\x1b[90m[${labelFor(tuiStateLabels, message.state)}]\x1b[0m ${message.message}`);
      }
      if (message.type === "session") {
        setSessionInfo((current) => ({ ...current, id: message.uiSessionId, pid: message.pid, hermesSessionId: message.hermesSessionId, status: "running" }));
      }
    };
    socket.onerror = () => {
      setTuiState("error");
      setError("WebSocket 连接失败");
    };
    socket.onclose = (event) => {
      if (event.code === 1008) setError("认证失败：WebSocket Token 被拒绝");
      if (event.code !== 1000 && event.code !== 1005) setError((current) => current || `WebSocket 已关闭：${event.code}`);
      setTuiState((current) => (current === "error" ? current : "exited"));
    };
  }, [writeLine]);

  useEffect(() => {
    if (!terminalReady) return;
    const resumeOfficialSessionId = searchParams.get("resume") || undefined;
    const continueLatest = searchParams.get("continueLatest") === "true";
    const startKey = routeSessionId || `new:${resumeOfficialSessionId || ""}:${continueLatest}`;
    if (startedKeyRef.current === startKey) return;
    startedKeyRef.current = startKey;

    let cancelled = false;
    const start = async () => {
      setError(null);
      setTuiState("starting");
      termRef.current?.clear();
      writeLine("\x1b[36m[Hermes UI Gateway]\x1b[0m 正在启动 TUI 会话...");
      try {
        const session = routeSessionId
          ? await api.getUiSession(routeSessionId)
          : await api.createUiSession({
              title: resumeOfficialSessionId ? `继续 ${resumeOfficialSessionId}` : continueLatest ? "继续最近会话" : "新的 TUI 会话",
              resumeOfficialSessionId,
              continueLatest,
            });
        if (cancelled) return;
        setSessionInfo(session);
        if (!routeSessionId) {
          navigate(`/chat/${session.id}`, { replace: true });
          return;
        }
        connectWs(session.id);
      } catch (err) {
        if (cancelled) return;
        setError(errorText(err));
        setTuiState("error");
        writeLine(`\x1b[31m${errorText(err)}\x1b[0m`);
      }
    };
    start();
    return () => {
      cancelled = true;
      wsRef.current?.close(1000);
      wsRef.current = null;
    };
  }, [connectWs, navigate, routeSessionId, searchParams, terminalReady, writeLine]);

  const send = (payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const handleTerminalData = (data: string) => {
    if (data === "\x03") {
      send({ type: "interrupt" });
      return;
    }
    send({ type: "input", data });
  };

  const handleOpenTranscript = async () => {
    if (!sessionInfo?.id) return;
    try {
      setTranscript(await api.getUiSessionTranscript(sessionInfo.id));
    } catch (err) {
      setError(errorText(err));
    }
  };

  const badgeClass = {
    starting: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    interrupted: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    exited: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  }[tuiState];

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <PluginSlot name="chat:top" />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{sessionInfo?.title || "对话"}</h1>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
              <span>UI 会话：{sessionInfo?.id || "启动中"}</span>
              {sessionInfo?.resumeOfficialSessionId && <span>继续官方会话：{sessionInfo.resumeOfficialSessionId}</span>}
              {sessionInfo?.continueLatest && <span>继续最近会话</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-1 text-xs font-medium ${badgeClass}`}>{labelFor(tuiStateLabels, tuiState)}</span>
            <Button variant="outline" size="sm" onClick={() => navigate("/chat")}>
              <Plus className="mr-2 h-4 w-4" /> 新建
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/chat?continueLatest=true")}>
              <Play className="mr-2 h-4 w-4" /> 继续最近会话
            </Button>
            <Button variant="outline" size="sm" onClick={() => sessionInfo?.id && connectWs(sessionInfo.id)}>
              <RotateCw className="mr-2 h-4 w-4" /> 重新连接
            </Button>
            <Button variant="outline" size="sm" onClick={() => termRef.current?.clear()}>
              <MonitorX className="mr-2 h-4 w-4" /> 清空终端显示
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenTranscript}>
              <FileText className="mr-2 h-4 w-4" /> 打开转录
            </Button>
            <Button variant="destructive" size="sm" onClick={() => send({ type: "interrupt" })}>
              <XCircle className="mr-2 h-4 w-4" /> Ctrl+C
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setInspectorOpen((value) => !value)} title="切换诊断面板">
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}

        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
          <TerminalComponent
            termRef={termRef}
            onReady={() => setTerminalReady(true)}
            onData={handleTerminalData}
            onResize={(cols, rows) => send({ type: "resize", cols, rows })}
          />
        </div>
        <PluginSlot name="chat:bottom" />
      </div>

      {inspectorOpen && (
        <aside className="hidden w-80 shrink-0 border-l border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 lg:block">
          <h2 className="mb-4 text-sm font-semibold">TUI 诊断</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-zinc-500">PID</span><span>{sessionInfo?.pid || "未知"}</span></div>
            <div className="flex justify-between gap-3"><span className="text-zinc-500">WebSocket</span><span className="truncate">/ws/tui/{sessionInfo?.id || "{uiSessionId}"}</span></div>
            <div className="flex justify-between gap-3"><span className="text-zinc-500">状态</span><span>{labelFor(tuiStateLabels, tuiState)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-zinc-500">PTY</span><span>xterm.js</span></div>
          </div>
        </aside>
      )}

      {transcript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <Card className="max-h-[85vh] w-full max-w-4xl overflow-hidden">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg">转录</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setTranscript(null)}>关闭</Button>
            </CardHeader>
            <CardContent className="grid max-h-[70vh] gap-4 overflow-y-auto md:grid-cols-2">
              <pre className="min-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-50">{transcript.rawAnsi || "（原始转录为空）"}</pre>
              <pre className="min-h-64 overflow-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">{transcript.plainText || "（纯文本转录为空）"}</pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

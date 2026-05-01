import {
  AnalyticsDay,
  AnalyticsModel,
  ConfigSchema,
  ConnectionConfig,
  CronJob,
  CronJobResponse,
  DashboardPluginResponse,
  DashboardThemeResponse,
  EnvKey,
  EnvResponse,
  GatewayError,
  HealthResponse,
  LocalDiscoverResponse,
  LogLine,
  LogParams,
  LogsResponse,
  MessageInfo,
  PluginInfo,
  ProcessInfo,
  ServerInfo,
  SessionInfo,
  SessionResponse,
  SkillInfo,
  SkillResponse,
  StatusResponse,
  SystemStatus,
  ThemeInfo,
  ToolsetInfo,
  ToolsetResponse,
  TranscriptResponse,
  UiSessionCreate,
  UiSessionInfo,
  UsageAnalytics,
  UsageAnalyticsResponse,
} from "./types";

const MOCK_DELAY = 120;

function wait(ms = MOCK_DELAY) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asArray<T>(value: unknown, keys: string[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
  }
  return [];
}

function normalizeSession(item: SessionResponse): SessionInfo {
  return {
    id: item.id,
    title: item.title || "未命名会话",
    source: item.source || item.platform || "CLI",
    platform: item.platform || item.source || "cli",
    model: item.model || "未知",
    lastActive: item.lastActive || item.last_active || new Date(0).toISOString(),
    messageCount: item.messageCount ?? item.message_count ?? 0,
    toolCalls: item.toolCallCount ?? item.toolCalls ?? item.tool_call_count ?? 0,
    tokenUsage: item.tokenCount ?? item.tokenUsage ?? item.token_count ?? 0,
    preview: item.preview || "",
    isPinned: item.isPinned || false,
    isStarred: item.isStarred || false,
    live: item.live || false,
    snippets: item.snippets,
  };
}

function normalizeStatus(raw: StatusResponse): SystemStatus {
  const gateway = raw.gateway || {};
  return {
    version: raw.version || "未知",
    releaseDate: raw.releaseDate || "未知",
    gatewayStatus: gateway.status === "running" ? "running" : gateway.status === "stopped" ? "stopped" : "unknown",
    gatewayPid: gateway.pid,
    gatewayMode: gateway.mode,
    gatewayHost: gateway.host,
    gatewayPort: gateway.port,
    sshEnabled: gateway.sshEnabled,
    sshPort: gateway.sshPort,
    connectedPlatforms: gateway.platforms || [],

    activeSessionsCount: raw.activeSessions || 0,
    recentSessions: (raw.recentSessions || []).map(normalizeSession),
    model: raw.model,
    tokenUsage: raw.tokenUsage,
    dashboardAvailable: true,
    gatewayAvailable: true,
  };
}

function normalizeAnalytics(raw: UsageAnalyticsResponse): UsageAnalytics {
  const daily = raw.daily || [];
  const models = raw.models || [];
  const summary = raw.summary || {};
  const totalTokens =
    summary.totalTokens ||
    daily.reduce((sum, item) => sum + (item.totalTokens || 0), 0);
  return {
    totalInputTokens: summary.inputTokens || daily.reduce((sum, item) => sum + (item.inputTokens || 0), 0),
    totalOutputTokens: summary.outputTokens || daily.reduce((sum, item) => sum + (item.outputTokens || 0), 0),
    totalTokens,
    cacheHitPercentage: 0,
    totalCost: summary.cost || models.reduce((sum, item) => sum + (item.cost || 0), 0),
    totalSessions: summary.sessions || 0,
    dailyAverage: daily.length ? Math.round(totalTokens / daily.length) : 0,
    dailyCharts: daily,
    dailyTable: daily,
    modelTable: models,
  };
}

function normalizeGatewayError(status: number, body: unknown, fallback: string): GatewayError {
  if (body && typeof body === "object" && "error" in body && "message" in body) {
    return { ...(body as GatewayError), status };
  }
  return {
    error: fallback,
    message: typeof body === "string" && body ? body : fallback,
    details: {},
    status,
  };
}

export class ApiClient {
  private config: ConnectionConfig | null = null;
  private isMock = (import.meta as any).env.VITE_MOCK_API === "true";

  setConfig(config: ConnectionConfig | null) {
    this.config = config;
  }

  getConfigForDebug() {
    return this.config;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (this.isMock) return this.mockRequest<T>(endpoint, options);
    if (!this.config) {
      throw normalizeGatewayError(0, null, "connection_missing");
    }

    const headers = new Headers(options.headers || {});
    if (this.config.token) {
      headers.set("Authorization", `Bearer ${this.config.token}`);
      headers.set("X-Hermes-UI-Token", this.config.token);
    }
    if (!headers.has("Content-Type") && options.method && options.method !== "GET" && options.method !== "DELETE") {
      headers.set("Content-Type", "application/json");
    }

    let response: Response;
    try {
      response = await fetch(`${this.config.apiBaseUrl}${endpoint}`, {
        ...options,
        headers,
      });
    } catch {
      throw normalizeGatewayError(0, null, "network_error");
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    let parsed: unknown = text;
    if (contentType.includes("application/json") && text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const fallback =
        response.status === 401
          ? "auth_failed"
          : response.status === 503
            ? "dashboard_unavailable"
            : response.status === 404
              ? "not_supported"
              : "api_error";
      throw normalizeGatewayError(response.status, parsed, fallback);
    }

    return (contentType.includes("application/json") ? parsed : text) as T;
  }

  private async mockRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await wait();
    const method = (options.method || "GET").toUpperCase();
    if (endpoint === "/health") return mockHealth() as T;
    if (endpoint === "/api/server/info") return mockServerInfo() as T;
    if (endpoint === "/api/local/discover") return mockDiscover() as T;
    if (endpoint === "/api/local/processes") return [{ pid: 1234, name: "hermes-gateway", uptime: 36000, status: "running" }] as T;
    if (endpoint === "/api/status") return mockStatus() as T;
    if (endpoint.startsWith("/api/sessions/search")) return { sessions: mockSessions().filter((s) => s.title.includes("Tool")) } as T;
    if (endpoint === "/api/sessions") return { sessions: mockSessions() } as T;
    if (endpoint.match(/^\/api\/sessions\/[^/]+\/messages/)) return { messages: mockMessages() } as T;
    if (endpoint.match(/^\/api\/sessions\/[^/]+/) && method === "GET") return mockSessions()[0] as T;
    if (endpoint === "/api/config/schema") return mockConfigSchema() as T;
    if (endpoint === "/api/config" || endpoint === "/api/config/defaults") return mockConfig() as T;
    if (endpoint === "/api/config/raw") return "model:\n  default: gpt-5.2\n" as T;
    if (endpoint === "/api/env") return { items: mockEnv() } as T;
    if (endpoint === "/api/logs?file=agent&lines=100&level=ALL&component=all" || endpoint.startsWith("/api/logs")) return { logs: mockLogs() } as T;
    if (endpoint.startsWith("/api/analytics/usage")) return mockAnalyticsResponse() as T;
    if (endpoint === "/api/cron/jobs") return { jobs: mockCronJobs() } as T;
    if (endpoint === "/api/skills") return { skills: mockSkills() } as T;
    if (endpoint === "/api/tools/toolsets") return { toolsets: mockToolsets() } as T;
    if (endpoint === "/api/dashboard/themes") return { active: "default", themes: mockThemes() } as T;
    if (endpoint === "/api/dashboard/plugins") return { plugins: mockPlugins() } as T;
    if (endpoint.includes("/transcript")) return { uiSessionId: "ui-mock", rawAnsi: "Hermes Fake TUI", plainText: "Hermes Fake TUI", chunks: [] } as T;
    if (endpoint === "/api/ui/sessions" && method === "GET") return [mockUiSession()] as T;
    if (endpoint.startsWith("/api/ui/sessions")) return mockUiSession() as T;
    return { status: "ok" } as T;
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.request<HealthResponse>("/health");
      return true;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  async testConnection(): Promise<HealthResponse> {
    await this.getServerInfo();
    return this.getHealth();
  }

  async getServerInfo(): Promise<ServerInfo> {
    return this.request<ServerInfo>("/api/server/info");
  }

  async discoverLocal(): Promise<LocalDiscoverResponse> {
    return this.request<LocalDiscoverResponse>("/api/local/discover");
  }

  async startLocalDashboard(): Promise<Record<string, unknown>> {
    return this.request("/api/local/start-dashboard", { method: "POST" });
  }

  async stopLocalDashboard(): Promise<Record<string, unknown>> {
    return this.request("/api/local/stop-dashboard", { method: "POST" });
  }

  async getLocalProcesses(): Promise<ProcessInfo[]> {
    return this.request<ProcessInfo[]>("/api/local/processes");
  }

  async getStatus(): Promise<SystemStatus> {
    return normalizeStatus(await this.request<StatusResponse>("/api/status"));
  }

  async getSessions(): Promise<SessionInfo[]> {
    return asArray<SessionResponse>(await this.request("/api/sessions"), ["sessions", "items"]).map(normalizeSession);
  }

  async getSession(id: string): Promise<SessionInfo> {
    return normalizeSession(await this.request<SessionResponse>(`/api/sessions/${encodeURIComponent(id)}`));
  }

  async getSessionMessages(id: string): Promise<MessageInfo[]> {
    return asArray<MessageInfo>(await this.request(`/api/sessions/${encodeURIComponent(id)}/messages`), ["messages", "items"]);
  }

  async searchSessions(q: string): Promise<SessionInfo[]> {
    const response = await this.request<{ sessions?: SessionResponse[]; items?: SessionResponse[]; snippets?: Record<string, string> }>(
      `/api/sessions/search?q=${encodeURIComponent(q)}`,
    );
    const snippets = response.snippets || {};
    return asArray<SessionResponse>(response, ["sessions", "items"]).map((session) =>
      normalizeSession({ ...session, snippets: snippets[session.id] ? [snippets[session.id]] : session.snippets }),
    );
  }

  async deleteSession(id: string): Promise<void> {
    await this.request(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async getConfig(): Promise<Record<string, unknown>> {
    return this.request("/api/config");
  }

  async getConfigDefaults(): Promise<Record<string, unknown>> {
    return this.request("/api/config/defaults");
  }

  async getConfigSchema(): Promise<ConfigSchema> {
    return this.request<ConfigSchema>("/api/config/schema");
  }

  async updateConfig(config: unknown): Promise<void> {
    await this.request("/api/config", { method: "PUT", body: JSON.stringify({ config }) });
  }

  async getConfigRaw(): Promise<string> {
    return this.request<string>("/api/config/raw");
  }

  async updateConfigRaw(raw: string): Promise<void> {
    await this.request("/api/config/raw", { method: "PUT", body: raw, headers: { "Content-Type": "text/plain" } });
  }

  async getEnv(): Promise<EnvKey[]> {
    return asArray<EnvKey>(await this.request<EnvResponse | EnvKey[]>("/api/env"), ["items", "env", "keys"]).map((item) => ({
      ...item,
      set: item.set ?? item.isConfigured ?? false,
      isConfigured: item.isConfigured ?? item.set ?? false,
    }));
  }

  async setEnv(key: string, value: string): Promise<void> {
    await this.request("/api/env", { method: "PUT", body: JSON.stringify({ key, value }) });
  }

  async deleteEnv(key: string): Promise<void> {
    await this.request(`/api/env?key=${encodeURIComponent(key)}`, { method: "DELETE" });
  }

  async revealEnv(key: string): Promise<string> {
    const response = await this.request<{ value?: string }>("/api/env/reveal", {
      method: "POST",
      body: JSON.stringify({ key }),
    });
    return response.value || "";
  }

  async getLogs(params: LogParams): Promise<LogLine[]> {
    const query = new URLSearchParams({
      file: params.file || "agent",
      lines: String(params.lines || 100),
      level: params.level || "ALL",
      component: params.component || "all",
    }).toString();
    return asArray<LogLine>(await this.request<LogsResponse | LogLine[]>(`/api/logs?${query}`), ["logs", "lines", "items"]);
  }

  async getUsageAnalytics(days: number): Promise<UsageAnalytics> {
    return normalizeAnalytics(await this.request<UsageAnalyticsResponse>(`/api/analytics/usage?days=${days}`));
  }

  async getCronJobs(): Promise<CronJob[]> {
    return asArray<CronJob>(await this.request<CronJobResponse | CronJob[]>("/api/cron/jobs"), ["jobs", "items"]);
  }

  async createCronJob(payload: { name?: string; prompt: string; schedule: string; deliver?: string }): Promise<CronJob> {
    return this.request<CronJob>("/api/cron/jobs", { method: "POST", body: JSON.stringify(payload) });
  }

  async pauseCronJob(id: string): Promise<void> {
    await this.request(`/api/cron/jobs/${encodeURIComponent(id)}/pause`, { method: "POST" });
  }

  async resumeCronJob(id: string): Promise<void> {
    await this.request(`/api/cron/jobs/${encodeURIComponent(id)}/resume`, { method: "POST" });
  }

  async triggerCronJob(id: string): Promise<void> {
    await this.request(`/api/cron/jobs/${encodeURIComponent(id)}/trigger`, { method: "POST" });
  }

  async deleteCronJob(id: string): Promise<void> {
    await this.request(`/api/cron/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async getSkills(): Promise<SkillInfo[]> {
    return asArray<SkillInfo>(await this.request<SkillResponse | SkillInfo[]>("/api/skills"), ["skills", "items"]).map((skill) => ({
      ...skill,
      id: skill.id || skill.name,
      enabled: skill.enabled ?? skill.isEnabled ?? false,
      isEnabled: skill.isEnabled ?? skill.enabled ?? false,
    }));
  }

  async toggleSkill(name: string, enabled: boolean): Promise<void> {
    await this.request("/api/skills/toggle", { method: "PUT", body: JSON.stringify({ name, enabled }) });
  }

  async getToolsets(): Promise<ToolsetInfo[]> {
    return asArray<ToolsetInfo>(await this.request<ToolsetResponse | ToolsetInfo[]>("/api/tools/toolsets"), ["toolsets", "items"]).map((toolset) => ({
      ...toolset,
      name: toolset.name || toolset.label || toolset.id,
      label: toolset.label || toolset.name || toolset.id,
      configured: toolset.configured ?? toolset.isConfigured ?? false,
      isConfigured: toolset.isConfigured ?? toolset.configured ?? false,
      setupRequirements: toolset.setupRequirements || toolset.dependencies || [],
    }));
  }

  async restartGateway(): Promise<Record<string, unknown>> {
    return this.request("/api/gateway/restart", { method: "POST" });
  }

  async getActionStatus(name: string): Promise<Record<string, unknown>> {
    return this.request(`/api/actions/${encodeURIComponent(name)}/status`);
  }

  async getDashboardThemes(): Promise<ThemeInfo[]> {
    const response = await this.request<DashboardThemeResponse | ThemeInfo[]>("/api/dashboard/themes");
    if (Array.isArray(response)) return response;
    return (response.themes || []).map((theme) => ({ ...theme, active: theme.name === response.active }));
  }

  async setDashboardTheme(name: string): Promise<void> {
    await this.request("/api/dashboard/theme", { method: "PUT", body: JSON.stringify({ name }) });
  }

  async getDashboardPlugins(): Promise<PluginInfo[]> {
    return asArray<PluginInfo>(await this.request<DashboardPluginResponse | PluginInfo[]>("/api/dashboard/plugins"), ["plugins", "items"]);
  }

  async rescanDashboardPlugins(method: "GET" | "POST" = "POST"): Promise<void> {
    await this.request("/api/dashboard/plugins/rescan", { method });
  }

  async getPluginAssetText(plugin: string, path: string): Promise<string> {
    return this.request<string>(`/dashboard-plugins/${encodeURIComponent(plugin)}/${path}`);
  }

  async getPluginData(plugin: string, path: string): Promise<Record<string, unknown>> {
    return this.request(`/api/plugins/${encodeURIComponent(plugin)}/${path}`);
  }

  async createUiSession(payload: UiSessionCreate): Promise<UiSessionInfo> {
    return this.request<UiSessionInfo>("/api/ui/sessions", { method: "POST", body: JSON.stringify(payload) });
  }

  async listUiSessions(): Promise<UiSessionInfo[]> {
    return this.request<UiSessionInfo[]>("/api/ui/sessions");
  }

  async getUiSession(id: string): Promise<UiSessionInfo> {
    return this.request<UiSessionInfo>(`/api/ui/sessions/${encodeURIComponent(id)}`);
  }

  async updateUiSession(id: string, patch: Partial<UiSessionInfo>): Promise<UiSessionInfo> {
    return this.request<UiSessionInfo>(`/api/ui/sessions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  }

  async deleteUiSession(id: string): Promise<void> {
    await this.request(`/api/ui/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async getUiSessionTranscript(id: string): Promise<TranscriptResponse> {
    return this.request<TranscriptResponse>(`/api/ui/sessions/${encodeURIComponent(id)}/transcript`);
  }

  getWsBaseUrl(): string {
    return this.config?.wsBaseUrl || "";
  }

  getToken(): string | undefined {
    return this.config?.token;
  }
}

function mockHealth(): HealthResponse {
  return {
    ok: true,
    gateway: "running",
    mode: "local",
    localMode: true,
    hermesDashboard: "available",
    hermesCommandAvailable: true,
    ptySupported: true,
    nativeWindowsExperimental: false,
    sshEnabled: true,
    sshPort: 2222,
    version: "0.1.0",
    time: new Date().toISOString(),
    message: "Gateway 正在运行",
  };
}

function mockServerInfo(): ServerInfo {
  return {
    serverName: "Hermes UI Gateway",
    mode: "local",
    os: "darwin",
    platform: "mock",
    python: "3.12",
    hermesCommand: "hermes",
    dashboardUrl: "http://127.0.0.1:9119",
    gatewayUrl: "http://127.0.0.1:9788",
    ptySupported: true,
    nativeWindowsExperimental: false,
    sshEnabled: true,
    sshPort: 2222,
    wslDetected: false,
  };
}

function mockDiscover(): LocalDiscoverResponse {
  return {
    mode: "local",
    gateway: { available: true, url: "http://127.0.0.1:9788" },
    dashboard: { available: true, url: "http://127.0.0.1:9119" },
    hermesCommand: { available: true, path: "/usr/local/bin/hermes", version: "fake" },
    pty: { available: true, kind: "posix", message: "PTY/TUI 可用。" },
    node: { available: true, version: "22" },
    suggestedCommands: [
      "hermes dashboard --host 127.0.0.1 --port 9119 --no-open",
      "uvicorn app.main:app --host 127.0.0.1 --port 9788",
    ],
  };
}

function mockStatus(): StatusResponse {
  return {
    version: "fake-0.0.1",
    releaseDate: "2026-04-01",
    gateway: {
      status: "running",
      pid: 12345,
      mode: "local",
      host: "127.0.0.1",
      port: 9788,
      platforms: [
        { name: "cli", state: "connected", configured: true },
        { name: "telegram", state: "disconnected", configured: false },
      ],
    },
    activeSessions: 1,
    recentSessions: mockSessions(),
  };
}

function mockSessions(): SessionResponse[] {
  return [
    { id: "session-live", title: "在线规划会话", source: "TUI", platform: "cli", model: "gpt-5.2", messageCount: 6, toolCallCount: 2, tokenCount: 9240, lastActive: new Date().toISOString(), preview: "检查 Dashboard 功能对齐。", live: true },
    { id: "session-tools", title: "工具自动化会话", source: "Telegram", platform: "telegram", model: "gpt-5.4", messageCount: 9, toolCallCount: 4, tokenCount: 15120, lastActive: new Date().toISOString(), preview: "收集日志并重启网关。", live: false },
    { id: "session-docs", title: "文档整理", source: "CLI", platform: "cli", model: "gpt-5.4-mini", messageCount: 4, toolCallCount: 0, tokenCount: 4200, lastActive: new Date().toISOString(), preview: "补充本机与局域网模式文档。", live: false },
  ];
}

function mockMessages(): MessageInfo[] {
  return [
    { id: "m1", role: "user", content: "检查状态", timestamp: new Date().toISOString() },
    { id: "m2", role: "assistant", content: "Gateway 正在运行。", timestamp: new Date().toISOString(), tool_calls: [{ function: { name: "get_status", arguments: "{}" } }] },
  ];
}

function mockConfig(): Record<string, unknown> {
  return {
    model: { provider: "openai", default: "gpt-5.2" },
    terminal: { backend: "pty", scrollback: 5000 },
    display: { theme: "default", tui_colors: true },
    agent: { max_iterations: 12 },
    delegation: { enabled: true },
    memory: { enabled: false },
    approvals: { dangerous_actions: "ask" },
    dashboard: { theme: "default" },
  };
}

function mockConfigSchema(): ConfigSchema {
  return {
    type: "object",
    properties: {
      model: { type: "object", properties: { provider: { type: "string", enum: ["openai", "anthropic"] }, default: { type: "string" } } },
      terminal: { type: "object", properties: { backend: { type: "string", enum: ["pty", "pipe"] }, scrollback: { type: "number" } } },
      display: { type: "object", properties: { theme: { type: "string", enum: ["default", "midnight"] }, tui_colors: { type: "boolean" } } },
      approvals: { type: "object", properties: { dangerous_actions: { type: "string", enum: ["ask", "deny", "allow"] } } },
    },
  };
}

function mockEnv(): EnvKey[] {
  return [
    { key: "OPENAI_API_KEY", category: "LLM Providers", set: true, isConfigured: true, redacted: "sk-...1234", description: "OpenAI API 密钥" },
    { key: "GITHUB_TOKEN", category: "Tool API Keys", set: true, isConfigured: true, redacted: "ghp_...abcd" },
    { key: "TELEGRAM_BOT_TOKEN", category: "Messaging Platforms", set: false, isConfigured: false },
  ];
}

function mockLogs(): LogLine[] {
  return [
    { timestamp: new Date().toISOString(), level: "INFO", component: "agent", message: "智能体已启动" },
    { timestamp: new Date().toISOString(), level: "WARNING", component: "gateway", message: "Dashboard 延迟偏高" },
    { timestamp: new Date().toISOString(), level: "ERROR", component: "telegram", message: "Token 缺失" },
    { timestamp: new Date().toISOString(), level: "DEBUG", component: "pty", message: "调整尺寸 120x32" },
  ];
}

function mockAnalyticsResponse(): UsageAnalyticsResponse {
  const daily: AnalyticsDay[] = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-04-${String(i + 1).padStart(2, "0")}`,
    inputTokens: (i + 1) * 100,
    outputTokens: (i + 1) * 80,
    totalTokens: (i + 1) * 180,
    cost: (i + 1) / 100,
  }));
  const models: AnalyticsModel[] = [
    { model: "gpt-5.2", inputTokens: 1600, outputTokens: 1200, totalTokens: 2800, cost: 0.18 },
    { model: "gpt-5.4-mini", inputTokens: 1200, outputTokens: 1040, totalTokens: 2240, cost: 0.1 },
  ];
  return { summary: { inputTokens: 2800, outputTokens: 2240, totalTokens: 5040, cost: 0.28, sessions: 3 }, daily, models };
}

function mockCronJobs(): CronJob[] {
  return [
    { id: "job-enabled", name: "早晨摘要", prompt: "总结", schedule: "0 9 * * *", state: "enabled", nextRun: new Date().toISOString() },
    { id: "job-paused", name: "每周清理", prompt: "清理", schedule: "0 10 * * 1", state: "paused" },
    { id: "job-error", name: "异常任务", prompt: "失败", schedule: "bad cron", state: "error" },
  ];
}

function mockSkills(): SkillInfo[] {
  return [
    { id: "code-review", name: "code-review", description: "检查代码", category: "工程", enabled: true, source: "内置" },
    { id: "docs", name: "docs", description: "编写文档", category: "写作", enabled: true, source: "内置" },
    { id: "deploy", name: "deploy", description: "部署服务", category: "运维", enabled: false, source: "用户" },
  ];
}

function mockToolsets(): ToolsetInfo[] {
  return [
    { id: "core", name: "核心", description: "核心工具", tools: ["read", "write"], active: true, configured: true },
    { id: "github", name: "GitHub", description: "GitHub 工具", tools: ["issues", "pulls"], active: false, configured: false, setupRequirements: ["GITHUB_TOKEN"] },
  ];
}

function mockThemes(): ThemeInfo[] {
  return [
    { name: "default", label: "Hermes 青绿", description: "默认 Hermes 青绿主题", active: true },
    { name: "midnight", label: "午夜", description: "低对比度深色主题" },
    { name: "ember", label: "余烬", description: "暖色深色主题" },
    { name: "mono", label: "单色", description: "单色主题" },
    { name: "cyberpunk", label: "赛博朋克", description: "高对比霓虹主题" },
    { name: "rose", label: "玫瑰", description: "玫瑰强调色主题" },
  ];
}

function mockPlugins(): PluginInfo[] {
  return [
    { id: "demo-plugin", name: "demo-plugin", label: "演示插件", description: "标签页插件", version: "1.0.0", source: "用户", status: "active", tabs: [{ id: "demo", label: "演示", hidden: false }], slots: [{ name: "sessions:top", component: "DemoSessionsTop" }], manifest: { name: "demo-plugin" } },
    { id: "slot-only", name: "slot-only", label: "仅插槽", description: "仅插槽插件", version: "1.0.0", source: "用户", status: "active", tabs: [{ id: "hidden", label: "隐藏", hidden: true }], slots: [{ name: "chat:bottom", component: "SlotOnlyFooter" }], manifest: { name: "slot-only" } },
  ];
}

function mockUiSession(): UiSessionInfo {
  return {
    id: "ui-mock",
    title: "模拟 TUI",
    status: "running",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    continueLatest: false,
    pinned: false,
    favorite: false,
    archived: false,
    pid: 12345,
  };
}

export const api = new ApiClient();

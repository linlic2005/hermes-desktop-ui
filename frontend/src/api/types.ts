export type ConnectionMode = "local" | "remote" | "advanced";

export interface ConnectionConfig {
  id: string;
  name: string;
  mode: ConnectionMode;
  apiBaseUrl: string;
  wsBaseUrl: string;
  dashboardUrl?: string;
  token?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "local_connected"
  | "local_gateway_missing"
  | "local_dashboard_missing"
  | "remote_connected"
  | "remote_unreachable"
  | "auth_failed"
  | "ws_failed"
  | "dashboard_unavailable"
  | "hermes_command_missing"
  | "unknown_error";

export interface GatewayError {
  error: string;
  message: string;
  details: Record<string, unknown>;
  status?: number;
}

export interface HealthResponse {
  ok: boolean;
  gateway: string;
  mode: "local" | "remote-server";
  localMode: boolean;
  hermesDashboard: string;
  hermesCommandAvailable: boolean;
  ptySupported: boolean;
  nativeWindowsExperimental: boolean;
  version: string;
  time: string;
  message: string;
}

export interface ServerInfoResponse {
  serverName: string;
  mode: "local" | "remote-server";
  os: string;
  platform: string;
  python: string;
  hermesCommand: string;
  dashboardUrl: string;
  gatewayUrl: string;
  ptySupported: boolean;
  nativeWindowsExperimental: boolean;
  wslDetected: boolean;
}

export interface ServerInfo extends ServerInfoResponse {}

export interface PlatformState {
  name: string;
  state: "connected" | "disconnected" | "error" | string;
  lastActivity?: string;
  configured: boolean;
}

export interface StatusResponse {
  version: string;
  releaseDate?: string;
  gateway?: {
    status?: string;
    pid?: number;
    mode?: string;
    host?: string;
    port?: number;
    platforms?: PlatformState[];
  };
  activeSessions?: number;
  recentSessions?: SessionResponse[];
  model?: string;
  tokenUsage?: number;
}

export interface SystemStatus {
  version: string;
  releaseDate: string;
  gatewayStatus: "running" | "stopped" | "unknown";
  gatewayPid?: number;
  gatewayMode?: string;
  gatewayHost?: string;
  gatewayPort?: number;
  connectedPlatforms: PlatformState[];
  activeSessionsCount: number;
  recentSessions: SessionInfo[];
  model?: string;
  tokenUsage?: number;
  dashboardAvailable?: boolean;
  gatewayAvailable?: boolean;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  uptime: number;
  status?: string;
  command?: string;
  uiSessionId?: string;
}

export interface LocalDiscoverResponse {
  mode: string;
  gateway: { available: boolean; url: string };
  dashboard: { available: boolean; url: string };
  hermesCommand: { available: boolean; path?: string | null; version?: string | null };
  pty: { available: boolean; kind: string; message: string };
  node: { available: boolean; version?: string | null };
  suggestedCommands: string[];
}

export interface SessionResponse {
  id: string;
  title?: string;
  source?: string;
  platform?: string;
  model?: string;
  lastActive?: string;
  last_active?: string;
  messageCount?: number;
  message_count?: number;
  toolCallCount?: number;
  toolCalls?: number;
  tool_call_count?: number;
  tokenCount?: number;
  tokenUsage?: number;
  token_count?: number;
  preview?: string;
  live?: boolean;
  isPinned?: boolean;
  isStarred?: boolean;
  snippets?: string[];
}

export interface SessionInfo {
  id: string;
  title: string;
  source: string;
  platform: string;
  model: string;
  lastActive: string;
  messageCount: number;
  toolCalls: number;
  tokenUsage: number;
  preview: string;
  isPinned: boolean;
  isStarred: boolean;
  live: boolean;
  snippets?: string[];
}

export interface MessageInfo {
  id: string;
  role: "user" | "assistant" | "system" | "tool" | string;
  content: string;
  timestamp: string;
  tool_calls?: unknown[];
  toolCalls?: unknown[];
  tokens?: number;
}

export interface ConfigSchemaResponse {
  type?: string;
  properties: Record<string, unknown>;
}

export interface ConfigSchema extends ConfigSchemaResponse {}

export interface EnvResponse {
  items?: EnvKey[];
  env?: EnvKey[];
  keys?: EnvKey[];
}

export interface EnvKey {
  key: string;
  category: "LLM Providers" | "Tool API Keys" | "Messaging Platforms" | "Agent Settings" | "Advanced" | string;
  description?: string;
  link?: string;
  set?: boolean;
  isConfigured?: boolean;
  redacted?: string | null;
  source?: string;
}

export interface LogParams {
  file?: "agent" | "errors" | "gateway";
  lines?: number;
  level?: "ALL" | "DEBUG" | "INFO" | "WARNING" | "ERROR";
  component?: string;
}

export interface LogsResponse {
  logs?: LogLine[];
  lines?: LogLine[];
  items?: LogLine[];
}

export interface LogLine {
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "WARN" | string;
  component?: string;
  module?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface UsageAnalyticsResponse {
  summary?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cost?: number;
    sessions?: number;
  };
  daily?: AnalyticsDay[];
  models?: AnalyticsModel[];
}

export interface UsageAnalytics {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  cacheHitPercentage: number;
  totalCost: number;
  totalSessions: number;
  dailyAverage: number;
  dailyCharts: AnalyticsDay[];
  dailyTable: AnalyticsDay[];
  modelTable: AnalyticsModel[];
}

export interface AnalyticsDay {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost?: number;
}

export interface AnalyticsModel {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost?: number;
}

export interface CronJobResponse {
  jobs?: CronJob[];
  items?: CronJob[];
}

export interface CronJob {
  id: string;
  name?: string;
  prompt: string;
  schedule?: string;
  expression?: string;
  target?: string;
  deliver?: string;
  state: "enabled" | "paused" | "error" | string;
  lastRun?: string;
  nextRun?: string;
}

export interface SkillResponse {
  skills?: SkillInfo[];
  items?: SkillInfo[];
}

export interface SkillInfo {
  id?: string;
  name: string;
  description: string;
  category: string;
  enabled?: boolean;
  isEnabled?: boolean;
  source?: "bundled" | "user" | "optional" | "registry" | string;
  path?: string;
  dependencies?: string[];
}

export interface ToolsetResponse {
  toolsets?: ToolsetInfo[];
  items?: ToolsetInfo[];
}

export interface ToolsetInfo {
  id: string;
  name?: string;
  label?: string;
  description: string;
  tools: string[];
  active?: boolean;
  configured?: boolean;
  isConfigured?: boolean;
  setupRequirements?: string[];
  dependencies?: string[];
}

export interface DashboardThemeResponse {
  active?: string;
  themes?: ThemeInfo[];
}

export interface ThemeInfo {
  name: string;
  label: string;
  description: string;
  palette?: Record<string, string>;
  definition?: unknown;
  active?: boolean;
}

export interface PluginSlotInfo {
  name: string;
  component?: string;
}

export interface DashboardPluginResponse {
  plugins?: PluginInfo[];
  items?: PluginInfo[];
}

export interface PluginInfo {
  id?: string;
  name: string;
  label?: string;
  description?: string;
  icon?: string;
  version?: string;
  source?: "user" | "bundled" | "project" | string;
  status?: "active" | "error" | string;
  slots?: PluginSlotInfo[];
  tabs?: Array<{ id?: string; label?: string; hidden?: boolean; override?: boolean; path?: string }>;
  manifest?: unknown;
}

export interface UiSessionCreate {
  title?: string;
  cwd?: string;
  profile?: string;
  model?: string;
  pinned?: boolean;
  favorite?: boolean;
  resumeOfficialSessionId?: string;
  continueLatest?: boolean;
}

export interface UiSessionResponse {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  status: "created" | "starting" | "ready" | "thinking" | "running" | "interrupted" | "exited" | "error" | "archived" | string;
  cwd?: string | null;
  profile?: string | null;
  model?: string | null;
  hermesSessionId?: string | null;
  resumeOfficialSessionId?: string | null;
  continueLatest: boolean;
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  pid?: number | null;
  exitCode?: number | null;
  preview?: string | null;
}

export interface UiSessionInfo extends Partial<UiSessionResponse> {
  id: string;
  status: UiSessionResponse["status"];
}

export interface TranscriptResponse {
  uiSessionId: string;
  rawAnsi: string;
  plainText: string;
  chunks: Array<{
    id: string;
    createdAt: string;
    chunkIndex: number;
    rawAnsi: string;
    plainText: string;
  }>;
}

export type TuiWsMessage =
  | { type: "status"; state: string; message: string }
  | { type: "session"; uiSessionId: string; pid: number; hermesSessionId?: string | null }
  | { type: "output"; data: string };

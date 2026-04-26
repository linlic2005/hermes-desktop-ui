export const connectionModeLabels: Record<string, string> = {
  local: "本机",
  "remote-server": "局域网服务器",
  remote: "局域网",
  advanced: "高级",
};

export const connectionStatusLabels: Record<string, string> = {
  disconnected: "未连接",
  connecting: "连接中",
  local_connected: "本机已连接",
  remote_connected: "局域网已连接",
  error: "连接异常",
};

export const themeLabels: Record<string, string> = {
  light: "浅色",
  dark: "深色",
  system: "跟随系统",
};

export const tuiStateLabels: Record<string, string> = {
  starting: "启动中",
  ready: "就绪",
  running: "运行中",
  interrupted: "已中断",
  exited: "已退出",
  error: "异常",
};

export const stateLabels: Record<string, string> = {
  active: "已启用",
  inactive: "未启用",
  connected: "已连接",
  disconnected: "未连接",
  configured: "已配置",
  enabled: "已启用",
  disabled: "已禁用",
  error: "异常",
  local: "本机",
  paused: "已暂停",
  running: "运行中",
  stopped: "已停止",
  unknown: "未知",
};

export function labelFor(labels: Record<string, string>, value: string | undefined | null, fallback = "未知") {
  if (!value) return fallback;
  return labels[value] || value;
}

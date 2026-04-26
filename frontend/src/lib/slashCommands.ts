export interface SlashCommandDef {
  name: string;
  alias?: string[];
  description: string;
  category: "Session" | "Configuration" | "Tools & Skills" | "Info" | "Exit" | "Dynamic";
}

export const slashCommands: SlashCommandDef[] = [
  // Session
  { name: "/new", alias: ["/reset"], description: "Start a new session", category: "Session" },
  { name: "/clear", description: "Clear screen and start a new session", category: "Session" },
  { name: "/history", description: "Show conversation history", category: "Session" },
  { name: "/save", description: "Save current conversation", category: "Session" },
  { name: "/retry", description: "Retry last message", category: "Session" },
  { name: "/undo", description: "Remove last user/assistant exchange", category: "Session" },
  { name: "/title", description: "Set session title", category: "Session" },
  { name: "/compress", description: "Compress conversation context", category: "Session" },
  { name: "/rollback", description: "List or restore checkpoints", category: "Session" },
  { name: "/snapshot", alias: ["/snap"], description: "Create or restore config/state snapshots", category: "Session" },
  { name: "/stop", description: "Kill running background processes", category: "Session" },
  { name: "/queue", alias: ["/q"], description: "Queue prompt for next turn", category: "Session" },
  { name: "/resume", description: "Resume named session", category: "Session" },
  { name: "/status", description: "Show session info", category: "Session" },
  { name: "/agents", alias: ["/tasks"], description: "Show active agents and running tasks", category: "Session" },
  { name: "/background", alias: ["/bg"], description: "Run prompt in background session", category: "Session" },
  { name: "/btw", description: "Ephemeral side question", category: "Session" },
  { name: "/branch", alias: ["/fork"], description: "Branch current session", category: "Session" },

  // Configuration
  { name: "/config", description: "Show current configuration", category: "Configuration" },
  { name: "/model", description: "Show or change current model", category: "Configuration" },
  { name: "/personality", description: "Set personality", category: "Configuration" },
  { name: "/verbose", description: "Cycle tool progress display", category: "Configuration" },
  { name: "/fast", description: "Toggle fast mode", category: "Configuration" },
  { name: "/reasoning", description: "Manage reasoning effort/display", category: "Configuration" },
  { name: "/skin", description: "Show or change display skin/theme", category: "Configuration" },
  { name: "/statusbar", alias: ["/sb"], description: "Toggle status bar", category: "Configuration" },
  { name: "/voice", description: "Toggle CLI voice mode", category: "Configuration" },
  { name: "/yolo", description: "Toggle YOLO mode", category: "Configuration" },

  // Tools & Skills
  { name: "/tools", description: "Manage tools", category: "Tools & Skills" },
  { name: "/toolsets", description: "List toolsets", category: "Tools & Skills" },
  { name: "/browser", description: "Manage local Chrome CDP connection", category: "Tools & Skills" },
  { name: "/skills", description: "Search/install/inspect/manage skills", category: "Tools & Skills" },
  { name: "/cron", description: "Manage scheduled tasks", category: "Tools & Skills" },
  { name: "/reload-mcp", alias: ["/reload_mcp"], description: "Reload MCP servers", category: "Tools & Skills" },
  { name: "/reload", description: "Reload .env variables", category: "Tools & Skills" },
  { name: "/plugins", description: "List installed plugins", category: "Tools & Skills" },

  // Info
  { name: "/help", description: "Show help", category: "Info" },
  { name: "/usage", description: "Show token usage and cost", category: "Info" },
  { name: "/insights", description: "Show usage insights", category: "Info" },
  { name: "/platforms", alias: ["/gateway"], description: "Show gateway/platform status", category: "Info" },
  { name: "/paste", description: "Attach clipboard image", category: "Info" },
  { name: "/copy", description: "Copy assistant response", category: "Info" },
  { name: "/image", description: "Attach local image", category: "Info" },
  { name: "/terminal-setup", description: "Configure VS Code/Cursor/Windsurf terminal bindings", category: "Info" },
  { name: "/debug", description: "Upload debug report", category: "Info" },
  { name: "/profile", description: "Show active profile/home", category: "Info" },
  { name: "/gquota", description: "Show Gemini Code Assist quota", category: "Info" },

  // Exit
  { name: "/quit", description: "Exit Hermes", category: "Exit" },
  { name: "/exit", description: "Exit Hermes", category: "Exit" },
];

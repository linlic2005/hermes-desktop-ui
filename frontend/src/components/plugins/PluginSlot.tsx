import React from "react";

export type PluginSlotName = 
  | "backdrop"
  | "header-left"
  | "header-right"
  | "header-banner"
  | "sidebar"
  | "pre-main"
  | "post-main"
  | "footer-left"
  | "footer-right"
  | "overlay"
  | "sessions:top"
  | "sessions:bottom"
  | "analytics:top"
  | "analytics:bottom"
  | "logs:top"
  | "logs:bottom"
  | "cron:top"
  | "cron:bottom"
  | "skills:top"
  | "skills:bottom"
  | "config:top"
  | "config:bottom"
  | "env:top"
  | "env:bottom"
  | "docs:top"
  | "docs:bottom"
  | "chat:top"
  | "chat:bottom";

interface PluginSlotProps {
  name: PluginSlotName;
}

export const PluginSlot: React.FC<PluginSlotProps> = ({ name }) => {
  // If we had a plugin system, we would query registered plugins for this slot
  // and render them here. For now, we return null.
  return null;
};

import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";
import { useThemeStore } from "../../store/themeStore";

interface TerminalComponentProps {
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  termRef: React.MutableRefObject<Terminal | null>;
  onReady?: () => void;
}

export const TerminalComponent: React.FC<TerminalComponentProps> = ({ onData, onResize, termRef, onReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { theme } = useThemeStore();

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      scrollback: 5000,
      theme: {
        background: theme === "light" ? "#f4f4f5" : "#09090b", // zinc-100 / zinc-950
        foreground: theme === "light" ? "#18181b" : "#fafafa", // zinc-900 / zinc-50
        cursor: theme === "light" ? "#18181b" : "#fafafa",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(containerRef.current);
    setTimeout(() => {
      if (termRef.current?.element && containerRef.current?.clientWidth && containerRef.current?.clientHeight) {
         try { 
             const dims = fitAddon.proposeDimensions();
             if (dims) {
                fitAddon.fit();
             }
         } catch (e) {}
      }
    }, 10);

    termRef.current = term;
    fitAddonRef.current = fitAddon;
    onReady?.();

    term.onData((data) => {
      onData(data);
    });
    
    term.onResize(({ cols, rows }) => {
      onResize(cols, rows);
    });

    const resizeObserver = new ResizeObserver(() => {
      // Debounce fit slightly
      requestAnimationFrame(() => {
        if (fitAddonRef.current && termRef.current?.element && containerRef.current?.clientWidth && containerRef.current?.clientHeight) {
          try {
             const dims = fitAddonRef.current.proposeDimensions();
             if (dims) {
                fitAddonRef.current.fit();
             }
          } catch (e) {
             // Ignore sizing errors when invisible
          }
        }
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, []); // Run once on mount

  // Sync theme
  useEffect(() => {
    if (!termRef.current) return;
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    termRef.current.options.theme = {
      background: isDark ? "#09090b" : "#f4f4f5",
      foreground: isDark ? "#fafafa" : "#18181b",
      cursor: isDark ? "#fafafa" : "#18181b",
    };
  }, [theme]);

  // Support Ctrl+C (it is sent as \x03 by xterm onData, but we can explicitly catch it if needed, xterm handles standard keys correctly)

  return (
    <div className="w-full h-full relative p-2 bg-zinc-100 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

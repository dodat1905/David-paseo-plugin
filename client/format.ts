import type { PluginTheme } from "@getpaseo/plugin";
import { Platform, type TextStyle } from "react-native";
import type { BackgroundTask, BackgroundTaskStatus } from "../shared/background-tasks";

export const MONOSPACE_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "ui-monospace, SFMono-Regular, Menlo, monospace",
});

export const WRAPPING_TEXT: TextStyle =
  Platform.OS === "web" ? ({ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" } as TextStyle) : {};

export function statusColor(theme: PluginTheme, status: BackgroundTaskStatus): string {
  switch (status) {
    case "running":
      return theme.colors.accent;
    case "completed":
      return theme.colors.statusSuccess;
    case "failed":
      return theme.colors.statusDanger;
    case "killed":
    case "stale":
      return theme.colors.statusWarning;
  }
}

export function statusLabel(task: Pick<BackgroundTask, "status" | "exitCode">): string {
  switch (task.status) {
    case "running":
      return "running";
    case "completed":
      return "done";
    case "failed":
      return task.exitCode === null ? "failed" : `failed (exit ${task.exitCode})`;
    case "killed":
      return "stopped";
    case "stale":
      return "lost";
  }
}

export function formatDuration(fromIso: string, toIso: string | null, now: number): string {
  const seconds = Math.max(0, Math.round(((toIso ? Date.parse(toIso) : now) - Date.parse(fromIso)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "no output file";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function taskTitle(task: Pick<BackgroundTask, "description" | "command">): string {
  return task.description ?? task.command.split("\n")[0];
}

import type { PluginTimelineItemProps, PluginTimelineTransformerContribution } from "@getpaseo/plugin/client";
import { Icon, ScrollView } from "@getpaseo/plugin/client/react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  backgroundTaskIdFrom,
  SHELL_CARD_KIND,
  SHELL_CARD_VERSION,
  type ShellCardData,
} from "../shared/shell-card";
import { useBackgroundTasks } from "./background-tasks-query";
import { MONOSPACE_FONT, statusColor, statusLabel, WRAPPING_TEXT } from "./format";

const BODY_MAX_HEIGHT = 420;
const HOST_SPACING_OFFSET = -6;

type ToolCallTransform =PluginTimelineTransformerContribution<"tool_call">["transform"];

function errorText(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export const transformShellToolCall: ToolCallTransform = ({ item }) => {
  if (item.detail.type !== "shell") return;
  const output = item.detail.output ?? null;
  const data: ShellCardData = {
    command: item.detail.command,
    cwd: item.detail.cwd ?? null,
    output,
    exitCode: item.detail.exitCode ?? null,
    status: item.status,
    error: errorText(item.error),
    backgroundTaskId: backgroundTaskIdFrom(output),
  };
  return { items: [{ type: "plugin", kind: SHELL_CARD_KIND, version: SHELL_CARD_VERSION, data }] };
};

function BackgroundBadge({ agentId, taskId, theme }: { agentId: string; taskId: string; theme: PluginTheme }) {
  const { data } = useBackgroundTasks(agentId, { watchTaskId: taskId });
  const task = data?.find((candidate) => candidate.id === taskId);
  const color = task ? statusColor(theme, task.status) : theme.colors.foregroundMuted;
  const label = task ? `background · ${statusLabel(task)}` : "background";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function ShellCard({ item, theme, agentId }: PluginTimelineItemProps<ShellCardData>) {
  const [expanded, setExpanded] = useState(false);
  const data = item.data;
  const failed = data.status === "failed" || (data.exitCode !== null && data.exitCode !== 0);
  const styles = useMemo(
    () => ({
      card: {
        borderRadius: 10,
        borderWidth: expanded ? 1 : 0,
        borderColor: theme.colors.border,
        backgroundColor: expanded ? theme.colors.surface1 : "transparent",
        overflow: "hidden" as const,
        marginVertical: HOST_SPACING_OFFSET,
      },
      header: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        paddingHorizontal: expanded ? 12 : 0,
        paddingVertical: expanded ? 8 : 4,
      },
      label: { color: theme.colors.foreground, fontWeight: "500" as const },
      summary: { color: theme.colors.foregroundMuted, flex: 1, minWidth: 0 },
      body: {
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        maxHeight: BODY_MAX_HEIGHT,
      },
      bodyContent: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        gap: 10,
      },
      code: {
        color: theme.colors.foreground,
        fontFamily: MONOSPACE_FONT,
        fontSize: 13,
        lineHeight: 19,
        ...WRAPPING_TEXT,
      },
      prompt: { color: theme.colors.foregroundMuted },
      meta: { color: theme.colors.foregroundMuted, fontSize: 12 },
      error: { color: theme.colors.statusDanger, fontFamily: MONOSPACE_FONT, fontSize: 12, ...WRAPPING_TEXT },
    }),
    [theme, expanded],
  );
  const firstLine = data.command.split("\n")[0];
  const statusText =
    data.status === "running" ? "running" : failed ? `exit ${data.exitCode ?? "error"}` : data.status === "canceled" ? "canceled" : null;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? "Collapse" : "Expand"} shell command ${firstLine}`}
        onPress={() => setExpanded((value) => !value)}
        style={styles.header}
      >
        <Icon name={expanded ? "ChevronDown" : "ChevronRight"} size={16} color={theme.colors.foregroundMuted} />
        <Text style={styles.label}>Shell</Text>
        <Text style={styles.summary} numberOfLines={1}>
          {firstLine}
        </Text>
        {data.backgroundTaskId ? (
          <BackgroundBadge agentId={agentId} taskId={data.backgroundTaskId} theme={theme} />
        ) : statusText ? (
          <Text style={{ color: failed ? theme.colors.statusDanger : theme.colors.foregroundMuted, fontSize: 12 }}>
            {statusText}
          </Text>
        ) : null}
      </Pressable>
      {expanded ? (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} nestedScrollEnabled>
          <Text selectable style={styles.code}>
            <Text style={styles.prompt}>$ </Text>
            {data.command}
          </Text>
          {data.output ? (
            <Text selectable style={styles.code}>
              {data.output}
            </Text>
          ) : null}
          {data.error ? (
            <Text selectable style={styles.error}>
              {data.error}
            </Text>
          ) : null}
          {data.cwd || data.exitCode !== null ? (
            <Text style={styles.meta}>
              {[data.cwd ? `cwd ${data.cwd}` : null, data.exitCode !== null ? `exit ${data.exitCode}` : null]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}

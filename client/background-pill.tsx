import type {
  PluginButtonContentProps,
  PluginButtonRegistration,
  PluginClientContext,
} from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { copyText } from "@getpaseo/plugin/client/react-native";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { BackgroundTask } from "../shared/background-tasks";
import { listBackgroundTasksRpc, readBackgroundTaskOutputRpc } from "../shared/background-tasks";
import { BACKGROUND_POLL_MS, useBackgroundTasks } from "./background-tasks-query";
import {
  formatBytes,
  formatDuration,
  MONOSPACE_FONT,
  statusColor,
  statusLabel,
  taskTitle,
  WRAPPING_TEXT,
} from "./format";

const OUTPUT_TAIL_BYTES = 16 * 1024;
const RECENT_FINISH_MS = 10 * 60 * 1000;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function TaskOutput({ agentId, task, props }: { agentId: string; task: BackgroundTask; props: PluginButtonContentProps }) {
  const readOutput = useRpc(readBackgroundTaskOutputRpc);
  const { theme } = props;
  const output = useQuery({
    queryKey: ["background-task-output", agentId, task.id],
    queryFn: () => readOutput({ agentId, taskId: task.id, tailBytes: OUTPUT_TAIL_BYTES }),
    refetchInterval: task.status === "running" ? BACKGROUND_POLL_MS : false,
  });
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
  if (output.isPending) return <Text style={muted}>Loading output…</Text>;
  if (output.isError) return <Text style={{ color: theme.colors.statusDanger, fontSize: 12 }}>{output.error.message}</Text>;
  return (
    <View style={{ gap: 6 }}>
      {output.data.truncated ? (
        <Text style={muted}>
          Last {formatBytes(OUTPUT_TAIL_BYTES)} of {formatBytes(output.data.totalBytes)}
        </Text>
      ) : null}
      <Text
        selectable
        style={{ color: theme.colors.foreground, fontFamily: MONOSPACE_FONT, fontSize: 12, lineHeight: 17, ...WRAPPING_TEXT }}
      >
        {output.data.text || "(no output yet)"}
      </Text>
    </View>
  );
}

function TaskRow({
  agentId,
  task,
  now,
  props,
}: {
  agentId: string;
  task: BackgroundTask;
  now: number;
  props: PluginButtonContentProps;
}) {
  const [open, setOpen] = useState(false);
  const { theme } = props;
  const color = statusColor(theme, task.status);
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
  return (
    <View style={{ gap: 8, paddingVertical: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${open ? "Hide" : "Show"} output of ${taskTitle(task)}`}
        onPress={() => setOpen((value) => !value)}
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ color: theme.colors.foreground, flex: 1, minWidth: 0, fontSize: 13 }} numberOfLines={open ? undefined : 1}>
          {taskTitle(task)}
        </Text>
        <Text style={muted}>{formatDuration(task.startedAt, task.endedAt, now)}</Text>
      </Pressable>
      {open ? (
        <View style={{ gap: 8, paddingLeft: 15 }}>
          <Text style={muted}>
            {task.id} · <Text style={{ color }}>{statusLabel(task)}</Text> · {formatBytes(task.outputBytes)}
          </Text>
          <Text selectable style={{ ...muted, fontFamily: MONOSPACE_FONT, ...WRAPPING_TEXT }}>
            $ {task.command}
          </Text>
          {task.outputPath ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy output file path"
              onPress={() => void copyText(task.outputPath ?? "")}
            >
              <Text style={{ color: theme.colors.accent, fontSize: 12 }}>Copy output path</Text>
            </Pressable>
          ) : null}
          <TaskOutput agentId={agentId} task={task} props={props} />
        </View>
      ) : null}
    </View>
  );
}

function TaskSection({
  title,
  tasks,
  agentId,
  now,
  props,
}: {
  title: string;
  tasks: BackgroundTask[];
  agentId: string;
  now: number;
  props: PluginButtonContentProps;
}) {
  if (tasks.length === 0) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: props.theme.colors.foregroundMuted, fontSize: 11, fontWeight: "600", marginTop: 8 }}>
        {title.toUpperCase()} · {tasks.length}
      </Text>
      {tasks.map((task) => (
        <TaskRow key={task.id} agentId={agentId} task={task} now={now} props={props} />
      ))}
    </View>
  );
}

export function BackgroundTasksPopover(props: PluginButtonContentProps) {
  const agentId = props.context === "agent" ? props.agentId : "";
  const { theme } = props;
  const tasks = useBackgroundTasks(agentId, { pollAlways: true });
  const now = useNow(1000);
  const running = tasks.data?.filter((task) => task.status === "running") ?? [];
  const finished = tasks.data?.filter((task) => task.status !== "running") ?? [];
  return (
    <View style={{ gap: 2, paddingHorizontal: 4, paddingVertical: 2 }}>
      <Text style={{ color: theme.colors.foreground, fontSize: 14, fontWeight: "600" }}>Background commands</Text>
      {tasks.isPending ? <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>Loading…</Text> : null}
      {tasks.isError ? <Text style={{ color: theme.colors.statusDanger }}>{tasks.error.message}</Text> : null}
      {tasks.data?.length === 0 ? (
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>No background commands in this session.</Text>
      ) : null}
      <TaskSection title="Running" tasks={running} agentId={agentId} now={now} props={props} />
      <TaskSection title="Finished" tasks={finished} agentId={agentId} now={now} props={props} />
    </View>
  );
}

function pillLabel(tasks: BackgroundTask[], now: number): { label: string; visible: boolean } {
  const running = tasks.filter((task) => task.status === "running").length;
  if (running > 0) return { label: `${running} running`, visible: true };
  const recent = tasks.filter((task) => task.endedAt && now - Date.parse(task.endedAt) < RECENT_FINISH_MS);
  if (recent.length === 0) return { label: "Background", visible: false };
  const failed = recent.filter((task) => task.status === "failed").length;
  return { label: failed > 0 ? `${failed} failed` : `${recent.length} done`, visible: true };
}

export function contributeBackgroundPills(client: PluginClientContext) {
  const pills = new Map<string, { workspaceId: string; registration: PluginButtonRegistration; label: string; visible: boolean }>();
  const lifetime = new AbortController();
  let polling = false;

  const register = (agent: { id: string; workspaceId?: string | null; provider?: string; status?: string }) => {
    if (lifetime.signal.aborted || !agent.workspaceId) return;
    if (agent.provider !== "claude" || agent.status === "closed") {
      remove(agent.id);
      return;
    }
    const existing = pills.get(agent.id);
    if (existing && existing.workspaceId === agent.workspaceId) return;
    existing?.registration.remove();
    pills.set(agent.id, {
      workspaceId: agent.workspaceId,
      label: "Background",
      visible: false,
      registration: client.addComposerPill({
        id: "background-commands",
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        button: {
          title: "Background commands",
          icon: "SquareTerminal",
          label: "Background",
          visible: false,
          behavior: { kind: "popover", Content: BackgroundTasksPopover },
        },
      }),
    });
  };

  const remove = (agentId: string) => {
    pills.get(agentId)?.registration.remove();
    pills.delete(agentId);
  };

  const removeAll = () => {
    for (const pill of pills.values()) pill.registration.remove();
    pills.clear();
  };

  const poll = async () => {
    if (polling || pills.size === 0) return;
    polling = true;
    try {
      const { agents } = await client.rpc(listBackgroundTasksRpc, { agentIds: [...pills.keys()] });
      const now = Date.now();
      for (const { agentId, tasks } of agents) {
        const pill = pills.get(agentId);
        if (!pill) continue;
        const next = pillLabel(tasks, now);
        if (next.label === pill.label && next.visible === pill.visible) continue;
        pill.label = next.label;
        pill.visible = next.visible;
        pill.registration.update(next);
      }
    } catch (error) {
      if (!lifetime.signal.aborted) console.error("[shell-plus] background poll failed", error);
    } finally {
      polling = false;
    }
  };

  const timer = setInterval(() => void poll(), BACKGROUND_POLL_MS);

  void client.paseo.agents
    .list({ subscribe: {}, signal: lifetime.signal })
    .then(({ subscription }) => {
      subscription.subscribe({
        snapshot: ({ entries }) => {
          removeAll();
          for (const { agent } of entries) register(agent);
          void poll();
        },
        update: (message) => {
          if (message.type !== "agent_update") return;
          const update = message.payload;
          if (update.kind === "upsert") return register(update.agent);
          remove(update.agentId);
        },
      });
      return undefined;
    })
    .catch((error) => {
      if (!lifetime.signal.aborted) console.error("[shell-plus] agent observation failed", error);
    });

  return () => {
    lifetime.abort();
    clearInterval(timer);
    removeAll();
  };
}

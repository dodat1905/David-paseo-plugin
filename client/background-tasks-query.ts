import { useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import type { BackgroundTask } from "../shared/background-tasks";
import { listBackgroundTasksRpc } from "../shared/background-tasks";

export const BACKGROUND_POLL_MS = 4000;

function needsPolling(tasks: BackgroundTask[] | undefined, watchTaskId: string | null): boolean {
  if (!tasks) return true;
  if (watchTaskId && !tasks.some((task) => task.id === watchTaskId)) return true;
  return tasks.some((task) => task.status === "running");
}

export function useBackgroundTasks(agentId: string, options: { watchTaskId?: string | null; pollAlways?: boolean } = {}) {
  const listBackgroundTasks = useRpc(listBackgroundTasksRpc);
  const watchTaskId = options.watchTaskId ?? null;
  return useQuery({
    queryKey: ["background-tasks", agentId],
    queryFn: async () => {
      const { agents } = await listBackgroundTasks({ agentIds: [agentId] });
      const entry = agents[0];
      if (entry?.error) throw new Error(entry.error);
      return entry?.tasks ?? [];
    },
    refetchInterval: (query) =>
      options.pollAlways || needsPolling(query.state.data, watchTaskId) ? BACKGROUND_POLL_MS : false,
  });
}

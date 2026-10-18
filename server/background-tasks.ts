import type { PaseoApi } from "@getpaseo/client";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import type { BackgroundTask } from "../shared/background-tasks";
import { listBackgroundTasksRpc, readBackgroundTaskOutputRpc } from "../shared/background-tasks";
import { backgroundTasksFromTranscript, findTranscript, readOutputTail } from "./transcript";

async function tasksForAgent(paseo: PaseoApi, agentId: string): Promise<BackgroundTask[]> {
  const refreshed = await paseo.agents.ref(agentId).refresh();
  const agent = refreshed?.agent;
  if (!agent) throw new Error(`Agent ${agentId} not found`);
  if (agent.provider !== "claude") return [];
  const sessionId = agent.runtimeInfo?.sessionId ?? null;
  if (!sessionId) return [];
  const transcript = await findTranscript(sessionId, agent.cwd ?? null);
  if (!transcript) return [];
  return backgroundTasksFromTranscript(transcript, agent.status !== "closed");
}

export async function listBackgroundTasks(
  { agentIds }: RpcInput<typeof listBackgroundTasksRpc>,
  { paseo }: PluginHandlerContext,
): Promise<RpcOutput<typeof listBackgroundTasksRpc>> {
  const agents = await Promise.all(
    agentIds.map(async (agentId) => {
      try {
        return { agentId, tasks: await tasksForAgent(paseo, agentId), error: null };
      } catch (error) {
        console.error(`background-tasks.list failed for agent ${agentId}`, error instanceof Error ? error.message : error);
        return { agentId, tasks: [], error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
  return { agents };
}

export async function readBackgroundTaskOutput(
  { agentId, taskId, tailBytes }: RpcInput<typeof readBackgroundTaskOutputRpc>,
  { paseo }: PluginHandlerContext,
): Promise<RpcOutput<typeof readBackgroundTaskOutputRpc>> {
  const task = (await tasksForAgent(paseo, agentId)).find((candidate) => candidate.id === taskId);
  if (!task?.outputPath) throw new Error(`No output file for background task ${taskId}`);
  return readOutputTail(task.outputPath, tailBytes);
}

import type { PluginServerContext } from "@getpaseo/plugin/server";
import { listBackgroundTasks, readBackgroundTaskOutput } from "./server/background-tasks";
import { contributeClaudeAuth } from "./server/claude-auth";
import { locateEdit } from "./server/edit-location";
import { listBackgroundTasksRpc, readBackgroundTaskOutputRpc } from "./shared/background-tasks";
import { editLocationRpc } from "./shared/edit-location";

export default function contribute(server: PluginServerContext) {
  server.handle(editLocationRpc, locateEdit);
  server.handle(listBackgroundTasksRpc, listBackgroundTasks);
  server.handle(readBackgroundTaskOutputRpc, readBackgroundTaskOutput);
  return contributeClaudeAuth(server);
}

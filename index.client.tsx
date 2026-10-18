import type { PluginClientContext } from "@getpaseo/plugin/client";
import { contributeExpandFileEdits } from "./client/expand-file-edits";
import { contributeShellPlus } from "./client/shell-plus";

export default function contribute(client: PluginClientContext) {
  const cleanups = [contributeExpandFileEdits(client), contributeShellPlus(client)];
  return async () => {
    for (const cleanup of cleanups) await cleanup();
  };
}

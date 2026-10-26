import type { PluginClientContext } from "@getpaseo/plugin/client";
import { contributeClaudeAuth } from "./client/claude-auth";
import { contributeExpandFileEdits } from "./client/expand-file-edits";
import { keepComposerFocused } from "./client/keep-composer-focus";
import { contributeShellPlus } from "./client/shell-plus";

export default function contribute(client: PluginClientContext) {
  const cleanups = [
    contributeExpandFileEdits(client),
    contributeShellPlus(client),
    contributeClaudeAuth(client),
    keepComposerFocused(),
  ];
  return async () => {
    for (const cleanup of cleanups) await cleanup();
  };
}

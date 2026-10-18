import type { PluginClientContext } from "@getpaseo/plugin/client";
import { contributeBackgroundPills } from "./background-pill";
import { ShellCard, transformShellToolCall } from "./shell-card";
import { SHELL_CARD_KIND, SHELL_CARD_VERSION, shellCardSchema } from "../shared/shell-card";

export function contributeShellPlus(client: PluginClientContext) {
  client.addTimelineTransformer({
    id: "wrapping-shell",
    query: { itemType: "tool_call" },
    transform: transformShellToolCall,
  });
  client.addTimelineRenderer({
    kind: SHELL_CARD_KIND,
    version: SHELL_CARD_VERSION,
    schema: shellCardSchema,
    Component: ShellCard,
  });
  return contributeBackgroundPills(client);
}

import type { PluginClientContext } from "@getpaseo/plugin/client";
import { loginRpc, notice, restartRpc, tokenRpc } from "../shared/claude-auth";
import { Notice } from "./claude-auth-notice";

export function contributeClaudeAuth(client: PluginClientContext) {
  const removers = [
    client.addTimelineRenderer({ ...notice, Component: Notice }),
    client.addSlashCommand({
      name: "token",
      description: "Run this agent on a Factopia user's Claude token, a pasted token, or clear it",
      argumentHint: "[list | <factopia user> | <sk-ant token> | <fmcp_ key> | clear]",
      context: "agent",
      async onSubmit({ args, agent, rpc }) {
        await rpc(tokenRpc, { agentId: agent.id, args });
      },
    }),
    client.addSlashCommand({
      name: "login",
      description: "Clear this agent's token and sign in to the Claude CLI",
      argumentHint: "",
      context: "agent",
      async onSubmit({ agent, workspace, rpc }) {
        await rpc(loginRpc, { agentId: agent.id, workspaceId: workspace.id });
      },
    }),
    client.addSlashCommand({
      name: "restart",
      description: "Restart this agent's session",
      argumentHint: "",
      context: "agent",
      async onSubmit({ agent, rpc }) {
        await rpc(restartRpc, { agentId: agent.id });
      },
    }),
  ];
  return () => {
    for (const remove of removers) remove();
  };
}

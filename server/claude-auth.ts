import type { PluginHandlerContext, PluginServerContext } from "@getpaseo/plugin/server";
import { loginRpc, restartRpc, tokenRpc } from "../shared/claude-auth";
import {
  inheritParentToken,
  login,
  recoverFromAuthFailure,
  refreshIdleFactopiaAgents,
  restart,
  runTokenCommand,
  withSavedToken,
} from "./agent-auth";
import { syncShellTokens } from "./token-store";

const refreshIntervalMs = 5 * 60_000;

export function contributeClaudeAuth(server: PluginServerContext) {
  let paseo: PluginHandlerContext["paseo"] | null = null;
  let refreshing = false;
  void syncShellTokens().catch((error) => console.error(`claude-auth: shell token sync failed: ${error.message}`));

  server.before("agent.session_open", async ({ request }, context) => {
    paseo = context.paseo;
    await inheritParentToken(request);
    const env = await withSavedToken(request.agentId, request.env, request.purpose === "interactive");
    return env ? { ...request, env } : undefined;
  });
  server.on("agent.turn_ended", (event, context) => {
    paseo = context.paseo;
    return recoverFromAuthFailure(event, context.paseo);
  });
  server.handle(tokenRpc, ({ agentId, args }, context) => {
    paseo = context.paseo;
    return runTokenCommand(agentId, args, context.paseo);
  });
  server.handle(restartRpc, ({ agentId }, context) => restart(agentId, context.paseo));
  server.handle(loginRpc, ({ agentId, workspaceId }, context) => login(agentId, workspaceId, context.paseo));

  const timer = setInterval(async () => {
    if (!paseo || refreshing) return;
    refreshing = true;
    try {
      await refreshIdleFactopiaAgents(paseo);
    } finally {
      refreshing = false;
    }
  }, refreshIntervalMs);
  return () => clearInterval(timer);
}

import { execCommand, type PluginHandlerContext, type PluginLifecycleEvents } from "@getpaseo/plugin/server";
import { existsSync } from "node:fs";
import { notice } from "../shared/claude-auth";
import { defaultFactopiaUrl, findUser, freshToken, listUsers, shortName } from "./factopia";
import {
  type AgentToken,
  factopiaAgents,
  forgetToken,
  saveFactopiaSettings,
  saveToken,
  tokenFor,
} from "./token-store";

type PaseoApi = PluginHandlerContext["paseo"];

const bundledPaseoCli = "/Applications/Paseo.app/Contents/Resources/bin/paseo";
const loginShell = process.env.SHELL ?? "/bin/zsh";
const authFailure = /^(Failed to authenticate|OAuth token has expired|API Error: 401)/;
const retryWindowMs = 10 * 60_000;
const lastRetryAt = new Map<string, number>();

function paseoCli() {
  return existsSync(bundledPaseoCli) ? bundledPaseoCli : "paseo";
}

function quoted(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

async function tell(paseo: PaseoApi, agentId: string, message: string) {
  await paseo.agents.ref(agentId).timeline.append({
    type: "plugin",
    id: `claude-auth-${Date.now()}`,
    kind: notice.kind,
    version: notice.version,
    data: { message: `Claude auth: ${message}` },
  });
}

async function restartAgent(agentId: string) {
  await execCommand(paseoCli(), ["agent", "reload", agentId], { timeout: 120_000 });
}

async function cliAccount(): Promise<string | null> {
  try {
    const { stdout } = await execCommand(loginShell, ["-lc", "claude auth status --json"], {
      timeout: 30_000,
    });
    const status = JSON.parse(stdout) as { loggedIn?: boolean; email?: string };
    return status.loggedIn ? (status.email ?? "signed in") : null;
  } catch {
    return null;
  }
}

function describe(record: AgentToken) {
  const ending = `token ending in ${record.token.slice(-4)}`;
  if (record.factopiaUserId === undefined) return `its saved ${ending}`;
  const expiry = record.expiresAt ? `, expires ${new Date(record.expiresAt).toLocaleString()}` : "";
  return `Factopia account ${record.label} (${ending}${expiry})`;
}

async function fetchFactopiaRecord(userId: number): Promise<AgentToken> {
  const fresh = await freshToken(userId);
  return { token: fresh.token, factopiaUserId: fresh.id, label: shortName(fresh), expiresAt: fresh.token_expires_at };
}

async function currentToken(agentId: string, refresh: boolean) {
  const record = await tokenFor(agentId);
  if (!record || record.factopiaUserId === undefined || !refresh) return record?.token;
  try {
    const fresh = await fetchFactopiaRecord(record.factopiaUserId);
    if (fresh.token !== record.token || fresh.expiresAt !== record.expiresAt) await saveToken(agentId, fresh);
    return fresh.token;
  } catch (error) {
    console.error(`claude-auth: Factopia token fetch failed for agent ${agentId}: ${(error as Error).message}`);
    return record.token;
  }
}

export async function withSavedToken(agentId: string, env: Record<string, string>, refresh: boolean) {
  const token = await currentToken(agentId, refresh);
  return token ? { ...env, CLAUDE_CODE_OAUTH_TOKEN: token } : undefined;
}

async function showStatus(agentId: string, paseo: PaseoApi) {
  const record = await tokenFor(agentId);
  if (record) return tell(paseo, agentId, `this agent uses ${describe(record)}.`);
  const account = await cliAccount();
  await tell(
    paseo,
    agentId,
    account
      ? `this agent uses your Claude CLI login (${account}).`
      : "this agent uses your Claude CLI login, but the CLI is not signed in. Run /login.",
  );
}

async function showFactopiaUsers(agentId: string, paseo: PaseoApi) {
  const users = await listUsers();
  const lines = users.map((user) => {
    const kind = user.pool_account ? "agent token account" : user.email;
    return `• ${shortName(user)} (${kind}${user.refreshable ? "" : ", no auto-refresh"})`;
  });
  await tell(paseo, agentId, `Factopia users with a Claude connection:\n${lines.join("\n")}\nUse /token <name>.`);
}

async function saveFactopiaKey(agentId: string, mcpToken: string, paseo: PaseoApi) {
  await saveFactopiaSettings({ url: process.env.FACTOPIA_URL ?? defaultFactopiaUrl, mcpToken });
  const users = await listUsers();
  await tell(paseo, agentId, `saved the Factopia MCP token. ${users.length} users have a Claude connection.`);
}

async function useToken(agentId: string, record: AgentToken, paseo: PaseoApi) {
  await saveToken(agentId, record);
  await restartAgent(agentId);
  await tell(paseo, agentId, `restarted with ${describe(record)}.`);
}

async function useCliLogin(agentId: string, paseo: PaseoApi) {
  await forgetToken(agentId);
  await restartAgent(agentId);
  await tell(paseo, agentId, "token cleared. Restarted on your Claude CLI login.");
}

export async function runTokenCommand(agentId: string, args: string, paseo: PaseoApi) {
  if (/\s/.test(args)) throw new Error("Type one value with no spaces: /token <name | token | list | clear>");
  if (args === "" || args === "status") await showStatus(agentId, paseo);
  else if (args === "list") await showFactopiaUsers(agentId, paseo);
  else if (args === "clear") await useCliLogin(agentId, paseo);
  else if (args.startsWith("fmcp_")) await saveFactopiaKey(agentId, args, paseo);
  else if (args.startsWith("sk-ant-")) await useToken(agentId, { token: args }, paseo);
  else await useToken(agentId, await fetchFactopiaRecord((await findUser(args)).id), paseo);
  return {};
}

export async function restart(agentId: string, paseo: PaseoApi) {
  await restartAgent(agentId);
  await tell(paseo, agentId, "agent restarted.");
  return {};
}

export async function login(agentId: string, workspaceId: string, paseo: PaseoApi) {
  await forgetToken(agentId);
  const script = [
    `claude auth login && ${quoted(paseoCli())} agent reload ${quoted(agentId)} && echo 'Signed in. The agent restarted on your Claude CLI login.'`,
    "printf '\\nPress Enter to close. '",
    "read -r _",
  ].join("; ");
  await paseo.terminals.create({
    workspaceId,
    name: "Claude login",
    command: loginShell,
    args: ["-lc", script],
  });
  await tell(paseo, agentId, "token cleared. Finish the sign-in in the Claude login terminal.");
  return {};
}

export async function refreshIdleFactopiaAgents(paseo: PaseoApi) {
  for (const [agentId, record] of await factopiaAgents()) {
    try {
      const agent = (await paseo.agents.ref(agentId).refresh())?.agent;
      if (!agent || agent.archivedAt || !["idle", "error"].includes(agent.status)) continue;
      const fresh = await fetchFactopiaRecord(record.factopiaUserId!);
      if (fresh.token === record.token) {
        if (fresh.expiresAt !== record.expiresAt) await saveToken(agentId, fresh);
        continue;
      }
      await useToken(agentId, fresh, paseo);
    } catch (error) {
      console.error(`claude-auth: auto-refresh failed for agent ${agentId}: ${(error as Error).message}`);
    }
  }
}

export async function recoverFromAuthFailure(
  { agent, outcome, timeline }: PluginLifecycleEvents["agent.turn_ended"],
  paseo: PaseoApi,
) {
  const record = await tokenFor(agent.id);
  if (record?.factopiaUserId === undefined) return;
  const lastReply = timeline.findLast((item) => item.type === "assistant_message");
  const failed =
    (outcome.kind === "failed" && authFailure.test(outcome.error.message.trim())) ||
    (lastReply?.type === "assistant_message" && authFailure.test(lastReply.text.trim()));
  if (!failed) return;
  if (Date.now() - (lastRetryAt.get(agent.id) ?? 0) < retryWindowMs) {
    await tell(paseo, agent.id, `the token of ${record.label} still fails after a refresh. Check the account in Factopia.`);
    return;
  }
  lastRetryAt.set(agent.id, Date.now());
  await useToken(agent.id, await fetchFactopiaRecord(record.factopiaUserId), paseo);
  const prompt = timeline.findLast((item) => item.type === "user_message");
  if (prompt?.type === "user_message") await paseo.agents.ref(agent.id).send(prompt.text);
}

import { factopiaSettings } from "./token-store";

export interface FactopiaUser {
  id: number;
  name: string | null;
  email: string;
  pool_account: boolean;
  refreshable: boolean;
  token_expires_at: string | null;
}

export interface FactopiaToken extends FactopiaUser {
  token: string;
}

export const defaultFactopiaUrl = "https://factopia.applicaainternal.com";

async function callTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const settings = await factopiaSettings();
  if (!settings) throw new Error("Save your Factopia admin MCP token first: /token fmcp_...");
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), 15_000);
  const response = await fetch(`${settings.url}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.mcpToken}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    signal: deadline.signal,
  }).finally(() => clearTimeout(timer));
  if (!response.ok) throw new Error(`Factopia MCP answered HTTP ${response.status}.`);
  const body = (await response.json()) as {
    result?: { isError?: boolean; structuredContent?: T; content?: { text?: string }[] };
    error?: { message: string };
  };
  if (body.error) throw new Error(`Factopia MCP: ${body.error.message}`);
  if (body.result?.isError) throw new Error(`Factopia: ${body.result.content?.[0]?.text ?? "tool error"}`);
  return body.result?.structuredContent as T;
}

export async function listUsers(): Promise<FactopiaUser[]> {
  return (await callTool<{ accounts: FactopiaUser[] }>("list_claude_users", {})).accounts;
}

export function freshToken(userId: number): Promise<FactopiaToken> {
  return callTool<FactopiaToken>("fresh_claude_token", { user_id: userId });
}

export function shortName(user: FactopiaUser) {
  return user.pool_account ? (user.name ?? user.email) : user.email.split("@")[0];
}

export async function findUser(query: string): Promise<FactopiaUser> {
  const wanted = query.toLowerCase();
  const users = await listUsers();
  const keys = (user: FactopiaUser) =>
    [String(user.id), shortName(user), user.email, user.name ?? ""].map((key) => key.toLowerCase());
  const exact = users.filter((user) => keys(user).includes(wanted));
  const matches = exact.length > 0 ? exact : users.filter((user) => keys(user).some((key) => key.startsWith(wanted)));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new Error(`No Claude-connected Factopia user matches "${query}". Run /token list.`);
  throw new Error(`"${query}" matches ${matches.map(shortName).join(", ")}. Type a longer name.`);
}

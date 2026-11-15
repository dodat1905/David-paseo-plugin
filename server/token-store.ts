import { chmod, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface AgentToken {
  token: string;
  factopiaUserId?: number;
  label?: string;
  expiresAt?: string | null;
}

export interface FactopiaSettings {
  url: string;
  mcpToken: string;
}

const storeDirectory = join(process.env.PASEO_HOME ?? join(homedir(), ".paseo"), "claude-auth");
const tokensPath = join(storeDirectory, "tokens.json");
const factopiaPath = join(storeDirectory, "factopia.json");
const shellTokenDirectory = join(storeDirectory, "agents");
const agentIdPattern = /^[A-Za-z0-9_-]+$/;

async function readJson<T>(path: string, empty: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty;
    throw error;
  }
}

async function writeJson(path: string, value: unknown) {
  await mkdir(storeDirectory, { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(value, null, 2), { mode: 0o600 });
  await chmod(path, 0o600);
}

async function writeShellToken(agentId: string, token: string) {
  if (!agentIdPattern.test(agentId)) return;
  await mkdir(shellTokenDirectory, { recursive: true, mode: 0o700 });
  const path = join(shellTokenDirectory, agentId);
  await writeFile(path, token, { mode: 0o600 });
  await chmod(path, 0o600);
}

async function removeShellToken(agentId: string) {
  if (!agentIdPattern.test(agentId)) return;
  await rm(join(shellTokenDirectory, agentId), { force: true });
}

export async function syncShellTokens() {
  const tokens = await readTokens();
  for (const [agentId, record] of Object.entries(tokens)) await writeShellToken(agentId, record.token);
  const files = await readdir(shellTokenDirectory).catch(() => [] as string[]);
  for (const agentId of files) if (!(agentId in tokens)) await removeShellToken(agentId);
}

async function readTokens() {
  return readJson<Record<string, AgentToken>>(tokensPath, {});
}

export async function tokenFor(agentId: string): Promise<AgentToken | undefined> {
  return (await readTokens())[agentId];
}

export async function factopiaAgents(): Promise<[string, AgentToken][]> {
  return Object.entries(await readTokens()).filter(([, record]) => record.factopiaUserId !== undefined);
}

export async function saveToken(agentId: string, record: AgentToken) {
  await writeJson(tokensPath, { ...(await readTokens()), [agentId]: record });
  await writeShellToken(agentId, record.token);
}

export async function forgetToken(agentId: string) {
  const { [agentId]: _forgotten, ...rest } = await readTokens();
  await writeJson(tokensPath, rest);
  await removeShellToken(agentId);
}

export async function factopiaSettings(): Promise<FactopiaSettings | null> {
  return readJson<FactopiaSettings | null>(factopiaPath, null);
}

export async function saveFactopiaSettings(settings: FactopiaSettings) {
  await writeJson(factopiaPath, settings);
}

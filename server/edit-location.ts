import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { editLocationRpc } from "../shared/edit-location";

async function candidatePaths(path: string, { paseo }: PluginHandlerContext): Promise<string[]> {
  if (path.startsWith("~/")) return [join(homedir(), path.slice(2))];
  if (isAbsolute(path)) return [path];
  const { entries } = await paseo.agents.list();
  const directories = new Set(entries.map((entry) => entry.agent.cwd));
  return [...directories].map((directory) => resolve(directory, path));
}

function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let cursor = content.indexOf("\n"); cursor !== -1 && cursor < index; cursor = content.indexOf("\n", cursor + 1)) {
    line += 1;
  }
  return line;
}

export async function locateEdit(
  { path, newText }: RpcInput<typeof editLocationRpc>,
  context: PluginHandlerContext,
): Promise<RpcOutput<typeof editLocationRpc>> {
  const startLines = new Set<number>();
  for (const candidate of await candidatePaths(path, context)) {
    const content = await readFile(candidate, "utf8").catch(() => null);
    if (content === null) continue;
    const index = content.indexOf(newText);
    if (index === -1) continue;
    if (content.indexOf(newText, index + 1) !== -1) return { startLine: null };
    startLines.add(lineNumberAt(content, index));
  }
  return { startLine: startLines.size === 1 ? [...startLines][0] : null };
}

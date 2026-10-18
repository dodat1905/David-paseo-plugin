import { open, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { BackgroundTask, BackgroundTaskStatus } from "../shared/background-tasks";

interface ShellUse {
  command: string;
  description: string | null;
  startedAt: string;
}

interface TaskEnd {
  status: Exclude<BackgroundTaskStatus, "running" | "stale">;
  exitCode: number | null;
  endedAt: string;
}

interface TaskStart {
  id: string;
  toolUseId: string;
  command: string;
  description: string | null;
  startedAt: string;
  outputPath: string | null;
}

interface TranscriptState {
  offset: number;
  pending: string;
  shellUses: Map<string, ShellUse>;
  starts: Map<string, TaskStart>;
  ends: Map<string, TaskEnd>;
}

const states = new Map<string, TranscriptState>();
const transcriptPaths = new Map<string, string>();

const SHELL_TOOL_NAMES = new Set(["Bash", "PowerShell"]);
const STOP_TOOL_NAMES = new Set(["TaskStop", "KillShell"]);
const NOTIFICATION_PATTERN =
  /<task-notification>[\s\S]*?<task-id>([^<]+)<\/task-id>[\s\S]*?<status>([^<]+)<\/status>(?:[\s\S]*?<summary>([^<]*)<\/summary>)?/g;
const OUTPUT_PATH_PATTERN = /Output is being written to: (\S+?\.output)/;
const EXIT_CODE_PATTERN = /exit code (-?\d+)/;

function claudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
}

function projectSlug(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function findTranscript(sessionId: string, cwd: string | null): Promise<string | null> {
  const cached = transcriptPaths.get(sessionId);
  if (cached && (await fileExists(cached))) return cached;
  const projectsDir = join(claudeConfigDir(), "projects");
  const fileName = `${sessionId}.jsonl`;
  if (cwd) {
    const direct = join(projectsDir, projectSlug(cwd), fileName);
    if (await fileExists(direct)) {
      transcriptPaths.set(sessionId, direct);
      return direct;
    }
  }
  let projectDirs: string[];
  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return null;
  }
  for (const dir of projectDirs) {
    const candidate = join(projectsDir, dir, fileName);
    if (await fileExists(candidate)) {
      transcriptPaths.set(sessionId, candidate);
      return candidate;
    }
  }
  return null;
}

function emptyState(): TranscriptState {
  return { offset: 0, pending: "", shellUses: new Map(), starts: new Map(), ends: new Map() };
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : "")).join("\n");
  }
  return "";
}

function endFromNotification(status: string, summary: string | undefined, timestamp: string): TaskEnd {
  const exitCodeMatch = summary ? EXIT_CODE_PATTERN.exec(summary) : null;
  const exitCode = exitCodeMatch ? Number(exitCodeMatch[1]) : null;
  if (status === "killed" || status === "stopped") return { status: "killed", exitCode, endedAt: timestamp };
  if (status === "failed" || (exitCode !== null && exitCode !== 0)) return { status: "failed", exitCode, endedAt: timestamp };
  return { status: "completed", exitCode, endedAt: timestamp };
}

function recordNotifications(state: TranscriptState, text: string, timestamp: string) {
  if (!text.includes("<task-notification>")) return;
  for (const match of text.matchAll(NOTIFICATION_PATTERN)) {
    const [, taskId, status, summary] = match;
    if (!state.ends.has(taskId)) state.ends.set(taskId, endFromNotification(status, summary, timestamp));
  }
}

function applyEntry(state: TranscriptState, entry: Record<string, unknown>) {
  const timestamp = typeof entry.timestamp === "string" ? entry.timestamp : new Date().toISOString();
  if (entry.type === "queue-operation") {
    recordNotifications(state, textOf(entry.content), timestamp);
    return;
  }
  const message = entry.message as { content?: unknown } | undefined;
  if (!message) return;
  const content = message.content;
  if (entry.type === "user" && typeof content === "string") {
    recordNotifications(state, content, timestamp);
    return;
  }
  if (!Array.isArray(content)) return;
  for (const block of content as Array<Record<string, unknown>>) {
    if (block.type === "text" && entry.type === "user" && typeof block.text === "string" && block.text.startsWith("<task-notification>")) {
      recordNotifications(state, block.text, timestamp);
    }
    if (block.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
      const input = (block.input ?? {}) as Record<string, unknown>;
      if (SHELL_TOOL_NAMES.has(block.name) && typeof input.command === "string") {
        state.shellUses.set(block.id, {
          command: input.command,
          description: typeof input.description === "string" ? input.description : null,
          startedAt: timestamp,
        });
      }
      if (STOP_TOOL_NAMES.has(block.name)) {
        const taskId = input.task_id ?? input.shell_id;
        if (typeof taskId === "string" && !state.ends.has(taskId)) {
          state.ends.set(taskId, { status: "killed", exitCode: null, endedAt: timestamp });
        }
      }
    }
    if (block.type === "tool_result" && typeof block.tool_use_id === "string") {
      const result = entry.toolUseResult as Record<string, unknown> | undefined;
      const taskId = result && typeof result.backgroundTaskId === "string" ? result.backgroundTaskId : null;
      const use = state.shellUses.get(block.tool_use_id);
      if (!taskId || !use) continue;
      const outputPath = OUTPUT_PATH_PATTERN.exec(textOf(block.content))?.[1] ?? null;
      state.starts.set(taskId, {
        id: taskId,
        toolUseId: block.tool_use_id,
        command: use.command,
        description: use.description,
        startedAt: use.startedAt,
        outputPath,
      });
    }
  }
}

async function readAppended(path: string, state: TranscriptState): Promise<TranscriptState> {
  const handle = await open(path, "r");
  try {
    const { size } = await handle.stat();
    let current = state;
    if (size < current.offset) current = emptyState();
    if (size === current.offset) return current;
    const length = size - current.offset;
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, current.offset);
    const text = current.pending + buffer.toString("utf8");
    const lines = text.split("\n");
    current.pending = lines.pop() ?? "";
    current.offset = size;
    for (const line of lines) {
      if (!line) continue;
      try {
        applyEntry(current, JSON.parse(line));
      } catch {
        continue;
      }
    }
    return current;
  } finally {
    await handle.close();
  }
}

async function outputStats(path: string | null): Promise<{ bytes: number | null; updatedAt: string | null }> {
  if (!path) return { bytes: null, updatedAt: null };
  try {
    const info = await stat(path);
    return { bytes: info.size, updatedAt: info.mtime.toISOString() };
  } catch {
    return { bytes: null, updatedAt: null };
  }
}

export async function backgroundTasksFromTranscript(path: string, sessionAlive: boolean): Promise<BackgroundTask[]> {
  const state = await readAppended(path, states.get(path) ?? emptyState());
  states.set(path, state);
  const tasks = await Promise.all(
    [...state.starts.values()].map(async (start): Promise<BackgroundTask> => {
      const end = state.ends.get(start.id);
      const output = await outputStats(start.outputPath);
      let status: BackgroundTaskStatus = end?.status ?? "running";
      if (!end && !sessionAlive) status = "stale";
      return {
        id: start.id,
        toolUseId: start.toolUseId,
        command: start.command,
        description: start.description,
        status,
        exitCode: end?.exitCode ?? null,
        startedAt: start.startedAt,
        endedAt: end?.endedAt ?? null,
        outputPath: start.outputPath,
        outputBytes: output.bytes,
        outputUpdatedAt: output.updatedAt,
      };
    }),
  );
  return tasks.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function readOutputTail(
  path: string,
  tailBytes: number,
): Promise<{ text: string; totalBytes: number; truncated: boolean }> {
  const handle = await open(path, "r");
  try {
    const { size } = await handle.stat();
    const start = Math.max(0, size - tailBytes);
    const buffer = Buffer.alloc(size - start);
    await handle.read(buffer, 0, buffer.length, start);
    return { text: buffer.toString("utf8"), totalBytes: size, truncated: start > 0 };
  } finally {
    await handle.close();
  }
}

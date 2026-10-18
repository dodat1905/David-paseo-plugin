import { z } from "zod";

export const SHELL_CARD_KIND = "shell-card";
export const SHELL_CARD_VERSION = 1;

export const shellCardSchema = z.object({
  command: z.string(),
  cwd: z.string().nullable(),
  output: z.string().nullable(),
  exitCode: z.number().nullable(),
  status: z.enum(["running", "completed", "failed", "canceled"]),
  error: z.string().nullable(),
  backgroundTaskId: z.string().nullable(),
});

export type ShellCardData = z.output<typeof shellCardSchema>;

const BACKGROUND_TASK_ID_PATTERN = /(?:running in background|moved to the background) \(?(?:with )?ID:? ([A-Za-z0-9_-]+)/;

export function backgroundTaskIdFrom(output: string | null | undefined): string | null {
  if (!output) return null;
  return BACKGROUND_TASK_ID_PATTERN.exec(output)?.[1] ?? null;
}

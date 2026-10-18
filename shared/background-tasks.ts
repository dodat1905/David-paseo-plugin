import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const backgroundTaskStatusSchema = z.enum(["running", "completed", "failed", "killed", "stale"]);

export type BackgroundTaskStatus = z.output<typeof backgroundTaskStatusSchema>;

export const backgroundTaskSchema = z.object({
  id: z.string(),
  toolUseId: z.string(),
  command: z.string(),
  description: z.string().nullable(),
  status: backgroundTaskStatusSchema,
  exitCode: z.number().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  outputPath: z.string().nullable(),
  outputBytes: z.number().nullable(),
  outputUpdatedAt: z.string().nullable(),
});

export type BackgroundTask = z.output<typeof backgroundTaskSchema>;

export const listBackgroundTasksRpc = defineRpc({
  name: "background-tasks.list",
  input: z.object({ agentIds: z.array(z.string()) }),
  output: z.object({
    agents: z.array(
      z.object({
        agentId: z.string(),
        tasks: z.array(backgroundTaskSchema),
        error: z.string().nullable(),
      }),
    ),
  }),
});

export const readBackgroundTaskOutputRpc = defineRpc({
  name: "background-tasks.output",
  input: z.object({ agentId: z.string(), taskId: z.string(), tailBytes: z.number().int().positive() }),
  output: z.object({
    text: z.string(),
    totalBytes: z.number(),
    truncated: z.boolean(),
  }),
});

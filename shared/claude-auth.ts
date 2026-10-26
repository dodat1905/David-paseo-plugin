import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const agentInput = z.object({ agentId: z.string() });
const done = z.object({});

export const tokenRpc = defineRpc({
  name: "claude-auth.token",
  input: agentInput.extend({ args: z.string() }),
  output: done,
});

export const restartRpc = defineRpc({
  name: "claude-auth.restart",
  input: agentInput,
  output: done,
});

export const loginRpc = defineRpc({
  name: "claude-auth.login",
  input: agentInput.extend({ workspaceId: z.string() }),
  output: done,
});

export const notice = {
  kind: "claude-auth-notice",
  version: 1,
  schema: z.object({ message: z.string() }),
};

import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const editLocationRpc = defineRpc({
  name: "edit.locate",
  input: z.object({ path: z.string(), newText: z.string() }),
  output: z.object({ startLine: z.number().nullable() }),
});

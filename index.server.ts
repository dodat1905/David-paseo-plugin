import type { PluginServerContext } from "@getpaseo/plugin/server";
import { locateEdit } from "./server/edit-location";
import { editLocationRpc } from "./shared/edit-location";

export default function contribute(server: PluginServerContext) {
  server.handle(editLocationRpc, locateEdit);
  return () => {};
}

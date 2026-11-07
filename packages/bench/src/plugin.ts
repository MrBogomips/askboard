// The one setting that selects the session process (early-benchmark design decision 4): E1's,
// from AskBoard's plugin at the repository root, or the stub of bench's tests. Every command takes
// the plugin directory from it, and the smoke check starts the server that plugin declares.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerCommand } from "./agent.ts";
import type { Session } from "./settings.ts";

export const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
export const STUB_PLUGIN = resolve(fileURLToPath(new URL("../test/stub", import.meta.url)));
/** The server AskBoard's plugin declares (E1 design decision 10). */
export const SERVER_NAME = "askboard";

/** A benchmark that cannot start; its message says what to do. */
export class PreflightError extends Error {
  override readonly name = "PreflightError";
}

export const pluginDirOf = (session: Session, override?: string): string =>
  override === undefined ? (session === "e1" ? REPOSITORY_ROOT : STUB_PLUGIN) : resolve(override);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

// plugin.json's `mcpServers` (an object, or a path to a file holding one), else the plugin's .mcp.json.
const serversOf = (pluginDir: string): Record<string, unknown> => {
  const manifest = join(pluginDir, ".claude-plugin", "plugin.json");
  if (!existsSync(manifest)) throw new PreflightError(`no plugin manifest at ${manifest}`);
  const declared = (readJson(manifest) as Record<string, unknown>).mcpServers;
  if (isRecord(declared)) return declared;
  const file =
    typeof declared === "string" ? join(pluginDir, declared) : join(pluginDir, ".mcp.json");
  if (!existsSync(file)) return {};
  const found = readJson(file);
  return isRecord(found) && isRecord(found.mcpServers) ? found.mcpServers : {};
};

/** The command the plugin declares for its `askboard` server, as Claude Code would start it. */
export const readPluginServer = (pluginDir: string, projectDir: string): ServerCommand => {
  const server = serversOf(pluginDir)[SERVER_NAME];
  if (!isRecord(server) || typeof server.command !== "string") {
    throw new PreflightError(`the plugin at ${pluginDir} declares no server "${SERVER_NAME}"`);
  }
  const substitute = (text: string) =>
    text
      .replaceAll(`\${CLAUDE_PLUGIN_ROOT}`, pluginDir)
      .replaceAll(`\${CLAUDE_PROJECT_DIR}`, projectDir);
  const args = Array.isArray(server.args) ? server.args.map((arg) => substitute(String(arg))) : [];
  const env = isRecord(server.env)
    ? Object.fromEntries(
        Object.entries(server.env).map(([name, value]) => [name, substitute(String(value))]),
      )
    : {};
  return { command: substitute(server.command), args, env };
};

/** The start script, `scripts/askboard` (plugin-release): it runs the bundle beside it in `dist/`. */
const START_SCRIPT = /(^|[/\\])scripts[/\\]askboard$/;

/** The built file E1's server entry runs: the script it names, or the start script's bundle. */
const builtFileOf = (server: ServerCommand, pluginDir: string): string | undefined => {
  const scripts = server.args.filter((arg) => isAbsolute(arg));
  if (scripts.some((arg) => START_SCRIPT.test(arg))) return join(pluginDir, "dist", "askboard.mjs");
  return scripts.find((arg) => /\.(m?js|ts)$/.test(arg));
};

/** Fails when the session's plugin cannot start: no manifest, no server, or E1's not built. */
export const preflightPlugin = (session: Session, pluginDir: string): void => {
  const server = readPluginServer(pluginDir, pluginDir);
  if (session !== "e1") return;
  const script = builtFileOf(server, pluginDir);
  if (script !== undefined && !existsSync(script)) {
    throw new PreflightError(
      `E1's session process is not built: ${script} is missing; run bun run build`,
    );
  }
};

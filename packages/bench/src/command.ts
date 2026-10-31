// The pinned `claude -p` command of one run, its environment and the files it reads (early-
// benchmark design decision 3). Pure: run.ts writes the files and starts the command.

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AUQ_TOOL } from "./answerer/auq.ts";
import { browserScript, quote } from "./answerer/launcher.ts";
import {
  PERMISSION_HOST,
  PERMISSION_SERVER,
  PERMISSION_TOOL_NAME,
} from "./answerer/permission-host.ts";
import { type Arm, answerPlan, CASES, type CaseId } from "./scenarios.ts";
import type { RunSettings } from "./settings.ts";

export const AUQ_HOOK = fileURLToPath(new URL("./answerer/auq-hook-main.ts", import.meta.url));

/** One run of a case in an arm. */
export type CaseRun = {
  readonly caseId: CaseId;
  readonly arm: Arm;
  readonly run: number;
  /** The run's folder under `.askboard/bench/<run>/cases/`. */
  readonly dir: string;
  /** The scratch project `claude` runs in. */
  readonly project: string;
  readonly sessionId: string;
  readonly pluginDir: string;
  readonly settings: RunSettings;
};

export type Launch = {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  /** The names of the variables set, for the run's record; values are never recorded. */
  readonly envNames: readonly string[];
  readonly cwd: string;
  readonly files: readonly {
    readonly path: string;
    readonly content: string;
    readonly mode?: number;
  }[];
};

// What a login shell needs, and the credentials Claude Code reads; nothing of a launching Claude
// Code session reaches the run (mod delivery spike, finding O5).
const KEPT = [
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "PATH",
  "TERM",
  "LANG",
  "TMPDIR",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "ANTHROPIC_API_KEY",
  "CLAUDE_CONFIG_DIR",
];

export const cleanEnv = (
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string> =>
  Object.fromEntries(
    KEPT.flatMap((name) => {
      const value = env[name];
      return value === undefined ? [] : [[name, value]];
    }),
  );

const ASKBOARD_TOOLS = [
  "mcp__plugin_askboard_askboard__ask",
  "mcp__plugin_askboard_askboard__collect",
  "mcp__askboard__ask",
  "mcp__askboard__collect",
];

// The baseline gets the AskBoard arm's tools, so that the two first requests differ only by AskBoard.
const toolsOf = (run: CaseRun): { tools: string[]; allowed: string[] } => {
  if (run.arm === "auq") return { tools: [AUQ_TOOL, "ToolSearch"], allowed: ["ToolSearch"] };
  const agent = CASES[run.caseId].fromSubagent ? ["Agent"] : [];
  return { tools: ["ToolSearch", ...agent], allowed: [...ASKBOARD_TOOLS, "ToolSearch", ...agent] };
};

export const buildLaunch = (
  run: CaseRun,
  prompt: string,
  userEnv: Readonly<Record<string, string | undefined>>,
): Launch => {
  const { settings, dir, arm } = run;
  const path = (name: string) => join(dir, name);
  const paths = { plan: path("plan.json"), records: path("answerer.jsonl") };
  const { tools, allowed } = toolsOf(run);
  const withHost = arm === "auq" && settings.auqPermissionHost;
  const hook = [process.execPath, AUQ_HOOK, "--plan", paths.plan, "--records", paths.records];
  const runSettings =
    arm === "auq"
      ? {
          hooks: {
            PreToolUse: [
              {
                matcher: AUQ_TOOL,
                hooks: [{ type: "command", command: hook.map(quote).join(" "), timeout: 10 }],
              },
            ],
          },
        }
      : {};
  const mcp = {
    mcpServers: {
      [PERMISSION_SERVER]: {
        command: process.execPath,
        args: [PERMISSION_HOST, "--plan", paths.plan, "--records", paths.records],
      },
    },
  };
  const args = [
    "-p",
    prompt,
    "--session-id",
    run.sessionId,
    "--model",
    settings.model,
    "--effort",
    settings.effort,
    "--setting-sources",
    "",
    "--settings",
    path("run-settings.json"),
    "--tools",
    tools.join(","),
    "--allowedTools",
    allowed.join(","),
    "--max-turns",
    // The baseline only needs its first request.
    arm === "baseline" ? "1" : String(settings.maxTurns),
    "--output-format",
    "stream-json",
    "--verbose",
    ...(arm === "askboard" ? ["--plugin-dir", run.pluginDir] : []),
    ...(withHost
      ? ["--permission-prompt-tool", PERMISSION_TOOL_NAME, "--mcp-config", path("mcp.json")]
      : []),
  ];
  // The bench servers speak only the 2025 handshake (decision 7).
  const legacy = withHost || (arm === "askboard" && settings.session === "stub");
  const env: Record<string, string> = {
    ...cleanEnv(userEnv),
    DISABLE_AUTOUPDATER: "1",
    ENABLE_TOOL_SEARCH: settings.toolSearch,
    ...(settings.cacheTtl === "1h"
      ? { ENABLE_PROMPT_CACHING_1H: "1" }
      : { FORCE_PROMPT_CACHING_5M: "1" }),
    ...(arm === "askboard" ? { BROWSER: path("browser.sh") } : {}),
    ...(legacy ? { MCP_PROTOCOL_NEGOTIATION: "legacy" } : {}),
  };
  const files = [
    { path: paths.plan, content: JSON.stringify(answerPlan(CASES[run.caseId]), null, 2) },
    { path: path("run-settings.json"), content: JSON.stringify(runSettings, null, 2) },
    ...(arm === "askboard"
      ? [{ path: path("browser.sh"), content: browserScript(paths), mode: 0o755 }]
      : []),
    ...(withHost ? [{ path: path("mcp.json"), content: JSON.stringify(mcp, null, 2) }] : []),
  ];
  return {
    command: settings.claude,
    args,
    env,
    envNames: Object.keys(env).sort(),
    cwd: run.project,
    files,
  };
};

/** The version `claude --version` prints, such as 2.1.314. */
export const parseVersion = (text: string): string | undefined => /(\d+\.\d+\.\d+)/.exec(text)?.[1];

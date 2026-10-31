import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BOARD_ANSWERER } from "../src/answerer/launcher.ts";
import { PERMISSION_HOST } from "../src/answerer/permission-host.ts";
import { buildLaunch, type CaseRun, cleanEnv, parseVersion } from "../src/command.ts";
import {
  PreflightError,
  pluginDirOf,
  preflightPlugin,
  REPOSITORY_ROOT,
  readPluginServer,
  STUB_PLUGIN,
} from "../src/plugin.ts";
import { DEFAULTS } from "../src/settings.ts";
import { useScratch } from "./support/scratch.ts";

const scratch = useScratch();

const caseRun = (overrides: Partial<CaseRun> = {}): CaseRun => ({
  caseId: "S1",
  arm: "askboard",
  run: 1,
  dir: "/runs/r1/cases/S1-askboard-1",
  project: "/tmp/askboard-bench-x",
  sessionId: "11111111-2222-3333-4444-555555555555",
  pluginDir: "/repo",
  settings: DEFAULTS,
  ...overrides,
});

const USER_ENV = {
  HOME: "/home/u",
  USER: "u",
  LOGNAME: "u",
  SHELL: "/bin/zsh",
  PATH: "/usr/bin",
  TERM: "xterm",
  LANG: "en_US.UTF-8",
  TMPDIR: "/tmp",
  ANTHROPIC_API_KEY: "sk-test",
  CLAUDE_CODE_SESSION_ID: "parent-session",
  CLAUDECODE: "1",
  BROWSER: "firefox",
  SECRET_THING: "x",
};

describe("plugin directories", () => {
  test("e1 is the repository root, stub is the test stub, and an override wins", () => {
    expect(pluginDirOf("e1")).toBe(REPOSITORY_ROOT);
    expect(pluginDirOf("stub")).toBe(STUB_PLUGIN);
    expect(pluginDirOf("e1", "/elsewhere")).toBe("/elsewhere");
  });

  test("the stub plugin's server, with its variables substituted", () => {
    expect(readPluginServer(STUB_PLUGIN, "/project")).toEqual({
      command: "bun",
      args: [join(STUB_PLUGIN, "server.ts")],
      env: { CLAUDE_PROJECT_DIR: "/project" },
    });
    expect(() => preflightPlugin("stub", STUB_PLUGIN)).not.toThrow();
  });

  test("a server declared in the plugin's .mcp.json, or a missing one", () => {
    const dir = scratch("bench-plugin-");
    mkdirSync(join(dir, ".claude-plugin"));
    writeFileSync(join(dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "askboard" }));
    expect(() => readPluginServer(dir, "/p")).toThrow(
      new PreflightError(`the plugin at ${dir} declares no server "askboard"`),
    );
    writeFileSync(
      join(dir, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          askboard: { command: "bun", args: [`\${CLAUDE_PLUGIN_ROOT}/dist/askboard.mjs`] },
        },
      }),
    );
    expect(readPluginServer(dir, "/p")).toEqual({
      command: "bun",
      args: [`${dir}/dist/askboard.mjs`],
      env: {},
    });
    expect(() => preflightPlugin("e1", dir)).toThrow(
      new PreflightError(
        `E1's session process is not built: ${dir}/dist/askboard.mjs is missing; run bun run build`,
      ),
    );
    mkdirSync(join(dir, "dist"));
    writeFileSync(join(dir, "dist", "askboard.mjs"), "");
    expect(() => preflightPlugin("e1", dir)).not.toThrow();
  });

  test("no manifest", () => {
    const dir = scratch("bench-plugin-");
    expect(() => readPluginServer(dir, "/p")).toThrow(
      new PreflightError(`no plugin manifest at ${join(dir, ".claude-plugin", "plugin.json")}`),
    );
  });
});

describe("cleanEnv", () => {
  test("keeps only what a login shell and Claude Code's credentials need", () => {
    expect(cleanEnv(USER_ENV)).toEqual({
      HOME: "/home/u",
      USER: "u",
      LOGNAME: "u",
      SHELL: "/bin/zsh",
      PATH: "/usr/bin",
      TERM: "xterm",
      LANG: "en_US.UTF-8",
      TMPDIR: "/tmp",
      ANTHROPIC_API_KEY: "sk-test",
    });
  });
});

describe("buildLaunch", () => {
  test("the AskBoard arm: pinned flags, --plugin-dir, no --strict-mcp-config, BROWSER", () => {
    const launch = buildLaunch(caseRun(), "the prompt", USER_ENV);
    expect(launch.command).toBe("claude");
    expect(launch.cwd).toBe("/tmp/askboard-bench-x");
    expect(launch.args).toEqual([
      "-p",
      "the prompt",
      "--session-id",
      "11111111-2222-3333-4444-555555555555",
      "--model",
      "claude-opus-5-5",
      "--effort",
      "medium",
      "--setting-sources",
      "",
      "--settings",
      "/runs/r1/cases/S1-askboard-1/run-settings.json",
      "--tools",
      "ToolSearch",
      "--allowedTools",
      "mcp__plugin_askboard_askboard__ask,mcp__plugin_askboard_askboard__collect,mcp__askboard__ask,mcp__askboard__collect,ToolSearch",
      "--max-turns",
      "12",
      "--output-format",
      "stream-json",
      "--verbose",
      "--plugin-dir",
      "/repo",
    ]);
    expect(launch.args).not.toContain("--strict-mcp-config");
    expect(launch.env).toEqual({
      ...cleanEnv(USER_ENV),
      DISABLE_AUTOUPDATER: "1",
      ENABLE_TOOL_SEARCH: "true",
      FORCE_PROMPT_CACHING_5M: "1",
      BROWSER: "/runs/r1/cases/S1-askboard-1/browser.sh",
    });
    const files = Object.fromEntries(launch.files.map((file) => [file.path, file.content]));
    expect(JSON.parse(files["/runs/r1/cases/S1-askboard-1/run-settings.json"] ?? "")).toEqual({});
    expect(files["/runs/r1/cases/S1-askboard-1/browser.sh"]).toContain(BOARD_ANSWERER);
    expect(JSON.parse(files["/runs/r1/cases/S1-askboard-1/plan.json"] ?? "")).toHaveLength(2);
    expect(launch.envNames).toEqual(Object.keys(launch.env).sort());
  });

  test("S6 adds the Agent tool; the stub session adds the legacy handshake", () => {
    const launch = buildLaunch(
      caseRun({ caseId: "S6", settings: { ...DEFAULTS, session: "stub" } }),
      "p",
      USER_ENV,
    );
    const tools = launch.args[launch.args.indexOf("--tools") + 1];
    expect(tools).toBe("ToolSearch,Agent");
    expect(launch.args[launch.args.indexOf("--allowedTools") + 1]).toEndWith(",ToolSearch,Agent");
    expect(launch.env.MCP_PROTOCOL_NEGOTIATION).toBe("legacy");
  });

  test("the AskUserQuestion arm: the hook in the run's settings and the permission host", () => {
    const run = caseRun({
      arm: "auq",
      dir: "/runs/r1/cases/S1-auq-1",
      settings: { ...DEFAULTS, cacheTtl: "1h" },
    });
    const launch = buildLaunch(run, "p", USER_ENV);
    expect(launch.args).not.toContain("--plugin-dir");
    expect(launch.args[launch.args.indexOf("--tools") + 1]).toBe("AskUserQuestion,ToolSearch");
    expect(launch.args[launch.args.indexOf("--allowedTools") + 1]).toBe("ToolSearch");
    expect(launch.args.slice(-4)).toEqual([
      "--permission-prompt-tool",
      "mcp__bench__approve",
      "--mcp-config",
      "/runs/r1/cases/S1-auq-1/mcp.json",
    ]);
    expect(launch.env).toMatchObject({
      ENABLE_PROMPT_CACHING_1H: "1",
      MCP_PROTOCOL_NEGOTIATION: "legacy",
    });
    expect(launch.env.BROWSER).toBeUndefined();
    expect(launch.env.FORCE_PROMPT_CACHING_5M).toBeUndefined();
    const files = Object.fromEntries(launch.files.map((file) => [file.path, file.content]));
    const settings = JSON.parse(files["/runs/r1/cases/S1-auq-1/run-settings.json"] ?? "");
    const [entry] = settings.hooks.PreToolUse;
    expect(entry.matcher).toBe("AskUserQuestion");
    expect(entry.hooks[0].command).toContain("auq-hook-main.ts");
    expect(entry.hooks[0].command).toContain("'/runs/r1/cases/S1-auq-1/plan.json'");
    const mcp = JSON.parse(files["/runs/r1/cases/S1-auq-1/mcp.json"] ?? "");
    expect(mcp.mcpServers.bench.args[0]).toBe(PERMISSION_HOST);
  });

  test("the baseline: the AskBoard arm's tools without AskBoard, ended after one request", () => {
    const launch = buildLaunch(
      caseRun({ arm: "baseline", dir: "/runs/r1/cases/S1-baseline-1" }),
      "p",
      USER_ENV,
    );
    const askboard = buildLaunch(caseRun(), "p", USER_ENV);
    const flag = (args: readonly string[], name: string) => args[args.indexOf(name) + 1];
    expect(flag(launch.args, "--tools")).toBe(flag(askboard.args, "--tools"));
    expect(flag(launch.args, "--allowedTools")).toBe(flag(askboard.args, "--allowedTools"));
    expect(flag(launch.args, "--max-turns")).toBe("1");
    expect(launch.args).not.toContain("--plugin-dir");
    expect(launch.args).not.toContain("--permission-prompt-tool");
    expect(launch.env.BROWSER).toBeUndefined();
    expect(launch.env.MCP_PROTOCOL_NEGOTIATION).toBeUndefined();
    expect(launch.files.map((file) => file.path).sort()).toEqual([
      "/runs/r1/cases/S1-baseline-1/plan.json",
      "/runs/r1/cases/S1-baseline-1/run-settings.json",
    ]);
  });

  test("without the permission host, no MCP configuration and no legacy handshake", () => {
    const run = caseRun({ arm: "auq", settings: { ...DEFAULTS, auqPermissionHost: false } });
    const launch = buildLaunch(run, "p", USER_ENV);
    expect(launch.args).not.toContain("--permission-prompt-tool");
    expect(launch.args).not.toContain("--mcp-config");
    expect(launch.env.MCP_PROTOCOL_NEGOTIATION).toBeUndefined();
    expect(launch.files.map((file) => file.path)).not.toContain(`${run.dir}/mcp.json`);
  });
});

describe("parseVersion", () => {
  test("reads the version claude --version prints", () => {
    expect(parseVersion("2.1.314 (Claude Code)\n")).toBe("2.1.314");
    expect(parseVersion("nothing")).toBeUndefined();
  });
});

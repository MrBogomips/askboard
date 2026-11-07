import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  ASK_USER_QUESTION,
  ASKBOARD_TOOL_PREFIXES,
  askBoardTool,
  HOOK_EVENTS,
} from "../src/index.ts";

// The plugin's hooks file (task 6.6; packaging spec, "The hooks file"; design decision 6): four
// hooks, each running the built bundle in hook mode with a 5 s timeout, matching AskBoard's tools
// under both name forms (Consistency Conventions, MCP names), and the mod's module, which
// `bun run build:mod` writes beside it (task 7.6).

type Command = { type: string; command: string; timeout: number };
type Group = { matcher?: string; hooks: Command[] };
type HooksFile = { hooks: Record<string, Group[]>; modules?: unknown };

const FILE = join(import.meta.dir, "..", "..", "..", "hooks", "hooks.json");
const file = (await Bun.file(FILE).json()) as HooksFile;

const commandOf = (event: string) => `sh "\${CLAUDE_PLUGIN_ROOT}/scripts/askboard" hook ${event}`;

// Claude Code reads a matcher as a regular expression over the whole tool name.
const matches = (matcher: string, toolName: string) =>
  new RegExp(`^(?:${matcher})$`).test(toolName);

const TOOLS = ["ask", "collect", "update", "fetch", "snapshot"];
const fullNames = (tool: string) => ASKBOARD_TOOL_PREFIXES.map((prefix) => `${prefix}${tool}`);

describe("hooks/hooks.json", () => {
  test("declares the runner's events, and the mod's module beside it (task 7.6)", () => {
    expect(Object.keys(file.hooks)).toEqual([...HOOK_EVENTS]);
    expect(file.modules).toEqual(["./askboard-mod.js"]);
  });

  test("has four hooks, each running the bundle in hook mode for its event within 5 s", () => {
    const entries = Object.entries(file.hooks).flatMap(([event, groups]) =>
      groups.map((group) => ({ event, group })),
    );
    expect(entries).toHaveLength(4);
    for (const { event, group } of entries) {
      expect(group.hooks).toEqual([{ type: "command", command: commandOf(event), timeout: 5 }]);
    }
  });

  test("records every AskBoard tool under both name forms, and nothing else", () => {
    const [records, rule, ...rest] = file.hooks.PreToolUse ?? [];
    expect(rest).toEqual([]);
    expect(records?.matcher).toBe("mcp__plugin_askboard_askboard__.*|mcp__askboard__.*");
    for (const name of TOOLS.flatMap(fullNames)) {
      expect(matches(records?.matcher ?? "", name)).toBe(true);
      expect(askBoardTool(name)).toBeDefined();
    }
    for (const name of [
      "AskUserQuestion",
      "Bash",
      "mcp__other__ask",
      "mcp__plugin_other_askboard__ask",
    ]) {
      expect(matches(records?.matcher ?? "", name)).toBe(false);
    }
    expect(rule?.matcher).toBe(ASK_USER_QUESTION);
  });

  test("shows the terminal link after ask alone, under both name forms", () => {
    const [link, ...rest] = file.hooks.PostToolUse ?? [];
    expect(rest).toEqual([]);
    expect(link?.matcher).toBe("mcp__plugin_askboard_askboard__ask|mcp__askboard__ask");
    for (const tool of TOOLS) {
      for (const name of fullNames(tool)) {
        expect(matches(link?.matcher ?? "", name)).toBe(tool === "ask");
      }
    }
  });

  test("guards every subagent's stop, with no matcher", () => {
    const [guard, ...rest] = file.hooks.SubagentStop ?? [];
    expect(rest).toEqual([]);
    expect(guard?.matcher).toBeUndefined();
  });
});

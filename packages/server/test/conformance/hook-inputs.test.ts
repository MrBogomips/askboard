import { describe, expect, test } from "bun:test";
import { askResultOf, recordOf, stopOf } from "@askboard/hooks";
import { postToolUseInput, preToolUseInput, subagentStopInput } from "./hook-inputs.ts";

// The hook inputs the conformance suite feeds the built bundle's hooks (push delivery, task 9.1):
// Claude Code's, which the hooks read as they read Claude Code's own.

const SESSION = { project: "/Users/paola/src/order-service" };
const REVIEWER = { id: "a3f9c1d27b8e4f60", type: "code-reviewer" };
const NOW = new Date("2026-10-31T09:41:27.000Z");
const ASK_RESULT = {
  versions: { result: "1.0", output: "1.0" },
  epoch: "k3x9",
  askId: "order-db-choice-x7k2",
  state: "waiting",
  cursor: "k3x9.0",
  board: "http://127.0.0.1:47213/b/order-db-choice-x7k2?t=pV3xK9qLmT2wR7nB4cYh8A",
};

describe("Claude Code's hook inputs", () => {
  test("a subagent's PreToolUse names the agent, its folder, the tool use and the asks", () => {
    const input = preToolUseInput(SESSION, REVIEWER, "collect", { asks: [{ askId: "a" }] }, "t1");
    expect(input).toMatchObject({
      hook_event_name: "PreToolUse",
      tool_name: "mcp__plugin_askboard_askboard__collect",
      tool_use_id: "t1",
      cwd: SESSION.project,
      agent_id: REVIEWER.id,
      agent_type: REVIEWER.type,
    });
    expect(recordOf(input, input.tool_name, NOW)).toEqual({
      version: "1.0",
      agent_id: REVIEWER.id,
      agent_type: REVIEWER.type,
      cwd: SESSION.project,
      tool_use_id: "t1",
      tool_name: "mcp__plugin_askboard_askboard__collect",
      askIds: ["a"],
      timestamp: NOW.toISOString(),
    });
  });

  test("the main conversation's names no agent", () => {
    const input = preToolUseInput(SESSION, undefined, "ask", { askId: "a" }, "t2");
    expect(input).not.toHaveProperty("agent_id");
    expect(input).not.toHaveProperty("agent_type");
    expect(recordOf(input, input.tool_name, NOW)).not.toHaveProperty("agent_id");
  });

  test("PostToolUse carries the tool's result as Claude Code gives it: its content blocks", () => {
    const text = JSON.stringify(ASK_RESULT);
    const ok = postToolUseInput(SESSION, undefined, { askId: "a" }, "t3", { isError: false, text });
    expect(ok).toMatchObject({ hook_event_name: "PostToolUse", tool_use_id: "t3" });
    expect(askResultOf(ok.tool_response) as unknown).toEqual(ASK_RESULT);
    const failed = postToolUseInput(SESSION, REVIEWER, { askId: "a" }, "t4", {
      isError: true,
      text,
    });
    expect(failed.tool_response).toEqual({ content: [{ type: "text", text }], isError: true });
    expect(askResultOf(failed.tool_response)).toBeUndefined();
  });

  test("SubagentStop names the agent and whether a stop hook is already active", () => {
    const input = subagentStopInput(SESSION, REVIEWER, true);
    expect(input).toMatchObject({ hook_event_name: "SubagentStop", stop_hook_active: true });
    expect(stopOf(input)).toEqual({
      version: "1.0",
      agent_id: REVIEWER.id,
      agent_type: REVIEWER.type,
      stop_hook_active: true,
    });
    const side = subagentStopInput(SESSION, { id: "aside0001", type: "" }, false);
    expect(stopOf(side)).toMatchObject({ agent_type: "", stop_hook_active: false });
  });
});

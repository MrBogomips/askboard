import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION, originMessage } from "../src/index.ts";
import { validateOrigin } from "../src/validate.ts";

// Who asked and where (board-host spec, "Who asked and the agent status on the board"; design
// decision 12; FR-24): the context header's first row as the board protocol's origin message, built
// from the ask's origin, its agent's name, the expected answerer and the session project, with no
// Node or browser API, so that board-host and ask-core build the same row (AD-1). A field the
// contract cannot take is left out, and the board shows it as unknown.

const version = BOARD_PROTOCOL_VERSION;
const PROJECT = "/Users/paola/src/order-service";

const REVIEWER = {
  label: "Subagent code-reviewer",
  ordinal: 2,
  directory: "services/orders",
  branch: "fix/retry",
  worktree: "order-service-fix-retry",
} as const;

describe("the origin message", () => {
  test("of an owned ask: who asked, for whom, the project's name and the origin's fields", () => {
    const message = originMessage(PROJECT, {
      origin: REVIEWER,
      agentName: "Retry review",
      forUser: "Marco Rossi",
    });
    expect(message).toEqual({
      version,
      type: "origin",
      who: { label: "Subagent code-reviewer", name: "Retry review", ordinal: 2 },
      forUser: "Marco Rossi",
      project: "order-service",
      directory: "services/orders",
      branch: "fix/retry",
      worktree: "order-service-fix-retry",
    });
    expect(validateOrigin(message).ok).toBe(true);
  });

  test("of an unchecked ask: Agent, or the agent's name, and the project only", () => {
    expect(originMessage(PROJECT, {})).toEqual({
      version,
      type: "origin",
      who: { label: "Agent" },
      project: "order-service",
    });
    expect(originMessage(`${PROJECT}/`, { agentName: "Estimate review" })).toEqual({
      version,
      type: "origin",
      who: { label: "Agent", name: "Estimate review" },
      project: "order-service",
    });
  });

  test("leaves out a field longer than the contract allows, which then shows as unknown", () => {
    const message = originMessage(PROJECT, {
      origin: {
        label: "Main agent",
        directory: ".",
        branch: "b".repeat(1025),
        worktree: "w".repeat(256),
      },
    });
    expect(message).toEqual({
      version,
      type: "origin",
      who: { label: "Main agent" },
      project: "order-service",
      directory: ".",
    });
    expect(validateOrigin(message).ok).toBe(true);
    const long = originMessage(`/src/${"p".repeat(256)}`, {
      origin: { label: "l".repeat(513), directory: `/${"d".repeat(4096)}` },
    });
    expect(long).toEqual({ version, type: "origin", who: { label: "Agent" } });
  });

  test("names no directory for an origin without one, as without a root (AD-12)", () => {
    const message = originMessage(PROJECT, { origin: { label: "Subagent code-reviewer" } });
    expect(message).toEqual({
      version,
      type: "origin",
      who: { label: "Subagent code-reviewer" },
      project: "order-service",
    });
    expect(validateOrigin(message).ok).toBe(true);
  });

  test("names no project for the file system's root", () => {
    expect(originMessage("/", {})).toEqual({ version, type: "origin", who: { label: "Agent" } });
  });
});

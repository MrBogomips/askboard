import { describe, expect, test } from "bun:test";
import { isAbsolute } from "node:path";
import { RESULT_MAX_CHARS, RESULT_VERSIONS, SCHEMA_IDS } from "@askboard/contract";
import { lifecycleSnapshotResult } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { type Binding, BoardSetupError, type SnapshotOutcome } from "@askboard/core";
import { ownerRefusalText } from "../../src/mcp-tools/owner-refusal.ts";
import { connect, depsWith, EPOCH, type FakeCore, fakeCore, jsonOf, textOf } from "./helpers.ts";

// MCP adapter spec: Taking a Snapshot with the tool, Snapshot of a discarded ask, Snapshot
// refusals, Snapshot of an unchecked ask, The tool reads nothing to the agent (snapshot, task 5.2),
// against a fake core.

type Saved = Extract<SnapshotOutcome, { outcome: "saved" }>;

const A = lifecycleSnapshotResult.askId;
const PATH = lifecycleSnapshotResult.path;
// A taken Snapshot's state is never `discarded`, which the result's type also allows.
const STATE = lifecycleSnapshotResult.state as Saved["state"];
const FOLDER = "/home/sara/shop/.askboard/snapshots";
const OWNER: Binding = { ownerKey: "owner-1" };
const TOOL_USE_ID = "toolu_01HqVb7cXz9KpL3mN5rT8wYe";
const META = { "claudecode/toolUseId": TOOL_USE_ID };

// The snapshot unit's subclass, which mcp-tools may not import (AD-1): ask-core's error, renamed.
class SnapshotBuildError extends BoardSetupError {
  override readonly name = "SnapshotBuildError";
}

const saved = (unchecked: boolean, path = PATH): SnapshotOutcome => ({
  outcome: "saved",
  path,
  state: STATE,
  unchecked,
});

// A core whose `snapshot` gives `outcome`, or rejects with it when it is an error.
const giving = (outcome: SnapshotOutcome | Error, binding?: Binding): FakeCore =>
  fakeCore({
    ...(binding === undefined ? {} : { binding }),
    snapshot: async () => {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  });

const snapshotter = async (core: FakeCore) => {
  const { deps, written } = depsWith(core);
  const { client, close } = await connect(deps);
  const call = (args: unknown, meta?: Record<string, unknown>) =>
    client.callTool({
      name: "snapshot",
      arguments: args as never,
      ...(meta === undefined ? {} : { _meta: meta }),
    });
  return { call, close, written };
};

// The one call `snapshot` makes ask-core take, after binding: never `read` or `markRead`, so no
// `received` moves and the agent's cursor covers every event it has not collected (AD-3).
const ONLY_CALLS = ["bind", `snapshot ${A}`];

describe("taking a Snapshot with the tool", () => {
  test("after the user answered, the result names the file's absolute path and the state, and nothing else", async () => {
    const core = giving(saved(false), OWNER);
    const { call, close } = await snapshotter(core);
    const result = await call({ askId: A }, META);
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result) as Record<string, unknown>;
    expect(json).toEqual({ ...lifecycleSnapshotResult, epoch: EPOCH });
    expect(Object.keys(json).sort()).toEqual(["askId", "epoch", "path", "state", "versions"]);
    expect(isAbsolute(json.path as string)).toBe(true);
    expect(validateAgainst(SCHEMA_IDS.snapshotResult, json).ok).toBe(true);
    expect(core.calls).toEqual(ONLY_CALLS);
    await close();
  });

  test("binds the call by its toolUseId, the tool and the ask's ID, and hands the binding to ask-core", async () => {
    const core = giving(saved(false), OWNER);
    const { call, close } = await snapshotter(core);
    await call({ askId: A }, META);
    expect(core.identities).toEqual([{ toolUseId: TOOL_USE_ID, tool: "snapshot", askIds: [A] }]);
    expect(core.snapshots).toEqual([{ takenBy: "agent", caller: OWNER }]);
    // ask-core checks the discard, then the owner: the tool runs no owner check of its own.
    expect(core.calls).not.toContain(`ownerRefusal ${A}`);
    await close();
  });

  test("a call without an agent record binds with no toolUseId and hands ask-core no binding", async () => {
    const core = giving(saved(true));
    const { call, close } = await snapshotter(core);
    await call({ askId: A });
    expect(core.identities).toEqual([{ tool: "snapshot", askIds: [A] }]);
    expect(core.snapshots).toEqual([{ takenBy: "agent" }]);
    await close();
  });

  test.each([
    [{ askId: A, path: "/tmp/board.html" }, "path"],
    [{ askId: A, folder: "/tmp" }, "folder"],
    [{}, "askId"],
    [{ askId: "not an id!" }, "askId"],
  ])(
    "a request outside the envelope (%j) is an error naming %s, and reaches no ask",
    async (args, field) => {
      const core = giving(saved(false));
      const { call, close } = await snapshotter(core);
      const result = await call(args);
      expect(result.isError).toBe(true);
      expect(textOf(result)).toStartWith("The snapshot request was refused");
      expect(textOf(result)).toContain(field);
      expect(core.calls).toEqual([]);
      await close();
    },
  );
});

describe("a Snapshot of a discarded ask", () => {
  test("is the typed discarded result naming the ask, not an error", async () => {
    const core = giving({ outcome: "discarded" });
    const { call, close } = await snapshotter(core);
    const result = await call({ askId: A });
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result);
    expect(json).toEqual({
      versions: RESULT_VERSIONS,
      epoch: EPOCH,
      askId: A,
      outcome: "discarded",
    });
    expect(validateAgainst(SCHEMA_IDS.snapshotOutcome, json).ok).toBe(true);
    expect(core.calls).toEqual(ONLY_CALLS);
    await close();
  });
});

describe("Snapshot refusals", () => {
  test.each([
    [
      "other-owner",
      `The ask "${A}" belongs to another agent, so this snapshot was refused: send snapshot only for asks you sent.`,
    ],
    [
      "no-record",
      `The ask "${A}" belongs to an agent, and this call carried no agent record, so AskBoard cannot tell that it is yours. Send the snapshot again.`,
    ],
  ] as const)(
    "ask-core's %s refusal is the one-ask refusal text, naming the ask",
    async (why, text) => {
      const { call, close } = await snapshotter(giving({ outcome: "refused", why }));
      const result = await call({ askId: A });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toBe(ownerRefusalText(why, A, "snapshot"));
      expect(textOf(result)).toBe(text);
      await close();
    },
  );

  test("no project root is an error naming CLAUDE_PROJECT_DIR and saying no Snapshot was taken", async () => {
    const core = giving({ outcome: "no-project-root", variable: "CLAUDE_PROJECT_DIR" });
    const { call, close } = await snapshotter(core);
    const result = await call({ askId: A });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      `No Snapshot was taken of the ask "${A}": CLAUDE_PROJECT_DIR is not set in this session, and AskBoard saves Snapshots only under the project folder it names. Nothing was written; tell the user, if they asked for the Snapshot.`,
    );
    await close();
  });

  test("a folder that cannot take the file is an error naming the folder and the reason", async () => {
    const core = giving({ outcome: "write-failed", folder: FOLDER, code: "EACCES" });
    const { call, close } = await snapshotter(core);
    const result = await call({ askId: A });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      `No Snapshot was taken of the ask "${A}": the Snapshot folder ${FOLDER} could not take the file (EACCES), and nothing was left in it. Tell the user, who can fix the folder, then call snapshot again.`,
    );
    await close();
  });

  test.each([
    ["BoardSetupError (VIEW_MISSING)", new BoardSetupError("VIEW_MISSING", "no view build")],
    [
      "SnapshotBuildError (VIEW_FILE_INVALID)",
      new SnapshotBuildError("VIEW_FILE_INVALID", "a notice text is missing"),
    ],
  ])(
    "a view build that cannot be read (%s) is an error saying not to call again; stderr names only its class",
    async (named, error) => {
      const { call, close, written } = await snapshotter(giving(error));
      const result = await call({ askId: A });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toBe(
        "AskBoard cannot take Snapshots: its view build is missing or damaged, so nothing was written. Do not call snapshot again: tell the user to rebuild or reinstall AskBoard.",
      );
      expect(written).toEqual([`askboard: snapshot failed: ${named}`]);
      await close();
    },
  );

  test("any other failure inside is the server's error, and stderr names only its class", async () => {
    const { call, close, written } = await snapshotter(giving(new Error(`snapshot of ${A}`)));
    const result = await call({ askId: A });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("AskBoard's snapshot failed inside. Send the call again.");
    expect(written).toEqual(["askboard: snapshot failed: Error"]);
    await close();
  });
});

describe("a Snapshot of an unchecked ask", () => {
  test("carries unchecked: true, as collect's entry for that ask does", async () => {
    const { call, close } = await snapshotter(giving(saved(true)));
    const json = jsonOf(await call({ askId: A }));
    expect(json).toEqual({ ...lifecycleSnapshotResult, epoch: EPOCH, unchecked: true });
    expect(validateAgainst(SCHEMA_IDS.snapshotResult, json).ok).toBe(true);
    await close();
  });
});

describe("the result's size", () => {
  test("every result stays under 30,000 characters, at the longest path and folder", async () => {
    const long = `/${"p".repeat(4_095)}`;
    const outcomes: SnapshotOutcome[] = [
      saved(true, long),
      { outcome: "discarded" },
      { outcome: "refused", why: "other-owner" },
      { outcome: "no-project-root", variable: "CLAUDE_PROJECT_DIR" },
      { outcome: "write-failed", folder: `/${"f".repeat(40_000)}`, code: "ENOSPC" },
    ];
    const askId = "a".repeat(64);
    for (const outcome of outcomes) {
      const { call, close } = await snapshotter(giving(outcome));
      expect(textOf(await call({ askId })).length).toBeLessThan(RESULT_MAX_CHARS);
      await close();
    }
  });
});

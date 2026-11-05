import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ASKBOARD_GITIGNORE, SCHEMA_IDS, SNAPSHOT_FOLDER } from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import { callAs } from "./hook-runs.ts";
import { removeShortFolders } from "./modes.ts";
import { askAndConnect, askOf, startClaudeSession, subagent } from "./push-steps.ts";
import { cleanUp, startSession } from "./session.ts";

// The conformance suite's Snapshots (snapshot task 9.2): the built session process on Bun or Node
// 24, driven over stdio by the MCP client, in each of AD-1's configurations. The `snapshot` tool
// takes a Snapshot of an open ask under the session's project folder, names two Snapshots of one
// ask apart, answers a session started without `CLAUDE_PROJECT_DIR` with the variable's name and
// writes nothing, gives a typed `discarded` for an ask this epoch does not hold, refuses another
// agent's ask with hooks, and marks an ask no hook recorded `unchecked`. The `discarded` of a
// live discard needs the board's two-minute grace: ask-core's unit tests cover it.

afterEach(async () => {
  await cleanUp();
  removeShortFolders();
});

const snapshotsIn = (project: string): string[] => {
  const folder = join(project, SNAPSHOT_FOLDER);
  return existsSync(folder) ? readdirSync(folder).sort() : [];
};

describe("the snapshot tool", () => {
  test("saves under the project's .askboard/snapshots, with a .gitignore, and says the ask is unchecked without hooks", async () => {
    const session = await startSession();
    const askId = "snap-conf-one-k3f9";
    expect((await session.call("ask", askOf(askId))).isError).toBe(false);
    const taken = await session.call("snapshot", { askId });
    expect(taken.isError).toBe(false);
    const validation = validateAgainst(SCHEMA_IDS.snapshotResult, taken.json);
    expect(validation.ok ? [] : validation.problems).toEqual([]);
    const { path, state, unchecked } = taken.json as {
      path: string;
      state: string;
      unchecked?: true;
    };
    expect(state).toBe("waiting");
    expect(unchecked).toBe(true);
    expect(dirname(path)).toBe(join(realpathSync(session.project), SNAPSHOT_FOLDER));
    expect(basename(path)).toStartWith(`${askId}-`);
    expect(snapshotsIn(session.project)).toEqual([basename(path)]);
    const ignore = readFileSync(join(session.project, ".askboard", ".gitignore"), "utf8");
    expect(ignore.split("\n").filter((line) => line !== "")).toEqual([...ASKBOARD_GITIGNORE]);
    expect(await session.end()).toBe(0);
    // The file outlives the session.
    expect(existsSync(path)).toBe(true);
  });

  test("two Snapshots of one ask have two names", async () => {
    const session = await startSession();
    const askId = "snap-conf-two-k3f9";
    await session.call("ask", askOf(askId));
    const first = (await session.call("snapshot", { askId })).json as { path: string };
    const second = (await session.call("snapshot", { askId })).json as { path: string };
    expect(second.path).not.toBe(first.path);
    expect(snapshotsIn(session.project)).toHaveLength(2);
    expect(await session.end()).toBe(0);
  });

  test("a session started without CLAUDE_PROJECT_DIR refuses, names the variable and writes nothing", async () => {
    const session = await startSession({ without: ["CLAUDE_PROJECT_DIR"] });
    const askId = "snap-conf-noroot-k3f9";
    await session.call("ask", askOf(askId));
    const taken = await session.call("snapshot", { askId });
    expect(taken.isError).toBe(true);
    expect(taken.text).toContain("CLAUDE_PROJECT_DIR");
    expect(existsSync(join(session.project, ".askboard"))).toBe(false);
    expect(await session.end()).toBe(0);
  });

  test("an ask this epoch does not hold, as after a restart, gets the typed discarded", async () => {
    const session = await startSession();
    const taken = await session.call("snapshot", { askId: "snap-conf-gone-k3f9" });
    expect(taken.isError).toBe(false);
    expect(taken.json).toMatchObject({ outcome: "discarded", askId: "snap-conf-gone-k3f9" });
    const validation = validateAgainst(SCHEMA_IDS.snapshotOutcome, taken.json);
    expect(validation.ok ? [] : validation.problems).toEqual([]);
    expect(snapshotsIn(session.project)).toEqual([]);
    expect(await session.end()).toBe(0);
  });

  test("with hooks: the owner's Snapshot is saved, another agent's and an unrecorded call are refused", async () => {
    const owner = subagent("a2b4c6d8e0f13579a", "code-reviewer");
    const other = subagent("a9f7e5d3c1b02468b", "test-runner");
    const { session } = await startClaudeSession({ mod: false });
    const askId = "snap-conf-owner-k3f9";
    await askAndConnect(session, owner, askId);
    const theirs = await callAs(session, other, "snapshot", { askId });
    expect(theirs.outcome.isError).toBe(true);
    expect(theirs.outcome.text).toContain(`The ask "${askId}" belongs to another agent`);
    const unrecorded = await session.call("snapshot", { askId });
    expect(unrecorded.isError).toBe(true);
    expect(unrecorded.text).toContain("this call carried no agent record");
    expect(snapshotsIn(session.project)).toEqual([]);
    const mine = await callAs(session, owner, "snapshot", { askId });
    expect(mine.outcome.isError).toBe(false);
    expect(mine.outcome.json).not.toHaveProperty("unchecked");
    expect(snapshotsIn(session.project)).toHaveLength(1);
    expect(await session.end()).toBe(0);
  });
});

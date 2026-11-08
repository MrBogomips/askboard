import { describe, expect, test } from "bun:test";
import { GRACE_PERIOD_MS } from "@askboard/contract";
import { lifecycleDraftRecord, lifecycleSnapshotData } from "@askboard/contract/fixtures";
import { validateSnapshotData } from "@askboard/contract/validate";
import { SnapshotWriteError } from "../src/index.ts";
import { type FakeConfigOptions, fakeConfig, plainChoiceAsk } from "./fakes.ts";
import { areasAsk, command, LIFECYCLE_ID } from "./lifecycle-fakes.ts";
import {
  asFixtureEpoch,
  fakeWriter,
  lifecycleSnapshotCore,
  SHOP_DIR,
  SHOP_OWNER,
  SNAPSHOT_FOLDER,
  SNAPSHOT_PATH,
  type SnapshotFakeOptions,
  snapshotCoreWith,
  withEnglish,
} from "./snapshot-fakes.ts";

// Core spec: Taking a Snapshot, No Snapshot of a discarded ask (snapshot task 2.1, design decision
// 3): the `snapshot` command's outcomes against a fake writer, which E7's `CorePorts` field carries
// with the display project folder of the origin row.

const AGENT = { takenBy: "agent" } as const;
const BOARD = { takenBy: "user", unsentWork: false } as const;
const WHEN = "2026-10-31T14:05:12Z";

/** The lifecycle ask, unchecked, on a core with this writer. */
const lifecycleWith = async (writer = fakeWriter(), options: SnapshotFakeOptions = {}) => {
  const fixture = snapshotCoreWith({ snapshots: { writer: writer.writer }, ...options });
  const created = await fixture.core.ask(areasAsk());
  if (created.kind !== "created") throw new Error(`the ask was not created: ${created.kind}`);
  return { ...fixture, ...writer };
};

const valid = (data: unknown) => {
  const checked = validateSnapshotData(data);
  expect(checked.ok ? [] : checked.problems).toEqual([]);
};

describe("taking a Snapshot", () => {
  test("of an open ask: the writer gets the answer and the open question, and its path is the result", async () => {
    const { core, written } = await lifecycleWith();
    const answer = {
      type: "answer",
      itemId: "region",
      rev: 1,
      choice: ["EU"],
      when: WHEN,
    } as const;
    core.act(LIFECYCLE_ID, command([answer]));
    expect(await core.snapshot(LIFECYCLE_ID, AGENT)).toEqual({
      outcome: "saved",
      path: SNAPSHOT_PATH,
      state: "partly-answered",
      unchecked: true,
    });
    expect(written).toHaveLength(1);
    const [data] = written;
    expect(data?.state.questions.slice(0, 2)).toMatchObject([
      { itemId: "region", state: "answered", answer: { choice: ["EU"] } },
      { itemId: "payment", state: "open" },
    ]);
    expect(data?.events.map(({ event }) => event.cursor)).toEqual([`${core.epoch}.1`]);
    valid(data);
  });

  test("the lifecycle ask: the data is the contract's fixture, its time from the clock and its origin from E7's port", async () => {
    const writer = fakeWriter();
    const { core } = await lifecycleSnapshotCore({ writer: writer.writer, projectDir: SHOP_DIR });
    const outcome = await core.snapshot(LIFECYCLE_ID, {
      ...AGENT,
      caller: { ownerKey: SHOP_OWNER },
    });
    expect(outcome).toEqual({
      outcome: "saved",
      path: SNAPSHOT_PATH,
      state: "answered",
      unchecked: false,
    });
    const [data] = writer.written;
    expect(data && asFixtureEpoch(data, core.epoch)).toEqual(withEnglish(lifecycleSnapshotData));
  });

  test("without the display project folder the data holds no origin", async () => {
    const writer = fakeWriter();
    const { core } = await lifecycleSnapshotCore({ writer: writer.writer });
    await core.snapshot(LIFECYCLE_ID, { ...AGENT, caller: { ownerKey: SHOP_OWNER } });
    expect(writer.written[0]).not.toHaveProperty("origin");
    valid(writer.written[0]);
  });

  test("of a closed ask, from the board: taken, with the ask's state `closed`", async () => {
    const { core, written } = await lifecycleWith();
    await core.update({ askId: LIFECYCLE_ID, actions: [{ action: "close" }] });
    expect(await core.snapshot(LIFECYCLE_ID, BOARD)).toMatchObject({
      outcome: "saved",
      state: "closed",
    });
    expect(written[0]?.state.ask).toBe("closed");
    valid(written[0]);
  });

  test("the user's names who answers by FR-19's rule: the ask's expected user", async () => {
    const { core, written } = await lifecycleWith(fakeWriter(), { git: "Paolo Ferri" });
    await core.snapshot(LIFECYCLE_ID, BOARD);
    expect(written[0]?.snapshot).toEqual({
      takenAt: "2026-10-31T14:20:03Z",
      takenBy: "user",
      who: "Sara Conti",
    });
  });

  test("the user's names who answers by FR-19's rule: else the git user name", async () => {
    const writer = fakeWriter();
    const { core } = snapshotCoreWith({ git: "Paola Greco", snapshots: { writer: writer.writer } });
    await core.ask(plainChoiceAsk());
    await core.snapshot("order-db-choice-x7k2", BOARD);
    expect(writer.written[0]?.snapshot).toMatchObject({ takenBy: "user", who: "Paola Greco" });
  });

  test("the board's unsent work is noted as its request says, and nothing of it is read", async () => {
    const { core, written } = await lifecycleWith();
    core.holdDraft(LIFECYCLE_ID, lifecycleDraftRecord);
    await core.snapshot(LIFECYCLE_ID, { takenBy: "user", unsentWork: true });
    await core.snapshot(LIFECYCLE_ID, BOARD);
    const [noted, unnoted] = written;
    expect(noted?.snapshot).toMatchObject({ takenBy: "user", unsentWork: true });
    expect(unnoted?.snapshot).not.toHaveProperty("unsentWork");
    for (const data of written) {
      expect(JSON.stringify(data)).not.toContain("Mollie");
      expect(data.state.questions.every(({ state }) => state === "open")).toBe(true);
    }
  });

  test("an answer appended while the file is written is not in it", async () => {
    const { core, written, release } = await lifecycleWith(fakeWriter({ held: true }));
    const taking = core.snapshot(LIFECYCLE_ID, AGENT);
    // The data is gathered after the settings are read (snapshot-toolbar): wait until the writer
    // holds it, then append.
    while (written.length === 0) await new Promise((resolve) => setTimeout(resolve, 1));
    const answer = {
      type: "answer",
      itemId: "region",
      rev: 1,
      choice: ["EU"],
      when: WHEN,
    } as const;
    expect(core.act(LIFECYCLE_ID, command([answer])).ok).toBe(true);
    release();
    expect(await taking).toMatchObject({ outcome: "saved", state: "waiting" });
    expect(written[0]?.events).toEqual([]);
    expect(written[0]?.state.ask).toBe("waiting");
  });
});

describe("no Snapshot of a discarded ask", () => {
  test("after the tab closed and the grace period ended: `discarded`, and no write", async () => {
    const { core, clock, written } = await lifecycleWith();
    core.connected(LIFECYCLE_ID);
    core.disconnected(LIFECYCLE_ID);
    clock.advance(GRACE_PERIOD_MS);
    expect(core.lifecycleBoard(LIFECYCLE_ID)?.state).toBe("discarded");
    expect(await core.snapshot(LIFECYCLE_ID, AGENT)).toEqual({ outcome: "discarded" });
    expect(await core.snapshot(LIFECYCLE_ID, BOARD)).toEqual({ outcome: "discarded" });
    expect(written).toEqual([]);
  });

  test("after the session's asks were discarded at its exit: `discarded`, and no write", async () => {
    const { core, written } = await lifecycleWith();
    core.discardAll("session-exit");
    expect(await core.snapshot(LIFECYCLE_ID, BOARD)).toEqual({ outcome: "discarded" });
    expect(written).toEqual([]);
  });

  test("an ask ID this epoch does not hold, as after a restart: `discarded`, never unknown", async () => {
    const { core, written } = await lifecycleWith();
    expect(await core.snapshot("checkout-copy-m2d5", AGENT)).toEqual({ outcome: "discarded" });
    expect(written).toEqual([]);
  });
});

describe("when the writer refuses", () => {
  test("for want of a session project root: `no-project-root`, naming CLAUDE_PROJECT_DIR", async () => {
    const { core } = await lifecycleWith(fakeWriter({ fails: SnapshotWriteError.noProjectRoot() }));
    expect(await core.snapshot(LIFECYCLE_ID, AGENT)).toEqual({
      outcome: "no-project-root",
      variable: "CLAUDE_PROJECT_DIR",
    });
  });

  test("in its folder: `write-failed`, naming the folder and the code", async () => {
    const fails = SnapshotWriteError.inFolder(SNAPSHOT_FOLDER, "EACCES");
    const { core } = await lifecycleWith(fakeWriter({ fails }));
    expect(await core.snapshot(LIFECYCLE_ID, BOARD)).toEqual({
      outcome: "write-failed",
      folder: SNAPSHOT_FOLDER,
      code: "EACCES",
    });
  });

  test("a session with no writer takes no Snapshot, as one without a project root", async () => {
    const { core } = snapshotCoreWith();
    await core.ask(areasAsk());
    expect(await core.snapshot(LIFECYCLE_ID, AGENT)).toEqual({
      outcome: "no-project-root",
      variable: "CLAUDE_PROJECT_DIR",
    });
  });

  test("a writer that breaks its port, rejecting with another error, rejects the command with it", async () => {
    const fails = new TypeError("the writer is broken");
    const { core } = await lifecycleWith(fakeWriter({ fails }));
    await expect(core.snapshot(LIFECYCLE_ID, AGENT)).rejects.toBe(fails);
  });
});

// snapshot-toolbar (core spec: The presentation a Snapshot records; design decision 3): the theme
// and density a board would open with at the moment of the Snapshot, from the same settings the
// board reads, for the agent's Snapshot and the board's.
describe("the presentation a Snapshot records", () => {
  const v = "1.0";

  const withSettings = async (settings: FakeConfigOptions = {}, writer = fakeWriter()) => {
    const fakes = fakeConfig(settings);
    return lifecycleWith(writer, { config: fakes.config });
  };

  test("light chosen on the board: the writer gets it, after the board's writes", async () => {
    const { core, written } = await withSettings({ user: { version: v } });
    await core.writeSetting({ key: "theme", value: "light" });
    await core.writeSetting({ key: "density", value: "comfortable" });
    await core.snapshot(LIFECYCLE_ID, BOARD);
    expect(written[0]?.snapshot).toMatchObject({
      takenBy: "user",
      presentation: { theme: "light", density: "comfortable" },
    });
    valid(written[0]);
  });

  test("a write requested and not awaited is in the record", async () => {
    const { core, written } = await withSettings({ user: { version: v } });
    const writing = core.writeSetting({ key: "theme", value: "light" });
    await core.snapshot(LIFECYCLE_ID, BOARD);
    await writing;
    expect(written[0]?.snapshot).toMatchObject({ presentation: { theme: "light" } });
  });

  test("the agent's Snapshot: the user file's dark, density compact by default", async () => {
    const { core, written } = await withSettings({ user: { version: v, theme: "dark" } });
    await core.snapshot(LIFECYCLE_ID, AGENT);
    expect(written[0]?.snapshot).toEqual({
      takenAt: expect.any(String),
      takenBy: "agent",
      presentation: { theme: "dark", density: "compact" },
    });
    valid(written[0]);
  });

  test("the project file's light stands over the user file's dark", async () => {
    const { core, written } = await withSettings({
      user: { version: v, theme: "dark" },
      project: { version: v, theme: "light" },
    });
    await core.snapshot(LIFECYCLE_ID, AGENT);
    expect(written[0]?.snapshot).toMatchObject({ presentation: { theme: "light" } });
  });

  test("the configuration cannot give the settings: the Snapshot is written with no presentation, and the failure is reported once", async () => {
    const fakes = fakeConfig({ user: { version: v, theme: "dark" } });
    let broken = false;
    const failure = new Error("the settings cannot be read");
    const config = {
      ...fakes.config,
      get paths(): never {
        if (broken) throw failure;
        return fakes.config.paths as never;
      },
    };
    const writer = fakeWriter();
    const { core, written, reported } = await lifecycleWith(writer, { config });
    broken = true;
    expect(await core.snapshot(LIFECYCLE_ID, AGENT)).toMatchObject({ outcome: "saved" });
    expect(written).toHaveLength(1);
    expect(written[0]?.snapshot).toEqual({ takenAt: expect.any(String), takenBy: "agent" });
    expect(reported).toEqual([failure]);
    valid(written[0]);
  });

  test("a user file that cannot be read contributes no key: the record holds the project file's keys and the defaults, nothing refused", async () => {
    const fakes = fakeConfig({ project: { version: v, density: "comfortable" } });
    const config = {
      ...fakes.config,
      userFile: async () => ({ kind: "unreadable" as const, code: "EACCES" }),
    };
    const { core, written, reported } = await lifecycleWith(fakeWriter(), { config });
    expect(await core.snapshot(LIFECYCLE_ID, AGENT)).toMatchObject({ outcome: "saved" });
    expect(written[0]?.snapshot).toMatchObject({
      presentation: { theme: "system", density: "comfortable" },
    });
    expect(reported).toEqual([]);
    valid(written[0]);
  });

  test("a session with no configuration port records none, with nothing reported", async () => {
    const { core, written, reported } = await lifecycleWith();
    await core.snapshot(LIFECYCLE_ID, AGENT);
    expect(written[0]?.snapshot).not.toHaveProperty("presentation");
    expect(reported).toEqual([]);
  });

  test("a discarded ask hands nothing to the writer, whatever the settings", async () => {
    const { core, written } = await withSettings({ user: { version: v, theme: "dark" } });
    core.discardAll("session-exit");
    expect(await core.snapshot(LIFECYCLE_ID, AGENT)).toEqual({ outcome: "discarded" });
    expect(written).toEqual([]);
  });

  test("an answer appended while the settings are read is in the data, one appended after the gathering is not", async () => {
    const fakes = fakeConfig({ user: { version: v, theme: "dark" } });
    let hold: (() => void) | undefined;
    let held = false;
    const config = {
      ...fakes.config,
      userFile: async () => {
        if (held) await new Promise<void>((resolve) => (hold = resolve));
        return fakes.config.userFile();
      },
    };
    const { core, written, release } = await lifecycleWith(fakeWriter({ held: true }), { config });
    const act = (itemId: string) =>
      core.act(
        LIFECYCLE_ID,
        command([{ type: "answer", itemId, rev: 1, choice: ["EU"], when: WHEN }]),
      );
    held = true;
    const taking = core.snapshot(LIFECYCLE_ID, AGENT);
    await Promise.resolve();
    expect(written).toEqual([]);
    expect(act("region").ok).toBe(true);
    held = false;
    hold?.();
    while (written.length === 0) await new Promise((resolve) => setTimeout(resolve, 1));
    expect(
      core.act(LIFECYCLE_ID, command([{ type: "decline", itemId: "payment", rev: 1, when: WHEN }]))
        .ok,
    ).toBe(true);
    release();
    await taking;
    expect(written[0]?.events.map(({ event }) => event.type)).toEqual(["answer"]);
    expect(written[0]?.events[0]?.event).toMatchObject({ itemId: "region" });
    expect(written[0]?.state.ask).toBe("partly-answered");
  });
});

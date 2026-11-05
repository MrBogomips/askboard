import { describe, expect, test } from "bun:test";
import {
  LIFECYCLE,
  lifecycleBoardDocument,
  lifecycleCollectResult,
  lifecycleSnapshotData,
} from "../src/fixtures/index.ts";
import {
  BOARD_PROTOCOL_VERSION,
  type BoardQuestion,
  OUTPUT_FORMAT_VERSION,
  originMessage,
  SNAPSHOT_DATA_VERSION,
} from "../src/index.ts";
import {
  validateBoardDocument,
  validateBoardMessage,
  validateOrigin,
  validateSnapshotData,
} from "../src/validate.ts";

// The Snapshot data fixture (snapshot task 1.1; contract spec, What the Snapshot data holds, The
// fixture validates): an agent's Snapshot of E3's lifecycle ask, with an origin, built from E3's
// lifecycle fixtures; and the log's events, which are the output format's but for `discarded`.

type Json = Record<string, unknown>;
const data = lifecycleSnapshotData;
const copy = () => structuredClone(data) as unknown as Json;

const problemPaths = (value: unknown): string[] => {
  const checked = validateSnapshotData(value);
  return checked.ok ? [] : checked.problems.map((problem) => problem.path);
};

const questionsOf = (document: typeof data.document): BoardQuestion[] =>
  document.items.flatMap((item) => (item.type === "area" ? [...item.props.items] : [item]));

const statusOf = (itemId: string) =>
  data.state.questions.find((question) => question.itemId === itemId);

describe("the Snapshot data fixture", () => {
  test("validates against the snapshot-data schema", () => {
    expect(validateSnapshotData(data)).toEqual({ ok: true, value: data });
  });

  test("is an agent's Snapshot of the lifecycle ask, naming the versions this build writes", () => {
    expect(data.versions).toEqual({
      snapshot: SNAPSHOT_DATA_VERSION,
      output: OUTPUT_FORMAT_VERSION,
      boardProtocol: BOARD_PROTOCOL_VERSION,
    });
    expect(data.snapshot).toEqual({ takenAt: expect.stringMatching(/Z$/), takenBy: "agent" });
    expect([data.epoch, data.askId]).toEqual([LIFECYCLE.epoch, LIFECYCLE.askId]);
  });

  test("its document and state pass as the board protocol's board and state messages", () => {
    expect(validateBoardDocument(data.document).ok).toBe(true);
    const version = BOARD_PROTOCOL_VERSION;
    const board = { version, type: "board", document: data.document };
    const state = { version, type: "state", state: data.state };
    expect(validateBoardMessage("toPage", board).ok).toBe(true);
    expect(validateBoardMessage("toPage", state).ok).toBe(true);
  });

  test("holds both areas, and the state names every question in board order at its revision", () => {
    expect(data.document.items.map((item) => item.type)).toEqual(["area", "area"]);
    expect(data.state.questions.map(({ itemId, rev }) => [itemId, rev])).toEqual(
      questionsOf(data.document).map(({ id, rev }) => [id, rev]),
    );
  });

  test("holds a postponed question, a decline, a recorded answer and a thread with a reply", () => {
    expect(statusOf("analytics")?.state).toBe("postponed");
    expect(statusOf("erp-export")).toMatchObject({
      state: "declined",
      answer: { declined: true, note: "Finance decides this." },
    });
    expect(statusOf("launch")).toMatchObject({ state: "answered", answer: { recorded: true } });
    const [followUp] = statusOf("rollout")?.thread ?? [];
    expect(followUp?.replies).toHaveLength(1);
    expect(data.events.map(({ event }) => event.cursor)).toContain(followUp?.cursor ?? "none");
  });

  test("holds an answer on an older revision, whose revision is kept beside the current one", () => {
    const rollout = questionsOf(data.document).find((question) => question.id === "rollout");
    expect(rollout?.rev).toBe(2);
    const older = data.events.filter(
      ({ event }) => event.type === "answer" && event.itemId === "rollout",
    );
    expect(older.map(({ event }) => event.type === "answer" && event.rev)).toEqual([1]);
    const original = questionsOf(lifecycleBoardDocument).find(({ id }) => id === "rollout");
    expect(data.revisions).toEqual([
      { itemId: "rollout", rev: 1, props: original?.props as never },
    ]);
  });

  test("its log is the lifecycle collect result's, then the postpone, every event in seq order", () => {
    const [lifecycle] = lifecycleCollectResult.asks;
    const events = data.events.map(({ event }) => event);
    expect(events.slice(0, -1)).toEqual(lifecycle?.events as never);
    expect(events.at(-1)).toMatchObject({ type: "postponed", itemId: "analytics" });
    const seqs = events.map((event) => Number(event.cursor.split(".")[1]));
    expect(seqs).toEqual(seqs.map((_, index) => index + 1));
  });

  test("its origin is the board protocol's message, as originMessage builds it", () => {
    expect(validateOrigin(data.origin).ok).toBe(true);
    expect(data.origin).toEqual(
      originMessage("/home/sara/shop", {
        origin: { label: "Main agent", directory: ".", branch: "feat/checkout" },
        agentName: "Planner",
        forUser: "Sara Conti",
      }),
    );
  });

  test("holds no draft, no board link and no token", () => {
    const text = JSON.stringify(data);
    expect(text).not.toContain(LIFECYCLE.token);
    expect(text).not.toContain(`/b/${LIFECYCLE.askId}`);
    expect(text).not.toContain('"draft"');
    expect(text).not.toContain('"composer"');
  });
});

describe("the origin in the Snapshot data", () => {
  test("is optional", () => {
    const bare = copy();
    delete bare.origin;
    expect(problemPaths(bare)).toEqual([]);
  });

  test.each([
    ["without who", (origin: Json) => delete origin.who, "/origin/who"],
    ["with an agent status", (origin: Json) => (origin.agent = "working"), "/origin/agent"],
    ["of another type", (origin: Json) => (origin.type = "agent"), "/origin/type"],
    ["with a draft", (origin: Json) => (origin.draft = {}), "/origin/draft"],
  ])("one %s fails, naming the field", (_, change, path) => {
    const changed = copy();
    change(changed.origin as Json);
    expect(problemPaths(changed)).toContain(path);
  });
});

describe("the log's events", () => {
  const withEvent = (event: Json): Json => {
    const changed = copy();
    changed.events = [{ event }];
    return changed;
  };

  test("each output event type the lifecycle logs passes", () => {
    const types = new Set(data.events.map(({ event }) => event.type));
    expect([...types].sort()).toEqual([
      "answer",
      "edit-choice",
      "follow-up",
      "note",
      "postponed",
      "reopened",
    ]);
  });

  test("the closed event of an ask whose subagent finished passes", () => {
    const closed = { cursor: `${LIFECYCLE.epoch}.12`, type: "closed", reason: "agent-finished" };
    expect(problemPaths(withEvent(closed))).toEqual([]);
  });

  test("a discarded event fails at its type: a discarded ask has no Snapshot", () => {
    const discarded = {
      cursor: `${LIFECYCLE.epoch}.12`,
      type: "discarded",
      reason: "board-closed",
    };
    expect(problemPaths(withEvent(discarded))).toEqual(["/events/0/event/type"]);
  });

  test("an event fails inside the schema its type picks", () => {
    const note = { cursor: `${LIFECYCLE.epoch}.5`, type: "note", itemId: "analytics", rev: 1 };
    expect(problemPaths(withEvent(note))).toEqual(
      expect.arrayContaining(["/events/0/event/who", "/events/0/event/note"]),
    );
  });
});

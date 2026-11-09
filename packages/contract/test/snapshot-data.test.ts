import { describe, expect, test } from "bun:test";
import { PLAIN_CHOICE, plainChoiceBoardDocument } from "../src/fixtures/index.ts";
import {
  BOARD_PROTOCOL_VERSION,
  OUTPUT_FORMAT_VERSION,
  SCHEMA_SET_OWNERS,
  SCHEMA_SETS,
  SNAPSHOT_DATA_ID,
  SNAPSHOT_DATA_VERSION,
  type SnapshotData,
  snapshotDataSet,
} from "../src/index.ts";
import { pushBoardProtocolSchemas } from "../src/push/messages.ts";
import { schemaSetProblems, validateSnapshotData } from "../src/validate.ts";

// The `snapshot-data` set (snapshot design decision 2; contract spec, Snapshot data schema set,
// What the Snapshot data names, What the Snapshot data holds). These cases build on E1's plain
// choice; `snapshot-fixture.test.ts` checks the fixture built from E3's lifecycle fixtures.

const [question] = plainChoiceBoardDocument.items;
const when = "2026-10-29T09:41:27Z";

/** An agent's Snapshot of E1's plain choice, answered PostgreSQL and delivered. */
const agentSnapshot = (): SnapshotData => ({
  versions: {
    snapshot: SNAPSHOT_DATA_VERSION,
    output: OUTPUT_FORMAT_VERSION,
    boardProtocol: BOARD_PROTOCOL_VERSION,
  },
  snapshot: { takenAt: "2026-10-29T09:45:02Z", takenBy: "agent" },
  epoch: PLAIN_CHOICE.epoch,
  askId: PLAIN_CHOICE.askId,
  document: plainChoiceBoardDocument,
  revisions: [],
  state: {
    ask: "answered",
    questions: [
      {
        itemId: question.id,
        rev: question.rev,
        state: "answered",
        answer: { choice: ["PostgreSQL"], when, receipt: "delivered" },
      },
    ],
  },
  events: [
    {
      event: {
        cursor: `${PLAIN_CHOICE.epoch}.1`,
        type: "answer",
        itemId: question.id,
        rev: question.rev,
        who: "Giulia Rossi",
        when,
        choice: ["PostgreSQL"],
      },
    },
  ],
});

type Json = Record<string, unknown>;

/** The data as plain JSON, with `change` applied to a copy. */
const changed = (change: (data: Json) => void, data: SnapshotData = agentSnapshot()): Json => {
  const copy = structuredClone(data) as unknown as Json;
  change(copy);
  return copy;
};
const record = (data: Json) => data.snapshot as Json;

const problemPaths = (value: unknown): string[] => {
  const checked = validateSnapshotData(value);
  return checked.ok ? [] : checked.problems.map((problem) => problem.path);
};

describe("the snapshot-data set", () => {
  test("is listed at its current minor, owned by snapshot, as AD-7's table says", () => {
    expect(SCHEMA_SETS).toContain(snapshotDataSet);
    expect(snapshotDataSet).toMatchObject({
      name: "snapshot-data",
      version: SNAPSHOT_DATA_VERSION,
      owner: "snapshot",
    });
    expect(SCHEMA_SET_OWNERS["snapshot-data"]).toBe("snapshot");
  });

  test("its one schema compiles in strict mode, with no root combinator", () => {
    expect(snapshotDataSet.schemas).toHaveLength(1);
    const [schema] = snapshotDataSet.schemas as Json[];
    expect(schema?.$id).toBe(SNAPSHOT_DATA_ID);
    for (const keyword of ["oneOf", "anyOf", "allOf"]) expect(schema).not.toHaveProperty(keyword);
    expect(schemaSetProblems([...SCHEMA_SETS, pushBoardProtocolSchemas])).toEqual([]);
  });

  test("it needs push delivery's standalone origin, which E1's sets do not hold", () => {
    const problems = schemaSetProblems(SCHEMA_SETS);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toStartWith(`Snapshot data, ${SNAPSHOT_DATA_ID}: does not compile`);
    expect(problems[0]).toContain("urn:askboard:board-protocol:origin");
  });

  test("comes after every set before it, in their order", () => {
    expect(SCHEMA_SETS.map((set) => set.name)).toEqual([
      "input",
      "output",
      "tool-envelopes",
      "board-document",
      "board-protocol",
      "view-manifest",
      "snapshot-data",
      "configuration",
    ]);
  });
});

describe("what the Snapshot data names", () => {
  test("an agent's Snapshot passes with a UTC takenAt and no who or unsentWork", () => {
    const checked = validateSnapshotData(agentSnapshot());
    expect(checked).toEqual({ ok: true, value: agentSnapshot() });
  });

  test("a user's Snapshot passes with who, with or without unsentWork", () => {
    const user = changed((data) => {
      data.snapshot = { takenAt: "2026-10-29T09:45:02Z", takenBy: "user", who: "Giulia Rossi" };
    });
    expect(problemPaths(user)).toEqual([]);
    expect(
      problemPaths(
        changed((data) => Object.assign(record(data), { unsentWork: true }), user as never),
      ),
    ).toEqual([]);
  });

  test("a user's Snapshot without who fails, naming who", () => {
    const user = changed((data) => {
      data.snapshot = { takenAt: "2026-10-29T09:45:02Z", takenBy: "user" };
    });
    const checked = validateSnapshotData(user);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.problems).toContainEqual({
      path: "/snapshot/who",
      message: 'missing field "who"',
    });
  });

  test("an agent's Snapshot with unsentWork or who fails, naming the field", () => {
    const unsent = changed((data) => Object.assign(record(data), { unsentWork: true }));
    expect(problemPaths(unsent)).toContain("/snapshot/unsentWork");
    const who = changed((data) => Object.assign(record(data), { who: "Giulia Rossi" }));
    expect(problemPaths(who)).toContain("/snapshot/who");
  });

  test.each([
    ["unsentWork false", { unsentWork: false }, "/snapshot/unsentWork"],
    ["a local time", { takenAt: "2026-10-29T10:45:02+01:00" }, "/snapshot/takenAt"],
    ["another taker", { takenBy: "board" }, "/snapshot/takenBy"],
    ["an empty who", { takenBy: "user", who: "" }, "/snapshot/who"],
    ["a who of 257 characters", { takenBy: "user", who: "w".repeat(257) }, "/snapshot/who"],
  ])("a record with %s fails, naming the field", (_, fields, path) => {
    expect(problemPaths(changed((data) => Object.assign(record(data), fields)))).toContain(path);
  });

  test.each([
    ["snapshot", "/versions/snapshot"],
    ["output", "/versions/output"],
    ["boardProtocol", "/versions/boardProtocol"],
  ])("a missing %s version fails, naming it", (field, path) => {
    const missing = changed((data) => {
      delete (data.versions as Json)[field];
    });
    expect(problemPaths(missing)).toContain(path);
  });

  test("a Snapshot of another major is refused as a version, saying which is supported", () => {
    const later = changed((data) => {
      (data.versions as Json).snapshot = "2.0";
    });
    const checked = validateSnapshotData(later);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.reason).toBe("version");
    expect(checked.problems).toEqual([
      {
        path: "/versions/snapshot",
        message: `the message is Snapshot data version 2.0, which is not supported: this receiver supports version 1 (${SNAPSHOT_DATA_VERSION})`,
      },
    ]);
  });

  test("a later minor of each set passes", () => {
    const minors = changed((data) => {
      data.versions = { snapshot: "1.4", output: "1.2", boardProtocol: "1.4" };
    });
    expect(problemPaths(minors)).toEqual([]);
  });

  test.each([
    ["not an object", "snapshot"],
    ["null", null],
    ["an array", []],
  ])("a value that is %s is refused as naming no Snapshot data version", (_, value) => {
    const checked = validateSnapshotData(value);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.reason).toBe("version");
  });

  test.each([
    ["epoch", "/epoch"],
    ["askId", "/askId"],
    ["document", "/document"],
    ["revisions", "/revisions"],
    ["state", "/state"],
    ["events", "/events"],
  ])("data without %s fails, naming it", (field, path) => {
    expect(problemPaths(changed((data) => delete data[field]))).toContain(path);
  });
});

describe("what the Snapshot data holds", () => {
  test("an earlier revision an event names, beside the current document", () => {
    const revised = changed((data) => {
      const document = data.document as { items: Json[] };
      const current = document.items[0] as Json;
      current.rev = 2;
      current.props = { ...(current.props as Json), text: "Which database now?" };
      const state = data.state as { questions: Json[] };
      Object.assign(state.questions[0] as Json, { rev: 2 });
      data.revisions = [{ itemId: question.id, rev: 1, props: question.props }];
    });
    expect(problemPaths(revised)).toEqual([]);
    const bad = changed((data) => {
      data.revisions = [{ itemId: question.id, rev: 0, props: question.props, draft: {} }];
    }, revised as never);
    expect(problemPaths(bad)).toEqual(
      expect.arrayContaining(["/revisions/0/rev", "/revisions/0/draft"]),
    );
  });

  test("each event's kept full values, by item ID in reference addressing", () => {
    const values = changed((data) => {
      const [entry] = data.events as Json[];
      Object.assign(entry as Json, { values: { wbs: { nodes: [] }, "wbs.portal": "Portal" } });
    });
    expect(problemPaths(values)).toEqual([]);
    const badKey = changed((data) => {
      Object.assign((data.events as Json[])[0] as Json, { values: { "wbs portal": 1 } });
    });
    expect(problemPaths(badKey)).toContain("/events/0/values");
    const empty = changed((data) => {
      Object.assign((data.events as Json[])[0] as Json, { values: {} });
    });
    expect(problemPaths(empty)).toContain("/events/0/values");
  });

  test("an event that is not an output-format event fails inside it", () => {
    const bad = changed((data) => {
      ((data.events as Json[])[0] as { event: Json }).event.rev = 0;
    });
    expect(problemPaths(bad)).toEqual(["/events/0/event/rev"]);
    expect(problemPaths(changed((data) => (data.events = [{}])))).toEqual(["/events/0/event"]);
    expect(problemPaths(changed((data) => (data.events = [{ event: {} }])))).toEqual([
      "/events/0/event/type",
    ]);
  });

  test("the molecule expansion map, as expansion entries", () => {
    const molecules = changed((data) => {
      data.molecules = [
        { itemId: "wbs__tree", reference: "wbs.tree", molecule: "wbs-gantt", version: "1.0.0" },
      ];
    });
    expect(problemPaths(molecules)).toEqual([]);
    const bad = changed((data) => {
      data.molecules = [{ itemId: "wbs__tree", reference: "wbs tree", molecule: "", version: "" }];
    });
    expect(problemPaths(bad)).toEqual(
      expect.arrayContaining([
        "/molecules/0/reference",
        "/molecules/0/molecule",
        "/molecules/0/version",
      ]),
    );
  });

  test("kept diagram renders, each with its light and dark SVG text", () => {
    const renders = changed((data) => {
      data.renders = [{ itemId: "flow", rev: 1, light: "<svg/>", dark: "<svg/>" }];
    });
    expect(problemPaths(renders)).toEqual([]);
    const missing = changed((data) => {
      data.renders = [{ itemId: "flow", rev: 1, light: "<svg/>" }];
    });
    expect(problemPaths(missing)).toContain("/renders/0/dark");
  });

  test.each([
    ["the root", (data: Json) => data],
    ["the record", (data: Json) => record(data)],
    ["the versions", (data: Json) => data.versions as Json],
    ["an event entry", (data: Json) => (data.events as Json[])[0] as Json],
    ["the board state", (data: Json) => data.state as Json],
    ["the board document", (data: Json) => data.document as Json],
  ])("a draft field in %s fails, naming it", (_, at) => {
    const drafted = changed((data) => Object.assign(at(data), { draft: { note: "unsent" } }));
    const paths = problemPaths(drafted);
    expect(paths.some((path) => path.endsWith("/draft"))).toBe(true);
  });

  test("no field for a token, a board link or the agent's status", () => {
    for (const field of ["token", "board", "link", "agent", "status"]) {
      const added = changed((data) => Object.assign(data, { [field]: "x" }));
      expect(problemPaths(added)).toContain(`/${field}`);
    }
  });
});

describe("the unchanged items of an answer in the Snapshot data (reopen-start-from-answer)", () => {
  const withUnchanged = (unchanged: unknown) =>
    changed((data) => {
      const state = data.state as { questions: { answer: Json }[] };
      Object.assign((state.questions[0] as { answer: Json }).answer, { unchanged });
    });

  test("a board state naming unchanged IDs in its answer validates", () => {
    expect(problemPaths(withUnchanged([question.id, "roadmap"]))).toEqual([]);
  });

  test("an empty list validates: nothing is unchanged", () => {
    expect(problemPaths(withUnchanged([]))).toEqual([]);
  });

  test("a repeated ID fails, naming the field", () => {
    expect(
      problemPaths(withUnchanged([question.id, question.id])).some((p) =>
        p.endsWith("/answer/unchanged"),
      ),
    ).toBe(true);
  });

  test("the data of the previous minor, with no unchanged, still validates", () => {
    expect(problemPaths(agentSnapshot())).toEqual([]);
  });
});

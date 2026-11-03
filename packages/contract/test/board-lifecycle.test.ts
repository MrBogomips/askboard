import { describe, expect, test } from "bun:test";
import {
  lifecycleBoardDocument,
  lifecycleDraftRecord,
  plainChoiceBoardDocument,
} from "../src/fixtures/index.ts";
import {
  BOARD_PROTOCOL_MESSAGES,
  BOARD_PROTOCOL_VERSION,
  DRAFT_RECORD_MAX_CHARS,
  SCHEMA_IDS,
} from "../src/index.ts";
import {
  type Checked,
  draftRecordProblems,
  validateAgainst,
  validateBoardDocument,
  validateBoardMessage,
} from "../src/validate.ts";

// Board document and board protocol 1.1 (contract spec: Board document for several questions, Acts
// on the board protocol, Action IDs, Draft record message, Closed asks on the wire).
const version = BOARD_PROTOCOL_VERSION;
const when = "2026-10-31T14:05:12Z";
const actionId = "aX9kQ2mPz7RtLw4nB8cYhA";
const clone = <T>(value: T): T => structuredClone(value);
const paths = (result: Checked<unknown>) =>
  result.ok ? [] : result.problems.map((problem) => problem.path);

describe("the board document 1.1", () => {
  test("an ask of two areas: both areas with their titles, every question at rev 1", () => {
    expect(validateBoardDocument(lifecycleBoardDocument)).toEqual({
      ok: true,
      value: lifecycleBoardDocument as never,
    });
    const areas = lifecycleBoardDocument.items;
    expect(areas.map((area) => area.type)).toEqual(["area", "area"]);
    for (const area of areas) {
      expect(area.type === "area" && area.props.items.every((question) => question.rev === 1)).toBe(
        true,
      );
    }
  });

  test("several questions without areas, and E1's plain-choice document, pass", () => {
    const questions = lifecycleBoardDocument.items.flatMap((area) =>
      area.type === "area" ? area.props.items : [],
    );
    expect(validateBoardDocument({ ...lifecycleBoardDocument, items: questions }).ok).toBe(true);
    expect(validateBoardDocument(plainChoiceBoardDocument).ok).toBe(true);
  });

  test("the requested presentation and delivery are optional", () => {
    const { presentation: _, delivery: __, ...bare } = lifecycleBoardDocument;
    expect(validateBoardDocument(bare).ok).toBe(true);
    expect(paths(validateBoardDocument({ ...bare, delivery: "later" }))).toEqual(["/delivery"]);
  });

  test("a question beside an area fails", () => {
    const [area] = lifecycleBoardDocument.items;
    const question = area?.type === "area" ? area.props.items[0] : undefined;
    const mixed = { ...lifecycleBoardDocument, items: [area, question] };
    expect(paths(validateBoardDocument(mixed))).toContain("/items/1/type");
  });

  test("an area inside an area fails", () => {
    const [area, other] = clone(lifecycleBoardDocument.items) as unknown as Record<string, never>[];
    const nested = {
      ...lifecycleBoardDocument,
      items: [{ ...area, props: { title: "Outer", items: [other] } }],
    };
    expect(validateBoardDocument(nested).ok).toBe(false);
  });

  test.each([
    ["a draft", { draft: {} }],
    ["an event", { events: [] }],
    ["a token", { token: "pV3xK9qLmT2wR7nB4cYh8A" }],
  ])("a board document holding %s fails", (_, extra) => {
    const result = validateBoardDocument({ ...lifecycleBoardDocument, ...extra });
    expect(paths(result)).toEqual([`/${Object.keys(extra)[0]}`]);
  });

  test("a question in an area without its rev, or of a type the format does not define, fails", () => {
    const noRev = clone(lifecycleBoardDocument) as unknown as {
      items: { props: { items: Record<string, unknown>[] } }[];
    };
    delete noRev.items[0]?.props.items[0]?.rev;
    expect(paths(validateBoardDocument(noRev))).toContain("/items/0/props/items/0/rev");
    const table = { ...lifecycleBoardDocument, items: [{ type: "table", id: "t", props: {} }] };
    expect(paths(validateBoardDocument(table))).toEqual(["/items/0/type"]);
  });

  test("a question's widget items are still refused, naming the item's type", () => {
    const [question] = plainChoiceBoardDocument.items;
    const probe = { type: "probe", id: "sketch", props: { size: 3 } };
    const props = { ...question.props, items: [probe] };
    const result = validateBoardDocument({
      ...plainChoiceBoardDocument,
      items: [{ ...question, props }],
    });
    // Since board document 1.2 a question's items hold its context (excerpts, design decision 2).
    expect(paths(result)).toEqual(["/items/0/props/items/0/type"]);
  });
});

describe("the board protocol's messages 1.1 (design decision 8)", () => {
  // settings-languages then appended its own (its design decision 6).
  test("E1's messages keep their order, and E3's are appended in each direction", () => {
    // A later minor appends after them (excerpts, design decision 5), so these lead each list.
    expect(Object.keys(BOARD_PROTOCOL_MESSAGES.toHost).slice(0, 4)).toEqual([
      "connect",
      "answer",
      "act",
      "draft",
      "setting",
    ]);
    expect(Object.keys(BOARD_PROTOCOL_MESSAGES.toPage).slice(0, 9)).toEqual([
      "board",
      "state",
      "receipt",
      "discarded",
      "moved",
      "refused",
      "done",
      "draft",
      "closed",
      "settings",
    ]);
    for (const type of ["act", "draft", "done", "closed"]) {
      const id = `urn:askboard:board-protocol:${type}`;
      expect({ type, id: (SCHEMA_IDS as Record<string, string>)[type] }).toEqual({ type, id });
    }
    expect(SCHEMA_IDS.draftRecord).toBe("urn:askboard:board-protocol:draft-record");
  });
});

describe("act commands", () => {
  const answer = { type: "answer", itemId: "region", rev: 1, choice: ["EU", "US"], when };
  const act = (...acts: object[]) => ({ version, type: "act", actionId, acts });

  test("a submit of three acts, two answers and a postpone, validates", () => {
    const submit = act(
      answer,
      { type: "answer", itemId: "payment", rev: 1, other: "Mollie", when },
      {
        type: "postpone",
        itemId: "erp-export",
        rev: 1,
      },
    );
    expect(validateBoardMessage("toHost", submit)).toEqual({ ok: true, value: submit as never });
  });

  test.each([
    [
      "an answer with every content field",
      { ...answer, other: "x", optionNotes: { US: "East only." }, note: "n" },
    ],
    [
      "an answer with no content, which the core refuses",
      { type: "answer", itemId: "region", rev: 1, when },
    ],
    [
      "a decline with its reason",
      { type: "decline", itemId: "region", rev: 1, note: "Not mine", when },
    ],
    ["a decline without a reason", { type: "decline", itemId: "region", rev: 1, when }],
    ["a postpone", { type: "postpone", itemId: "region", rev: 1 }],
    ["an undo", { type: "reopen", itemId: "region" }],
    ["a note alone", { type: "note", itemId: "region", rev: 1, note: "Ask finance.", when }],
    ["a follow-up", { type: "follow-up", itemId: "region", rev: 1, text: "Why EU first?", when }],
    ["a reload", { type: "edit-choice", itemId: "region", rev: 2, edit: "reload" }],
    [
      "an ignore keeping rev 1",
      { type: "edit-choice", itemId: "region", rev: 2, edit: "ignore", keptRev: 1 },
    ],
  ])("%s validates", (_, one) => {
    expect(validateBoardMessage("toHost", act(one)).ok).toBe(true);
  });

  test("an act the protocol does not define is refused as a schema error naming the act's index", () => {
    const result = validateBoardMessage(
      "toHost",
      act(answer, { type: "approve", itemId: "region" }),
    );
    expect(result).toMatchObject({ ok: false, reason: "schema" });
    expect(paths(result)).toEqual(["/acts/1/type"]);
  });

  test.each([
    ["no action ID", (({ actionId: _, ...rest }) => rest)(act(answer)), "/actionId"],
    ["an action ID of 21 characters", { ...act(answer), actionId: actionId.slice(1) }, "/actionId"],
    ["an action ID of 23 characters", { ...act(answer), actionId: `${actionId}A` }, "/actionId"],
    [
      "an action ID that is not base64url",
      { ...act(answer), actionId: `${actionId.slice(1)}+` },
      "/actionId",
    ],
    ["no acts", act(), "/acts"],
    [
      "an ignore without its kept revision",
      act({ type: "edit-choice", itemId: "region", rev: 2, edit: "ignore" }),
      "/acts/0/keptRev",
    ],
    [
      "a widget value, which the widget follow-up adds",
      act({ ...answer, values: { region: ["EU"] } }),
      "/acts/0/values",
    ],
    ["a note of 10,001 characters", act({ ...answer, note: "n".repeat(10_001) }), "/acts/0/note"],
    [
      "Other text of 10,001 characters",
      act({ ...answer, other: "o".repeat(10_001) }),
      "/acts/0/other",
    ],
    [
      "a follow-up of 10,001 characters",
      act({ type: "follow-up", itemId: "region", rev: 1, text: "t".repeat(10_001), when }),
      "/acts/0/text",
    ],
    [
      "an option note of 2,001 characters",
      act({ ...answer, optionNotes: { US: "o".repeat(2_001) } }),
      "/acts/0/optionNotes/US",
    ],
    ["a local time", act({ ...answer, when: "2026-10-31T15:05:12+01:00" }), "/acts/0/when"],
    [
      "a postpone that carries a time",
      act({ type: "postpone", itemId: "region", rev: 1, when }),
      "/acts/0/when",
    ],
    [
      "an undo that names a revision",
      act({ type: "reopen", itemId: "region", rev: 1 }),
      "/acts/0/rev",
    ],
  ])("a command with %s is refused as a schema error, naming the field", (_, message, path) => {
    const result = validateBoardMessage("toHost", message);
    expect(result).toMatchObject({ ok: false, reason: "schema" });
    expect(paths(result)).toEqual([path]);
  });

  test("E1's answer command is kept", () => {
    const e1 = {
      version,
      type: "answer",
      itemId: "database",
      rev: 1,
      choice: ["PostgreSQL"],
      when,
    };
    expect(validateBoardMessage("toHost", e1).ok).toBe(true);
  });
});

describe("the draft record", () => {
  const draft = { version, type: "draft", record: lifecycleDraftRecord };

  test("a draft message validates in both directions", () => {
    expect(validateBoardMessage("toHost", draft)).toEqual({ ok: true, value: draft as never });
    expect(validateBoardMessage("toPage", draft)).toEqual({ ok: true, value: draft as never });
    expect(validateAgainst(SCHEMA_IDS.draftRecord, lifecycleDraftRecord).ok).toBe(true);
  });

  // Submitted delivery holds a lone note and the undo of a sent postpone or decline until Submit
  // (AD-20; ask-lifecycle, task 6.6): their kinds are appended to the held act's enum.
  test.each(["answer", "decline", "postpone", "note", "reopen"])(
    "a held %s validates in both directions",
    (act) => {
      const record = {
        ...lifecycleDraftRecord,
        questions: { payment: { rev: 1, note: "Later.", held: { act, order: 0 } } },
      };
      for (const direction of ["toHost", "toPage"] as const) {
        expect(validateBoardMessage(direction, { ...draft, record }).ok).toBe(true);
      }
    },
  );

  test("an oversized record is refused as a schema error, at the record", () => {
    const long = "x".repeat(DRAFT_RECORD_MAX_CHARS);
    const record = {
      ...lifecycleDraftRecord,
      questions: { payment: { rev: 1, values: { payment: long } } },
    };
    for (const direction of ["toHost", "toPage"] as const) {
      const result = validateBoardMessage(direction, { ...draft, record });
      expect(result).toMatchObject({ ok: false, reason: "schema" });
      expect(paths(result)).toEqual(["/record"]);
    }
  });

  test("a record at the limit passes", () => {
    const empty = JSON.stringify({
      ...lifecycleDraftRecord,
      questions: { payment: { rev: 1, values: { payment: "" } } },
    });
    const room = DRAFT_RECORD_MAX_CHARS - empty.length;
    const record = {
      ...lifecycleDraftRecord,
      questions: { payment: { rev: 1, values: { payment: "x".repeat(room) } } },
    };
    expect(JSON.stringify(record)).toHaveLength(DRAFT_RECORD_MAX_CHARS);
    expect(validateBoardMessage("toHost", { ...draft, record }).ok).toBe(true);
  });

  test.each([
    [
      "a question key that is no ID",
      { questions: { "pay ment": { rev: 1 } } },
      "/record/questions",
    ],
    [
      "a value key that is no ID",
      { questions: { payment: { rev: 1, values: { "a b": 1 } } } },
      "/record/questions/payment/values",
    ],
    [
      "a held act the board cannot hold",
      { questions: { payment: { rev: 1, held: { act: "follow-up", order: 1 } } } },
      "/record/questions/payment/held/act",
    ],
    ["a delivery mode it does not define", { delivery: "later" }, "/record/delivery"],
    [
      "a question without its rev",
      { questions: { payment: { note: "x" } } },
      "/record/questions/payment/rev",
    ],
    [
      "composer text of 10,001 characters",
      { questions: { payment: { rev: 1, composer: "c".repeat(10_001) } } },
      "/record/questions/payment/composer",
    ],
  ])("a record with %s is refused, naming the field", (_, change, path) => {
    const result = validateBoardMessage("toHost", {
      ...draft,
      record: { ...lifecycleDraftRecord, ...change },
    });
    expect(paths(result)).toContain(path);
  });

  test("a record keyed by the ask's questions has no problem against its board document", () => {
    expect(draftRecordProblems(lifecycleDraftRecord, lifecycleBoardDocument)).toEqual([]);
  });

  test.each(["constructor", "toString", "__proto__", "q9"])(
    "a question key %s that is no question of the ask is refused like any unknown item ID",
    (key) => {
      const questions = JSON.parse(`{${JSON.stringify(key)}: {"rev": 1}}`);
      const problems = draftRecordProblems(
        { ...lifecycleDraftRecord, questions },
        lifecycleBoardDocument,
      );
      expect(problems).toEqual([
        { path: `/questions/${key}`, message: `"${key}" names no question of the ask` },
      ]);
    },
  );

  test("a value may name the question's widget item, once a question holds one", () => {
    const [question] = plainChoiceBoardDocument.items;
    const props = { ...question.props, items: [{ type: "probe", id: "sketch", props: {} }] };
    const document = { ...plainChoiceBoardDocument, items: [{ ...question, props }] };
    const record = {
      delivery: "immediate" as const,
      questions: { database: { rev: 1, values: { database: ["SQLite"], sketch: { size: 3 } } } },
    };
    expect(draftRecordProblems(record, document as never)).toEqual([]);
    expect(draftRecordProblems(record, plainChoiceBoardDocument as never)).toEqual([
      {
        path: "/questions/database/values/sketch",
        message: '"sketch" names no item of the question "database"',
      },
    ]);
  });

  test("a value of another question's item, a later revision and an unknown question in view are refused", () => {
    const record = {
      delivery: "submitted" as const,
      inView: "scope",
      questions: { payment: { rev: 2, values: { region: ["EU"] } } },
    };
    expect(
      draftRecordProblems(record, lifecycleBoardDocument).map((problem) => problem.path),
    ).toEqual(["/inView", "/questions/payment/rev", "/questions/payment/values/region"]);
  });
});

describe("what board-host sends 1.1", () => {
  const open = { itemId: "rollout", rev: 1, state: "open" };
  const state = (ask: string, questions: object[]) => ({
    version,
    type: "state",
    state: { ask, questions },
  });

  test.each([
    ["done", { version, type: "done", actionId }],
    ["closed by the agent", { version, type: "closed", reason: "agent" }],
    [
      "closed when its owning subagent finished (push delivery)",
      { version, type: "closed", reason: "agent-finished" },
    ],
    ["a discard after the tab closed", { version, type: "discarded", reason: "board-closed" }],
    ["a board of areas", { version, type: "board", document: lifecycleBoardDocument }],
    [
      "a partly-answered state",
      state("partly-answered", [open, { itemId: "erp-export", rev: 1, state: "postponed" }]),
    ],
    ["a closed state", state("closed", [open])],
    [
      "a declined question with its reason",
      state("answered", [
        {
          itemId: "region",
          rev: 1,
          state: "declined",
          answer: { declined: true, note: "Not mine", when, receipt: "sent" },
        },
      ]),
    ],
    [
      "a recorded answer",
      state("answered", [
        {
          itemId: "erp-export",
          rev: 1,
          state: "answered",
          answer: { choice: ["Yes"], when, receipt: "delivered", recorded: true },
        },
      ]),
    ],
    [
      "a reopened question with its previous answer",
      state("partly-answered", [
        { ...open, rev: 2, previous: { choice: ["All at once"], when, receipt: "delivered" } },
      ]),
    ],
    [
      "a thread of follow-ups and replies",
      state("waiting", [
        {
          ...open,
          thread: [
            {
              cursor: "k3x9.4",
              who: "Sara Conti",
              when,
              text: "Why a flag?",
              replies: [{ text: "To roll back fast.", when }],
            },
            { cursor: "k3x9.6", who: "Sara Conti", when, text: "And the cost?", replies: [] },
          ],
        },
      ]),
    ],
    [
      "an answer with Other text and option notes",
      state("answered", [
        {
          itemId: "payment",
          rev: 1,
          state: "answered",
          answer: {
            other: "Mollie",
            optionNotes: { Adyen: "Ask the shop team." },
            note: "Cheaper",
            when,
            receipt: "sent",
          },
        },
      ]),
    ],
  ])("%s validates", (_, message) => {
    expect(validateBoardMessage("toPage", message)).toEqual({ ok: true, value: message as never });
  });

  test("a closed message with a reason outside the enum fails, naming the field", () => {
    const result = validateBoardMessage("toPage", { version, type: "closed", reason: "timeout" });
    expect(paths(result)).toEqual(["/reason"]);
  });

  test.each([
    ["an answered question without its answer", { itemId: "region", rev: 1, state: "answered" }],
    [
      "a postponed question with an answer",
      {
        itemId: "region",
        rev: 1,
        state: "postponed",
        answer: { choice: ["EU"], when, receipt: "sent" },
      },
    ],
    [
      "a thread entry without its replies",
      { ...open, thread: [{ cursor: "k3x9.4", who: "Sara Conti", when, text: "Why?" }] },
    ],
    [
      "a reply of 10,001 characters",
      {
        ...open,
        thread: [
          {
            cursor: "k3x9.4",
            who: "S",
            when,
            text: "Why?",
            replies: [{ text: "r".repeat(10_001), when }],
          },
        ],
      },
    ],
  ])("a state with %s fails", (_, question) => {
    expect(validateBoardMessage("toPage", state("waiting", [question])).ok).toBe(false);
  });

  test("a board state never says discarded: the discarded message does", () => {
    expect(paths(validateBoardMessage("toPage", state("discarded", [open])))).toEqual([
      "/state/ask",
    ]);
  });

  test("a done message names its action ID", () => {
    expect(paths(validateBoardMessage("toPage", { version, type: "done" }))).toEqual(["/actionId"]);
  });
});

describe("refusals 1.1", () => {
  const refused = (fields: object) => ({ version, type: "refused", detail: "refused", ...fields });

  test.each([
    [
      "an act refusal naming its command, act and question",
      { reason: "act", actionId, index: 1, itemId: "payment" },
    ],
    ["a refusal of an act on a closed ask, naming its command", { reason: "closed", actionId }],
    ["E1's answer refusal", { reason: "answer", itemId: "database" }],
    ["E1's message refusal", { reason: "message" }],
  ])("%s validates", (_, fields) => {
    expect(validateBoardMessage("toPage", refused(fields)).ok).toBe(true);
  });

  test.each([
    [
      "an act refusal without the act's index",
      { reason: "act", actionId, itemId: "payment" },
      "/index",
    ],
    [
      "an act refusal without its action ID",
      { reason: "act", index: 0, itemId: "payment" },
      "/actionId",
    ],
    [
      "a closed refusal naming a question",
      { reason: "closed", actionId, itemId: "payment" },
      "/itemId",
    ],
    ["a message refusal naming an action ID", { reason: "message", actionId }, "/actionId"],
    [
      "an answer refusal naming an action ID",
      { reason: "answer", itemId: "database", actionId },
      "/actionId",
    ],
    ["a negative index", { reason: "act", actionId, index: -1, itemId: "payment" }, "/index"],
  ])("%s fails, naming the field", (_, fields, path) => {
    expect(paths(validateBoardMessage("toPage", refused(fields)))).toContain(path);
  });
});

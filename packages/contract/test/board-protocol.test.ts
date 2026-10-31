import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "../src/fixtures/index.ts";
import { BOARD_PROTOCOL_MESSAGES, BOARD_PROTOCOL_VERSION, boardProtocol } from "../src/index.ts";
import { type Checked, validateBoardMessage } from "../src/validate.ts";

const version = BOARD_PROTOCOL_VERSION;
const token = "pV3xK9qLmT2wR7nB4cYh8A";
const when = "2026-10-29T09:41:27Z";
const open = { itemId: "database", rev: 1, state: "open" } as const;
const answered = {
  itemId: "database",
  rev: 1,
  state: "answered",
  answer: { choice: ["PostgreSQL"], when, receipt: "sent" },
} as const;

// One valid message of each type, per direction.
const toHost = {
  connect: { version, type: "connect", token },
  answer: { version, type: "answer", itemId: "database", rev: 1, choice: ["PostgreSQL"], when },
} as const;
const toPage = {
  board: { version, type: "board", document: plainChoiceBoardDocument },
  state: { version, type: "state", state: { ask: "answered", questions: [answered] } },
  receipt: { version, type: "receipt", itemId: "database", receipt: "delivered" },
  discarded: { version, type: "discarded", reason: "session-exit" },
  moved: { version, type: "moved" },
  refused: { version, type: "refused", reason: "token", detail: "this board link is not valid" },
} as const;

const problemPaths = (result: Checked<unknown>) =>
  result.ok ? [] : result.problems.map((problem) => problem.path);

describe("the board protocol (owner board-host)", () => {
  test("the message types of each direction are E1's, each with its schema", () => {
    expect(Object.keys(BOARD_PROTOCOL_MESSAGES.toHost).sort()).toEqual(Object.keys(toHost).sort());
    expect(Object.keys(BOARD_PROTOCOL_MESSAGES.toPage).sort()).toEqual(Object.keys(toPage).sort());
  });

  test.each(Object.entries(toHost))("the board page's %s message validates", (_type, message) => {
    expect(validateBoardMessage("toHost", message)).toEqual({ ok: true, value: message });
  });

  test.each(Object.entries(toPage))("board-host's %s message validates", (_type, message) => {
    expect(validateBoardMessage("toPage", message)).toEqual({ ok: true, value: message });
  });

  test("the waiting state, a refused answer naming its item, and a multiple choice validate", () => {
    const waiting = { version, type: "state", state: { ask: "waiting", questions: [open] } };
    const refusal = { ...toPage.refused, reason: "answer", itemId: "database", detail: "answered" };
    const two = { ...toHost.answer, choice: ["PostgreSQL", "SQLite"] };
    expect(validateBoardMessage("toPage", waiting).ok).toBe(true);
    expect(validateBoardMessage("toPage", refusal).ok).toBe(true);
    expect(validateBoardMessage("toHost", two).ok).toBe(true);
  });

  test.each([
    ["no token", { version, type: "connect" }, "/token"],
    ["a short token", { ...toHost.connect, token: "short" }, "/token"],
    ["an unknown field", { ...toHost.connect, askId: "x" }, "/askId"],
    ["an empty choice", { ...toHost.answer, choice: [] }, "/choice"],
    ["a repeated label", { ...toHost.answer, choice: ["SQLite", "SQLite"] }, "/choice"],
    ["rev 0", { ...toHost.answer, rev: 0 }, "/rev"],
    ["a time that is not UTC", { ...toHost.answer, when: "2026-10-29T11:41:27+02:00" }, "/when"],
    ["a malformed item ID", { ...toHost.answer, itemId: "data base" }, "/itemId"],
  ])("a board page message with %s is refused, naming the field", (_case, message, path) => {
    const result = validateBoardMessage("toHost", message);
    expect(result).toMatchObject({ ok: false, reason: "schema" });
    expect(problemPaths(result)).toContain(path);
  });

  test.each([
    ["an answered question without its answer", { ...answered, answer: undefined }],
    ["an open question with an answer", { ...open, answer: answered.answer }],
    [
      "a receipt the board computes itself",
      { ...answered, answer: { ...answered.answer, receipt: "not-sent" } },
    ],
  ])("a state with %s is refused", (_case, question) => {
    const message = { version, type: "state", state: { ask: "answered", questions: [question] } };
    expect(validateBoardMessage("toPage", JSON.parse(JSON.stringify(message))).ok).toBe(false);
  });

  test("E1's narrow scope: a discard on board close and a closed ask are refused", () => {
    const closed = { version, type: "state", state: { ask: "closed", questions: [open] } };
    expect(validateBoardMessage("toPage", { ...toPage.discarded, reason: "board-closed" }).ok).toBe(
      false,
    );
    expect(validateBoardMessage("toPage", closed).ok).toBe(false);
  });

  test("a message the protocol does not define for that direction is refused at its type", () => {
    for (const [direction, message] of [
      ["toHost", { version, type: "draft", itemId: "database" }],
      ["toHost", toPage.moved],
      ["toPage", toHost.answer],
    ] as const) {
      const result = validateBoardMessage(direction, message);
      expect(result).toMatchObject({ ok: false, reason: "schema" });
      expect(problemPaths(result)).toEqual(["/type"]);
    }
    for (const value of [null, "connect", [toHost.connect], { version }]) {
      expect(validateBoardMessage("toHost", value)).toMatchObject({ ok: false, reason: "schema" });
    }
  });

  test.each(["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"])(
    "a message whose type is the inherited name %s is refused, not thrown",
    (type) => {
      for (const direction of ["toHost", "toPage"] as const) {
        const result = validateBoardMessage(direction, { version, type });
        expect(result).toMatchObject({ ok: false, reason: "schema" });
        expect(problemPaths(result)).toEqual(["/type"]);
      }
    },
  );

  test("a message whose type is not a string is refused at its type", () => {
    for (const type of [1, null, ["connect"], { connect: true }]) {
      const result = validateBoardMessage("toHost", { version, type });
      expect(result).toMatchObject({ ok: false, reason: "schema" });
      expect(problemPaths(result)).toEqual(["/type"]);
    }
  });

  test.each([
    ["a token of 256 characters", { ...toHost.connect, token: "a".repeat(256) }, true],
    ["a token of 257 characters", { ...toHost.connect, token: "a".repeat(257) }, false],
  ])("a connect with %s", (_case, message, ok) => {
    const result = validateBoardMessage("toHost", message);
    expect(result.ok).toBe(ok);
    if (!ok) expect(problemPaths(result)).toEqual(["/token"]);
  });

  test("a refusal's detail is at most 1,000 characters", () => {
    expect(
      validateBoardMessage("toPage", { ...toPage.refused, detail: "x".repeat(1_000) }).ok,
    ).toBe(true);
    const long = validateBoardMessage("toPage", { ...toPage.refused, detail: "x".repeat(1_001) });
    expect(problemPaths(long)).toEqual(["/detail"]);
  });

  test("an answer refusal names its item, and only an answer refusal does", () => {
    const answer = { ...toPage.refused, reason: "answer", detail: "the question is answered" };
    expect(validateBoardMessage("toPage", { ...answer, itemId: "database" }).ok).toBe(true);
    expect(validateBoardMessage("toPage", answer).ok).toBe(false);
    for (const reason of ["token", "message", "version"]) {
      const named = { ...toPage.refused, reason, itemId: "database" };
      expect({ reason, ok: validateBoardMessage("toPage", named).ok }).toEqual({
        reason,
        ok: false,
      });
    }
  });

  test.each([
    "2026-13-29T09:41:27Z",
    "2026-10-32T09:41:27Z",
    "2026-10-29T24:00:00Z",
    "2026-10-29T09:41:60Z",
    "2026-10-29t09:41:27z",
  ])("a time out of range, %s, is refused in an answer and in a state", (bad) => {
    expect(problemPaths(validateBoardMessage("toHost", { ...toHost.answer, when: bad }))).toEqual([
      "/when",
    ]);
    const state = {
      ...toPage.state.state,
      questions: [{ ...answered, answer: { ...answered.answer, when: bad } }],
    };
    const result = validateBoardMessage("toPage", { ...toPage.state, state });
    expect(problemPaths(result)).toContain("/state/questions/0/answer/when");
  });

  test("a time with a fraction of a second validates", () => {
    const when = "2026-10-29T09:41:27.123Z";
    expect(validateBoardMessage("toHost", { ...toHost.answer, when }).ok).toBe(true);
  });

  test("a major-2 message is refused before its schema, naming the supported version", () => {
    const result = validateBoardMessage("toHost", { ...toHost.connect, version: "2.0" });
    expect(result).toEqual({
      ok: false,
      reason: "version",
      problems: [
        {
          path: "/version",
          message:
            "the message is board protocol version 2.0, which is not supported: this receiver supports version 1 (1.0)",
        },
      ],
    });
    const none = validateBoardMessage("toPage", { type: "moved" });
    expect(none).toMatchObject({ ok: false, reason: "version" });
  });

  test.each(["1", "1.0.0", "1.01", "01.0", "v1.0", " 1.0"])(
    "a message naming %p, which is not major.minor, is refused as a version",
    (named) => {
      const result = validateBoardMessage("toHost", { ...toHost.connect, version: named });
      expect(result).toMatchObject({ ok: false, reason: "version" });
    },
  );
});

describe("minor versions of the board protocol (design decision 2)", () => {
  const later = "1.7";
  test.each([
    ...Object.entries(toHost).map(([type, message]) => ["toHost", type, message] as const),
    ...Object.entries(toPage).map(([type, message]) => ["toPage", type, message] as const),
  ])("a %s %s message of a later minor validates", (direction, _type, message) => {
    const result = validateBoardMessage(direction, { ...message, version: later });
    expect(result.ok).toBe(true);
  });

  test.each([
    ...Object.entries(toHost).map(([type, message]) => ["toHost", type, message] as const),
    ...Object.entries(toPage).map(([type, message]) => ["toPage", type, message] as const),
  ])(
    "a %s %s message of a later minor with a field this receiver does not know is refused, naming it",
    (direction, _type, message) => {
      const result = validateBoardMessage(direction, { ...message, version: later, focus: true });
      expect(result).toMatchObject({ ok: false, reason: "schema" });
      expect(problemPaths(result)).toEqual(["/focus"]);
    },
  );

  test("every message's version names the protocol's shared version schema", () => {
    for (const id of [
      ...Object.values(BOARD_PROTOCOL_MESSAGES.toHost),
      ...Object.values(BOARD_PROTOCOL_MESSAGES.toPage),
    ]) {
      const schema = boardProtocol.schemas.find((each) => (each as { $id: string }).$id === id) as {
        properties: { version: unknown };
      };
      expect({ id, version: schema.properties.version }).toEqual({
        id,
        version: { $ref: "urn:askboard:board-protocol:version" },
      });
    }
  });
});

import { describe, expect, test } from "bun:test";
import {
  CONTEXT,
  contextBoardDocument,
  readingPanelTranscript,
  transcripts,
} from "../src/fixtures/index.ts";
import {
  BOARD_PROTOCOL_MESSAGES,
  BOARD_TOKEN_QUERY,
  boardLink,
  EDITOR_OUTCOMES,
  SOURCE_STATUSES,
} from "../src/index.ts";
import editorOutcome from "../src/schemas/board-protocol/editor-outcome.json" with { type: "json" };
import sourceState from "../src/schemas/board-protocol/source-state.json" with { type: "json" };
import { validateBoardMessage } from "../src/validate.ts";

// The reading panel's and the editor's board-protocol messages (excerpts, task 1.5; contract spec:
// Reading panel and editor messages), each by E3's four appended steps: the schema, the name at the
// end of its direction's list, its validation, and a recorded transcript.
const version = "1.2";
const toHost = (message: unknown) => validateBoardMessage("toHost", message);
const toPage = (message: unknown) => validateBoardMessage("toPage", message);

describe("the lists", () => {
  test("E1's and E3's messages keep their order, and E5's are appended in each direction", () => {
    expect(Object.keys(BOARD_PROTOCOL_MESSAGES.toHost)).toEqual([
      "connect",
      "answer",
      "act",
      "draft",
      "open-source",
      "open-editor",
      // settings-languages appended its own after E5's (its design decision 6).
      "setting",
    ]);
    expect(Object.keys(BOARD_PROTOCOL_MESSAGES.toPage).slice(-3, -1)).toEqual([
      "source-state",
      "editor-outcome",
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
    ]);
  });

  test("the enums are the contract's lists", () => {
    expect(sourceState.properties.status.enum).toEqual([...SOURCE_STATUSES]);
    expect(editorOutcome.properties.outcome.enum).toEqual([...EDITOR_OUTCOMES]);
    expect(EDITOR_OUTCOMES).toEqual(["opened", "no-editor", "unavailable", "failed", "busy"]);
  });
});

describe("page to host", () => {
  test.each(["open-source", "open-editor"])("%s naming one item passes", (type) => {
    expect(toHost({ version, type, itemId: "retry-src" })).toMatchObject({ ok: true });
  });

  test.each([
    ["a path the page chose", { path: "/etc/passwd" }, "/path"],
    ["a line", { line: 3 }, "/line"],
    ["no item", { itemId: undefined }, "/itemId"],
    ["an item ID of another shape", { itemId: "../x" }, "/itemId"],
  ])("open-source with %s is refused as a schema error", (_, extra, path) => {
    const message = { version, type: "open-source", itemId: "retry-src", ...extra };
    expect(toHost(message)).toMatchObject({ ok: false, reason: "schema", problems: [{ path }] });
  });

  test("open-editor holding a path or a command is refused as a schema error", () => {
    for (const field of ["path", "command", "file"]) {
      const message = { version, type: "open-editor", itemId: "retry-src", [field]: "x" };
      expect(toHost(message)).toMatchObject({ ok: false, problems: [{ path: `/${field}` }] });
    }
  });

  test("the host's messages are no messages the page sends", () => {
    for (const type of ["source-state", "editor-outcome"]) {
      expect(toHost({ version, type, itemId: "x" })).toMatchObject({
        ok: false,
        problems: [{ path: "/type" }],
      });
    }
  });
});

describe("host to page", () => {
  const state = (extra: Record<string, unknown>) => ({
    version,
    type: "source-state",
    itemId: "retry-adr",
    status: "available",
    editor: false,
    ...extra,
  });

  test.each(SOURCE_STATUSES)("source-state with status %s passes", (status) => {
    expect(toPage(state({ status }))).toMatchObject({ ok: true });
  });

  test("source-state with the range changed and the anchor's current line passes", () => {
    expect(toPage(state({ changed: true, line: 44, editor: true }))).toMatchObject({ ok: true });
  });

  test.each([
    ["an unknown status", { status: "gone" }, "/status"],
    ["no editor flag", { editor: undefined }, "/editor"],
    ["a line of zero", { line: 0 }, "/line"],
    ["a fractional line", { line: 1.5 }, "/line"],
    ["a path", { path: "/etc/passwd" }, "/path"],
    ["changed as text", { changed: "yes" }, "/changed"],
  ])("source-state with %s is refused", (_, extra, path) => {
    expect(toPage(state(extra))).toMatchObject({ ok: false, problems: [{ path }] });
  });

  test.each(EDITOR_OUTCOMES)("editor-outcome %s passes", (outcome) => {
    expect(toPage({ version, type: "editor-outcome", itemId: "retry-src", outcome })).toMatchObject(
      {
        ok: true,
      },
    );
  });

  test("editor-outcome with another outcome, or holding the command, is refused", () => {
    const message = { version, type: "editor-outcome", itemId: "retry-src", outcome: "opened" };
    expect(toPage({ ...message, outcome: "crashed" })).toMatchObject({ ok: false });
    expect(toPage({ ...message, argv: ["code", "/x"] })).toMatchObject({ ok: false });
  });

  test("the page's messages are no messages the host sends", () => {
    for (const type of ["open-source", "open-editor"]) {
      expect(toPage({ version, type, itemId: "x" })).toMatchObject({ ok: false });
    }
  });
});

describe("the reading panel transcript", () => {
  test("is kept apart from E1's transcripts, so their replays play E1's alone", () => {
    expect(Object.values(transcripts)).not.toContain(readingPanelTranscript as never);
  });

  test("its session's board link is the ask's, with its token", () => {
    expect(CONTEXT.link).toBe(boardLink(CONTEXT));
    expect(CONTEXT.link).toContain(`?${BOARD_TOKEN_QUERY}=${CONTEXT.token}`);
  });

  test("opens the context ask's board with its token", () => {
    expect(readingPanelTranscript).toMatchObject({ askId: CONTEXT.askId, token: CONTEXT.token });
    const [connect, board] = readingPanelTranscript.steps;
    expect(connect).toMatchObject({
      from: "page",
      message: { type: "connect", token: CONTEXT.token },
    });
    expect(board).toMatchObject({
      from: "host",
      message: { type: "board", document: contextBoardDocument },
    });
  });

  test("every message validates in its direction, and every invalid one is refused", () => {
    for (const step of readingPanelTranscript.steps) {
      if ("message" in step) {
        const direction = step.from === "page" ? "toHost" : "toPage";
        expect({ step, ok: validateBoardMessage(direction, step.message).ok }).toEqual({
          step,
          ok: true,
        });
      }
      if ("invalid" in step) expect(toHost(step.invalid).ok).toBe(false);
    }
  });

  test("holds each new message, a refused open-source naming a path, and a moved socket", () => {
    const kinds = readingPanelTranscript.steps.map((step) =>
      "message" in step
        ? step.message.type
        : "invalid" in step
          ? `invalid ${String(step.invalid.type)}`
          : step.from,
    );
    for (const kind of [
      "open-source",
      "source-state",
      "open-editor",
      "editor-outcome",
      "invalid open-source",
      "moved",
    ]) {
      expect(kinds).toContain(kind);
    }
  });
});

import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION, type SourceStateMessage } from "@askboard/contract";
import {
  LOADING,
  NO_EDITOR_NOTE,
  outcomeNote,
  panelViewOf,
  pathOf,
  sourceUrlOf,
} from "./reading-panel-state.ts";

const version = BOARD_PROTOCOL_VERSION;
const stateOf = (fields: Partial<SourceStateMessage>): SourceStateMessage => ({
  version,
  type: "source-state",
  itemId: "spec",
  status: "available",
  editor: true,
  ...fields,
});

describe("the reading panel's content (excerpts, task 6.6; DESIGN, Reading panel states)", () => {
  test("it starts loading, with nothing to open in an editor", () => {
    expect(LOADING).toEqual({ body: { kind: "loading" }, changed: false, editorEnabled: false });
  });

  test("an available source frames the source view at the anchor, and an editor makes Open in editor usable", () => {
    expect(panelViewOf(stateOf({ line: 40, changed: false }))).toEqual({
      body: { kind: "frame", line: 40 },
      changed: false,
      editorEnabled: true,
    });
  });

  test("a range changed since the agent asked says so", () => {
    expect(panelViewOf(stateOf({ changed: true })).changed).toBe(true);
  });

  test("with no editor the button is disabled and says why", () => {
    expect(panelViewOf(stateOf({ editor: false }))).toEqual({
      body: { kind: "frame" },
      changed: false,
      editorEnabled: false,
      editorNote: NO_EDITOR_NOTE,
    });
    expect(NO_EDITOR_NOTE).toContain("No editor set");
    expect(NO_EDITOR_NOTE).toContain("editor");
  });

  test("a missing, outside, binary and too large source each show one line, and Open in editor stays disabled", () => {
    const lines = {
      missing: "The file is not available.",
      "outside-root": "The path is outside the project, so it is not shown.",
      "not-text": "The file is not text, so it is not shown.",
      "too-large": "The file is too large to show.",
    } as const;
    for (const [status, text] of Object.entries(lines)) {
      const view = panelViewOf(
        stateOf({ status: status as SourceStateMessage["status"], editor: false }),
      );
      expect(view).toEqual({
        body: { kind: "message", text },
        changed: false,
        editorEnabled: false,
      });
    }
  });

  test("an editor's outcome other than opened is a note; opened is none", () => {
    expect(outcomeNote("opened")).toBeUndefined();
    for (const outcome of ["no-editor", "unavailable", "failed", "busy"] as const) {
      expect(outcomeNote(outcome)).toBeString();
    }
  });

  test("the header shows the file's path, without the anchor", () => {
    expect(pathOf("docs/specs/checkout.md#L40-L52")).toBe("docs/specs/checkout.md");
    expect(pathOf("docs/adr/0012.md#Decision")).toBe("docs/adr/0012.md");
    expect(pathOf("src/retry.ts")).toBe("src/retry.ts");
  });

  test("the source view's address holds the token and the scheme, and the line as the fragment", () => {
    expect(
      sourceUrlOf({ askId: "ask-1", itemId: "spec", token: "tok", scheme: "dark", line: 40 }),
    ).toBe("/s/ask-1/spec?t=tok&scheme=dark#L40");
    expect(sourceUrlOf({ askId: "ask-1", itemId: "spec", token: "a b&c", scheme: "light" })).toBe(
      "/s/ask-1/spec?t=a%20b%26c&scheme=light",
    );
  });
});

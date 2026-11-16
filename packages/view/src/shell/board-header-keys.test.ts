import { describe, expect, test } from "bun:test";
import { BOARD_KEYS } from "@askboard/contract";
import { Tooltip } from "radix-ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KeyOverridesContext } from "../catalog/keys/key-table.tsx";
import type { BoardPanel } from "./board-keys-panel.tsx";
import { BoardKeysButton } from "./board-keys-panel.tsx";
import { type HeaderCounts, ProgressRow } from "./progress-row.tsx";

// The header's keys (board-keys, design decision 5; spec: The board's keys are discoverable, The
// board's keys panel, The user's keys on the board's own keys).

const counts = (over: Partial<HeaderCounts> = {}): HeaderCounts => ({
  openLabel: "2 to do",
  onNextOpen: () => {},
  unreadReplies: 0,
  onUnread: () => {},
  changed: 0,
  onChanged: () => {},
  ...over,
});
const panel: BoardPanel = {
  open: false,
  setOpen: () => {},
  elements: {
    button: { current: null },
    anchor: { current: null },
    opener: { current: null },
    closedBy: { current: undefined },
  },
  opening: () => {},
  control: { open: () => {}, anchor: () => {} },
};

const draw = (
  over: {
    counts?: HeaderCounts | undefined;
    keys?: boolean;
    overrides?: Record<string, readonly string[]>;
  } = {},
) =>
  renderToStaticMarkup(
    createElement(
      Tooltip.Provider,
      null,
      createElement(
        KeyOverridesContext.Provider,
        { value: over.overrides },
        // The jump is the progress row's, the Keys button the ask row's (answering-flow-visual).
        ...[
          "counts" in over
            ? over.counts === undefined
              ? null
              : createElement(ProgressRow, { counts: over.counts, prefill: undefined })
            : createElement(ProgressRow, { counts: counts(), prefill: undefined }),
          over.keys === false
            ? null
            : createElement(BoardKeysButton, { panel, takesEdits: true, key: "keys" }),
        ],
      ),
    ),
  );

describe("Next to do", () => {
  test("carries aria-keyshortcuts N", () => {
    expect(draw()).toMatch(/<button[^>]*aria-keyshortcuts="N"[^>]*>Next to do/);
  });

  test("J under overrides, none with an empty list", () => {
    expect(draw({ overrides: { "board.nextOpen": ["j"] } })).toMatch(
      /aria-keyshortcuts="J"[^>]*>Next to do/,
    );
    expect(draw({ overrides: { "board.nextOpen": [] } })).not.toMatch(
      /aria-keyshortcuts="[^"]*"[^>]*>Next to do/,
    );
  });
});

describe("the Keys button", () => {
  test("shows on a live board, as an icon named Keys, after the counts, with ?", () => {
    const html = draw();
    expect(html).toMatch(/<button[^>]*aria-label="Keys"[^>]*aria-keyshortcuts="\?"/);
    expect(html.indexOf('aria-label="Keys"')).toBeGreaterThan(html.indexOf("Next to do"));
    expect(html).toContain('aria-haspopup="dialog"');
  });

  test("shows on the single-question board, which has no counts", () => {
    expect(draw({ counts: undefined })).toContain('aria-label="Keys"');
  });

  test("none on an ended board", () => {
    expect(draw({ counts: undefined, keys: false })).not.toContain('aria-label="Keys"');
  });
});

describe("the table against the rendered header", () => {
  test("each control of the header with aria-keyshortcuts has an entry, and each such entry a control", () => {
    const html = draw();
    const shortcuts = [...html.matchAll(/aria-keyshortcuts="([^"]*)"/g)].map((m) => m[1]);
    // The header carries the jump and the Keys button; the primary is a card's control (group 4).
    expect(shortcuts.sort()).toEqual(["?", "N"]);
    const inHeader = BOARD_KEYS.filter(
      (entry) =>
        entry.part === "board" &&
        (entry.shows === "tool" || entry.shows === "panel") &&
        entry.action !== "board.answer",
    );
    expect(inHeader.map((entry) => entry.action).sort()).toEqual(["board.nextOpen", "keys.open"]);
  });
});

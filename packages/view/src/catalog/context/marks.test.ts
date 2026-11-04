import { describe, expect, test } from "bun:test";
import { markedRuns } from "./marks.ts";

// The controls the source view marks (`server/src/board-host/source-view.ts`): the bidirectional
// controls of the board header's rule, and NUL.
const MARKED = [
  0x0000, 0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068,
  0x2069,
];

const escapeOf = (code: number) => `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;

describe("markedRuns (excerpts, design decision 6; view spec, Bidirectional controls are visible)", () => {
  test("plain text is one unmarked run, and the empty string none", () => {
    expect(markedRuns("const a = 1;")).toEqual([{ text: "const a = 1;", mark: false }]);
    expect(markedRuns("")).toEqual([]);
  });

  test("each marked control is a marker run of its escape, between the plain runs", () => {
    expect(markedRuns('role = "user\u202E // admin"')).toEqual([
      { text: 'role = "user', mark: false },
      { text: "\\u202E", mark: true },
      { text: ' // admin"', mark: false },
    ]);
    expect(markedRuns("\u2066\u2069")).toEqual([
      { text: "\\u2066", mark: true },
      { text: "\\u2069", mark: true },
    ]);
  });

  test("every control the source view marks is marked, and nothing else", () => {
    for (const code of MARKED) {
      expect(markedRuns(String.fromCodePoint(code))).toEqual([
        { text: escapeOf(code), mark: true },
      ]);
    }
    for (const kept of ["\t", "\r", "\u00A0", "\u200B", "\u05D0", "\u{1F600}"]) {
      expect(markedRuns(kept)).toEqual([{ text: kept, mark: false }]);
    }
  });
});

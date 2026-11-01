import { describe, expect, test } from "bun:test";
import { agentTextPiece, agentTextRuns, NOTICE_TEXT_MAX_CHARS } from "../src/index.ts";

// Agent text in a notice (AD-8; EXPERIENCE, Agent-written labels): the system notification, the
// terminal link, the mod's toast and status lines show it as data, its controls and bidirectional
// controls as visible escapes, cut to the contract's notice limit in code points, ending in an
// ellipsis, never inside an escape.

const BIDI = [
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x200e, 0x200f, 0x061c,
];

const escapeOf = (point: number) => `\\u${point.toString(16).toUpperCase().padStart(4, "0")}`;

describe("a piece of agent text in a notice", () => {
  test("is kept as it is when it holds no control and fits", () => {
    const title = `Which database? 🗄️ ${"é".repeat(NOTICE_TEXT_MAX_CHARS - 19)}`;
    expect(Array.from(title)).toHaveLength(NOTICE_TEXT_MAX_CHARS);
    expect(agentTextPiece(title)).toBe(title);
  });

  test("is cut to the limit, ending in an ellipsis", () => {
    const cut = agentTextPiece("x".repeat(NOTICE_TEXT_MAX_CHARS + 50));
    expect(cut).toBe(`${"x".repeat(NOTICE_TEXT_MAX_CHARS - 1)}…`);
  });

  test("counts a character outside the BMP once, and never splits it", () => {
    const title = "𝄞".repeat(NOTICE_TEXT_MAX_CHARS + 1);
    expect(agentTextPiece(title)).toBe(`${"𝄞".repeat(NOTICE_TEXT_MAX_CHARS - 1)}…`);
  });

  test.each(BIDI.map((point) => [escapeOf(point), point] as const))(
    "shows the bidirectional control %s as an escape",
    (visible, point) => {
      expect(agentTextPiece(`a${String.fromCodePoint(point)}b`)).toBe(`a${visible}b`);
    },
  );

  test.each([
    ["NUL, which no process argument may hold", "\u0000", "\\u0000"],
    ["a tab", "\t", "\\u0009"],
    ["a line feed", "\n", "\\u000A"],
    ["ESC", "\u001b", "\\u001B"],
    ["DEL", "\u007f", "\\u007F"],
    ["a C1 control", "\u009b", "\\u009B"],
  ])("shows %s as an escape", (_case, control, visible) => {
    expect(agentTextPiece(`a${control}b`)).toBe(`a${visible}b`);
  });

  test("never cuts inside an escape", () => {
    const text = `${"x".repeat(NOTICE_TEXT_MAX_CHARS - 4)}\u202Eyz`;
    expect(agentTextPiece(text)).toBe(`${"x".repeat(NOTICE_TEXT_MAX_CHARS - 4)}…`);
  });

  test("takes another limit, the ellipsis alone when nothing else fits", () => {
    expect(agentTextPiece("abcdef", 4)).toBe("abc…");
    expect(agentTextPiece("abcd", 4)).toBe("abcd");
    expect(agentTextPiece("abcdef", 1)).toBe("…");
    expect(agentTextPiece("abcdef", 0)).toBe("…");
    expect(agentTextPiece("", 0)).toBe("");
  });
});

describe("agent text as runs (task 8.5: the board header's escapes)", () => {
  test("is one plain run when it holds no control", () => {
    expect(agentTextRuns("fix/retry 🗄️")).toEqual([{ text: "fix/retry 🗄️", escape: false }]);
    expect(agentTextRuns("")).toEqual([]);
  });

  test("shows each control as its own escape run, by the notice's rule, uncut", () => {
    const branch = `fix/\u202Eyrter${"x".repeat(200)}`;
    expect(agentTextRuns(`fix/\u202Eyrter\u0007`)).toEqual([
      { text: "fix/", escape: false },
      { text: "\\u202E", escape: true },
      { text: "yrter", escape: false },
      { text: "\\u0007", escape: true },
    ]);
    expect(
      agentTextRuns(branch)
        .map((run) => run.text)
        .join(""),
    ).toBe(agentTextPiece(branch, Number.POSITIVE_INFINITY));
  });

  test("keeps two controls in a row as two escapes", () => {
    expect(agentTextRuns("\u2066\u2069")).toEqual([
      { text: "\\u2066", escape: true },
      { text: "\\u2069", escape: true },
    ]);
  });
});

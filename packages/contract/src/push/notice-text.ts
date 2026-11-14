// Agent text in a notice (AD-8; EXPERIENCE, Agent-written labels; design decisions 6, 7 and 9):
// the system notification, the terminal link, and the mod's toast and status lines show agent text
// as data. Control characters (C0, DEL, C1), which a terminal or a notifier could act on, NUL among
// them, which no process argument may hold, and bidirectional controls, which could reorder what
// the user reads, show as visible `\uXXXX` escapes; then the text is cut to the notice limit in
// code points, ending in an ellipsis, never inside an escape. Plain ECMAScript, for the mod too.

import { NOTICE_TEXT_MAX_CHARS } from "./constants.ts";

const ELLIPSIS = "…";

// The bidirectional controls of the board header's rule.
const BIDI: ReadonlySet<number> = new Set([
  0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
]);

/**
 * Whether agent text shows this code point as a `\uXXXX` escape: the C0 controls (a line feed and
 * a tab among them), DEL, the C1 controls and the bidirectional controls. The contract's one list
 * of escaped characters: `agentTextRuns` reads it, and so does a Document review's check of the
 * characters its document refuses (document-review, design decision 1).
 */
export const isEscapedCodePoint = (code: number): boolean =>
  code < 0x20 || (code >= 0x7f && code <= 0x9f) || BIDI.has(code);

const shown = (point: string): string => {
  const code = point.codePointAt(0) ?? 0;
  return isEscapedCodePoint(code)
    ? `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`
    : point;
};

// In code points: an escape is six ASCII characters, any other unit one code point, which is two
// UTF-16 units outside the BMP.
const sizeOf = (unit: string): number => (unit.length > 2 ? unit.length : 1);

/** A run of agent text: shown as it is, or one control shown as its escape. */
export type AgentTextRun = { readonly text: string; readonly escape: boolean };

/**
 * Agent text as runs, uncut, by the same rule: each control an escape run of its own, for a view
 * that shows escapes apart from the text around them (the board header's paths, design decision 12).
 */
export const agentTextRuns = (text: string): AgentTextRun[] => {
  const runs: AgentTextRun[] = [];
  for (const unit of Array.from(text, shown)) {
    const escaped = unit.length > 2;
    const last = runs.at(-1);
    if (!escaped && last !== undefined && !last.escape) {
      runs[runs.length - 1] = { text: last.text + unit, escape: false };
    } else {
      runs.push({ text: unit, escape: escaped });
    }
  }
  return runs;
};

/** A piece of agent text as a notice shows it: its escapes visible, at most `max` code points. */
export const agentTextPiece = (text: string, max: number = NOTICE_TEXT_MAX_CHARS): string => {
  const units = Array.from(text, shown);
  const total = units.reduce((sum, unit) => sum + sizeOf(unit), 0);
  if (total <= max) return units.join("");
  let kept = "";
  let length = 0;
  for (const unit of units) {
    if (length + sizeOf(unit) > max - 1) break;
    kept += unit;
    length += sizeOf(unit);
  }
  return `${kept}${ELLIPSIS}`;
};

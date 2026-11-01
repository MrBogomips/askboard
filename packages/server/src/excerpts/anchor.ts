// Anchors, step 6 of design decision 3 (proposal A5; board-host spec, Anchors find their lines).
// A line range resolves in any file that has its lines. A heading or an ID resolves only in
// Markdown: the first ATX heading outside fenced code whose text equals the anchor, else the first
// holding it as a whole word, giving the heading's section up to the next heading of the same or a
// higher level. AskBoard never searches beyond headings (FR-9, Out of Scope). Pure functions.

import {
  EXCERPT_MAX_BYTES,
  EXCERPT_MAX_LINES,
  type LineRange,
  type PointerAnchor,
} from "@askboard/contract";
import type { Refused } from "./refused.ts";

// The patterns run on lines an agent can write, up to the anchor limit: each must take linear time.
// `s` lets `.` take U+2028 and U+2029 too, so `(.*)$` always matches and nothing backtracks
// (security review, finding R1).

// An ATX heading: up to three spaces, one to six `#`, then a space, a tab or the line's end.
const HEADING = /^ {0,3}(#{1,6})(?:[ \t](.*))?$/s;
// A fence: up to three spaces, then three or more backticks or tildes, and an info string.
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/s;
// A closing fence: the same character, a run at least as long, and nothing after it but blanks.
const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
// Letters, digits, `-`, `_` and `.`: an ID's neighbours, so `FR-8` is neither `FR-80` nor `XFR-8`.
const WORD = /[\p{L}\p{N}_.-]/u;

type Heading = { readonly line: number; readonly level: number; readonly text: string };
type Fence = { readonly char: string; readonly length: number };

const opensFence = (line: string): Fence | undefined => {
  const match = FENCE.exec(line);
  const run = match?.[1];
  if (run === undefined) return undefined;
  // A backtick fence's info string holds no backtick (CommonMark).
  if (run.startsWith("`") && match?.[2]?.includes("`")) return undefined;
  return { char: run.charAt(0), length: run.length };
};

const closesFence = (line: string, fence: Fence): boolean => {
  const run = CLOSING_FENCE.exec(line)?.[1];
  return run?.startsWith(fence.char) === true && run.length >= fence.length;
};

// A heading's text without its closing run of `#`, which stands alone or after a space or a tab;
// `text` is trimmed. Scanned by hand, from the end, in linear time.
const withoutClosingRun = (text: string): string => {
  let start = text.length;
  while (start > 0 && text[start - 1] === "#") start -= 1;
  if (start === text.length) return text;
  if (start === 0) return "";
  const before = text[start - 1];
  return before === " " || before === "\t" ? text.slice(0, start).trim() : text;
};

/** The ATX headings outside fenced code, with their text trimmed and closing run dropped. */
const headingsOf = (lines: readonly string[]): Heading[] => {
  const headings: Heading[] = [];
  let fence: Fence | undefined;
  lines.forEach((line, index) => {
    if (fence !== undefined) {
      if (closesFence(line, fence)) fence = undefined;
      return;
    }
    fence = opensFence(line);
    const match = fence === undefined ? HEADING.exec(line) : null;
    if (match?.[1] === undefined) return;
    const text = withoutClosingRun((match[2] ?? "").trim());
    headings.push({ line: index + 1, level: match[1].length, text });
  });
  return headings;
};

// The character on each side of `at`, as whole code points.
const charBefore = (text: string, at: number): string => {
  const low = text.charCodeAt(at - 1);
  const start = low >= 0xdc00 && low <= 0xdfff && at >= 2 ? at - 2 : at - 1;
  return at === 0 ? "" : String.fromCodePoint(text.codePointAt(start) ?? 0);
};

const charAfter = (text: string, at: number): string =>
  at >= text.length ? "" : String.fromCodePoint(text.codePointAt(at) ?? 0);

const holdsWord = (text: string, word: string): boolean => {
  for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
    const before = charBefore(text, at);
    const after = charAfter(text, at + word.length);
    if (!WORD.test(before) && !WORD.test(after)) return true;
  }
  return false;
};

const isBlank = (line: string | undefined): boolean => line?.trim() === "";

/** A heading's section, without its trailing blank lines. */
const sectionOf = (lines: readonly string[], headings: readonly Heading[], at: number) => {
  const heading = headings[at] as Heading;
  const next = headings.slice(at + 1).find((other) => other.level <= heading.level);
  let end = next === undefined ? lines.length : next.line - 1;
  while (end > heading.line && isBlank(lines[end - 1])) end -= 1;
  return { start: heading.line, end };
};

const findSection = (lines: readonly string[], anchor: string): LineRange | undefined => {
  const wanted = anchor.trim();
  if (wanted === "") return undefined;
  const headings = headingsOf(lines);
  let at = headings.findIndex((heading) => heading.text === wanted);
  if (at === -1) at = headings.findIndex((heading) => holdsWord(heading.text, wanted));
  return at === -1 ? undefined : sectionOf(lines, headings, at);
};

/** The lines an anchor names in a file of `lines`, or undefined when the file has none such. */
export const findAnchor = (
  lines: readonly string[],
  anchor: PointerAnchor,
  markdown: boolean,
): LineRange | undefined => {
  if (anchor.kind === "lines") {
    return anchor.end <= lines.length ? { start: anchor.start, end: anchor.end } : undefined;
  }
  return markdown ? findSection(lines, anchor.text) : undefined;
};

/** An excerpt's text, its lines joined by LF, or `too-large` past the excerpt limits. */
export const excerptOf = (
  lines: readonly string[],
  range: LineRange,
): { readonly text: string } | Refused => {
  if (range.end - range.start + 1 > EXCERPT_MAX_LINES) return { refused: "too-large" };
  const text = lines.slice(range.start - 1, range.end).join("\n");
  return Buffer.byteLength(text, "utf8") > EXCERPT_MAX_BYTES ? { refused: "too-large" } : { text };
};

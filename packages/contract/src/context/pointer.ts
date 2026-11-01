// The pointer grammar (Consistency Conventions, "Excerpts and media"; excerpts, design decision 2;
// proposal A6): `path#anchor`, read as text alone. It touches no file, so `excerpts`, `ask-core`
// and the view read a pointer the same way, and a pointer that could leave the root by its text
// is refused before anything reaches the file system.

import { POINTER_MAX_CHARS } from "../limits.ts";

/** Lines `start` to `end` of a file, counted from 1, both included. */
export type LineRange = { readonly start: number; readonly end: number };

/** What follows the first `#`: a line range, or a heading or an ID to find. */
export type PointerAnchor =
  | ({ readonly kind: "lines" } & LineRange)
  | { readonly kind: "name"; readonly text: string };

/** A pointer that reads: a root-relative path, and an anchor when the pointer has a `#`. */
export type Pointer = { readonly path: string; readonly anchor?: PointerAnchor };

/** Why a pointer's text is not a pointer. */
export type PointerProblem =
  | "too-long"
  | "control-character"
  | "empty-path"
  | "absolute-path"
  | "backslash"
  | "empty-segment"
  | "dot-segment"
  | "empty-anchor";

export type InvalidPointer = { readonly invalid: PointerProblem };

export type PointerReading = Pointer | InvalidPointer;

// Every C0 control, DEL and every C1 control: none belongs in a path or a heading.
const CONTROL = /\p{Cc}/u;
// `L<start>-L<end>`, with no leading zero, so `L0-L2` and `L01-L02` read as names.
const LINE_RANGE = /^L([1-9][0-9]*)-L([1-9][0-9]*)$/;

// Counted in Unicode characters, as JSON Schema's `maxLength` counts them. A string of more than
// twice the limit in UTF-16 code units holds more characters than the limit, so it is not walked.
const isTooLong = (text: string): boolean =>
  text.length > POINTER_MAX_CHARS &&
  (text.length > 2 * POINTER_MAX_CHARS || [...text].length > POINTER_MAX_CHARS);

const pathProblem = (path: string): PointerProblem | undefined => {
  if (path === "") return "empty-path";
  if (path.startsWith("/")) return "absolute-path";
  if (path.includes("\\")) return "backslash";
  for (const segment of path.split("/")) {
    if (segment === "") return "empty-segment";
    if (segment === "." || segment === "..") return "dot-segment";
  }
  return undefined;
};

const anchorOf = (text: string): PointerAnchor => {
  const match = LINE_RANGE.exec(text);
  const start = Number(match?.[1]);
  const end = Number(match?.[2]);
  return match !== null && Number.isSafeInteger(end) && start <= end
    ? { kind: "lines", start, end }
    : { kind: "name", text };
};

/**
 * Reads a pointer: the text up to the first `#` is the path, the rest the anchor. A pointer over
 * `POINTER_MAX_CHARS`, holding a control character, or whose path is empty, absolute, holds a
 * backslash or an empty, `.` or `..` segment is invalid, as is an empty anchor. Nothing is
 * decoded or normalised: `%2e%2e` is a file name like any other.
 */
export const readPointer = (text: string): PointerReading => {
  if (isTooLong(text)) return { invalid: "too-long" };
  if (CONTROL.test(text)) return { invalid: "control-character" };
  const hash = text.indexOf("#");
  const path = hash === -1 ? text : text.slice(0, hash);
  const problem = pathProblem(path);
  if (problem !== undefined) return { invalid: problem };
  if (hash === -1) return { path };
  const anchor = text.slice(hash + 1);
  if (anchor === "") return { invalid: "empty-anchor" };
  return { path, anchor: anchorOf(anchor) };
};

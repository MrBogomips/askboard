// Text a file chose, shown on one line (keyboard-shortcuts-help, design decision 19; core spec: File
// text on stderr is escaped; review 8.6, X-2): a JSON pointer, a key, a value, an action or a
// combination that a configuration file holds reaches stderr and the settings panel. `JSON.stringify`
// quotes it and escapes the C0 controls, but leaves raw DEL, the C1 controls (U+0085 and U+009B are
// terminals' line-break and escape-sequence introducers), the line and paragraph separators U+2028
// and U+2029, and the bidirectional controls, any of which could split, colour or reorder a line
// no file should be able to. These two write them as `\uXXXX` as well. The set is the contract's
// `isEscapedCodePoint` (`push/notice-text.ts`, whose list stays as it is) and the two separators.
// Plain ECMAScript.

import { isEscapedCodePoint } from "../../push/notice-text.ts";

const LINE_SEPARATOR = 0x2028;
const PARAGRAPH_SEPARATOR = 0x2029;

const escaped = (code: number): boolean =>
  isEscapedCodePoint(code) || code === LINE_SEPARATOR || code === PARAGRAPH_SEPARATOR;

// The body of `JSON.stringify(text)` without its quotes, with each code point it left raw that
// `escaped` names written as `\uXXXX`, in the lower-case form JSON itself uses. The body holds no C0
// control, and a lone surrogate is already an escape, so each code point is a whole character.
const body = (text: string): string =>
  Array.from(JSON.stringify(text).slice(1, -1), (point) => {
    const code = point.codePointAt(0) as number;
    return escaped(code) ? `\\u${code.toString(16).padStart(4, "0")}` : point;
  }).join("");

/**
 * File text as a diagnostic or a panel shows it: quoted as JSON, with DEL, the C1 controls,
 * U+2028, U+2029 and the bidirectional controls also written as `\uXXXX`, so the result is one line
 * and holds none of them raw. `JSON.parse` of it gives the text back; text in Italian, Chinese or
 * emoji shows as it is.
 */
export const quoteFileText = (text: string): string => `"${body(text)}"`;

/**
 * The same escaping without the quotes, for a view that isolates the text itself (the settings
 * panel's `bdi`, design decision 19).
 */
export const escapeFileText = (text: string): string => body(text);

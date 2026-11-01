// Text, step 6 of design decision 3 (proposal B5): UTF-8 with a leading BOM dropped, a NUL byte or
// invalid UTF-8 making a file no text; lines split on LF, CRLF and CR. Pure functions over bytes.

import type { TextMediaType } from "@askboard/contract";

// `fatal` refuses invalid UTF-8; a leading BOM is dropped, since `ignoreBOM` is false by default.
const UTF8 = new TextDecoder("utf-8", { fatal: true });
const LINE_BREAK = /\r\n|\r|\n/;
const MARKDOWN = /\.(?:md|markdown)$/i;

/** The file's text, or undefined when it holds a NUL byte or is not valid UTF-8. */
export const decodeText = (bytes: Uint8Array): string | undefined => {
  if (bytes.includes(0)) return undefined;
  try {
    return UTF8.decode(bytes);
  } catch (error) {
    // The fatal decoder's one way of saying the bytes are not UTF-8.
    if (error instanceof TypeError) return undefined;
    throw error;
  }
};

/** The text's lines, without their breaks; a final break starts no line. */
export const splitLines = (text: string): string[] => {
  if (text === "") return [];
  const lines = text.split(LINE_BREAK);
  if (lines.at(-1) === "") lines.pop();
  return lines;
};

/** `text/markdown` for a `.md` or `.markdown` file, in any case, and `text/plain` otherwise. */
export const textMediaTypeOf = (path: string): TextMediaType =>
  MARKDOWN.test(path) ? "text/markdown" : "text/plain";

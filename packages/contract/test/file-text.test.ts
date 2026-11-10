// Text a file chose, shown on one line (keyboard-shortcuts-help, task 8.11; design decision 19; core
// spec: File text on stderr is escaped; review 8.6, X-2): `JSON.stringify` quotes it and escapes the
// C0 controls, but leaves DEL, the C1 controls, U+2028, U+2029 and the bidirectional controls raw.
// `quoteFileText` writes those as `\uXXXX` too, so no line it gives can be split, coloured or
// reordered by what a file holds.

import { describe, expect, test } from "bun:test";
import { escapeFileText, isEscapedCodePoint, quoteFileText } from "../src/index.ts";

// What JSON.stringify leaves raw and the helper escapes, apart from the C0 controls it escapes itself.
const RAW_AFTER_JSON: readonly number[] = [
  0x7f,
  0x85,
  0x9b,
  0x2028,
  0x2029,
  0x061c,
  0x200e,
  0x200f,
  ...[0x202a, 0x202b, 0x202c, 0x202d, 0x202e],
  ...[0x2066, 0x2067, 0x2068, 0x2069],
];
const C0_AND_LINE_BREAKS: readonly number[] = [0x1b, 0x0d, 0x0a, 0x00, 0x09];

// Built from code points: a formatter writes a U+2028 or U+2029 escape in a source file back as the raw character.
const SEPARATORS = String.fromCodePoint(0x2028, 0x2029);

const written = (code: number): string => `\\u${code.toString(16).padStart(4, "0")}`;
const isRaw = (text: string, code: number): boolean => text.includes(String.fromCodePoint(code));
const hasLineBreak = (text: string): boolean =>
  ["\r", "\n", ...Array.from(SEPARATORS)].some((separator) => text.includes(separator));
const hasSurrogate = (text: string): boolean =>
  Array.from(text, (unit) => unit.charCodeAt(0)).some((code) => code >= 0xd800 && code <= 0xdfff);
const heldBack = (code: number): boolean =>
  isEscapedCodePoint(code) || code === 0x2028 || code === 0x2029;

describe("quoteFileText", () => {
  test.each(RAW_AFTER_JSON.map((code) => [code.toString(16), code] as const))(
    "U+%s, which JSON.stringify leaves raw, is written as \\uXXXX",
    (_, code) => {
      const text = `a${String.fromCodePoint(code)}b`;
      expect(JSON.stringify(text).includes(String.fromCodePoint(code))).toBe(true);
      expect(quoteFileText(text)).toBe(`"a${written(code)}b"`);
    },
  );

  test("it is JSON.stringify with those code points written as escapes, for each", () => {
    for (const code of RAW_AFTER_JSON) {
      const text = String.fromCodePoint(code);
      expect(quoteFileText(text)).toBe(
        JSON.stringify(text).split(String.fromCodePoint(code)).join(written(code)),
      );
    }
  });

  test.each(
    [...RAW_AFTER_JSON, ...C0_AND_LINE_BREAKS].map((code) => [code.toString(16), code] as const),
  )(
    "U+%s is not raw in the result, no line break is, and JSON.parse gives the text back",
    (_, code) => {
      const text = `x${String.fromCodePoint(code)}y`;
      const result = quoteFileText(text);
      expect(isRaw(result, code)).toBe(false);
      expect(hasLineBreak(result)).toBe(false);
      expect(JSON.parse(result)).toBe(text);
    },
  );

  test("every code point of the BMP: none of those held back is raw, and the text comes back", () => {
    for (let code = 0; code <= 0xffff; code += 1) {
      const text = String.fromCharCode(code);
      const result = quoteFileText(text);
      expect(JSON.parse(result)).toBe(text);
      if (heldBack(code) || code < 0x20) {
        expect({ code, raw: result.includes(text) }).toEqual({ code, raw: false });
      }
    }
  });

  test("the escapes of the text itself stay: a backslash, a quote, and a literal \\u0085", () => {
    expect(quoteFileText('a"b\\c')).toBe('"a\\"b\\\\c"');
    expect(JSON.parse(quoteFileText("\\u0085"))).toBe("\\u0085");
    expect(quoteFileText("\\u0085")).toBe('"\\\\u0085"');
  });

  test("Italian, CJK and emoji text show as they are", () => {
    for (const text of [
      "perché è così, già",
      "日本語のキー",
      "👍🏽 and 😀",
      "Ünï",
      "ça va, «oui»",
    ]) {
      expect(quoteFileText(text)).toBe(JSON.stringify(text));
      expect(quoteFileText(text)).toContain(text);
    }
  });

  test("a lone surrogate is escaped by JSON.stringify and comes back", () => {
    for (const text of ["\ud800", "a\udfffb"]) {
      const result = quoteFileText(text);
      expect(hasSurrogate(result)).toBe(false);
      expect(JSON.parse(result)).toBe(text);
    }
  });

  test("an empty text is two quotes, and several escapes in a row are all written", () => {
    expect(quoteFileText("")).toBe('""');
    expect(quoteFileText(`${SEPARATORS}\u202e\x1b`)).toBe('"\\u2028\\u2029\\u202e\\u001b"');
  });
});

describe("escapeFileText", () => {
  test("is the same escaping without the quotes", () => {
    for (const text of [
      "",
      "plain",
      'a"b',
      `${SEPARATORS}x\u202ey\u0085`,
      "perché 日本語 😀",
      "\x1b[31m\n",
    ]) {
      expect(escapeFileText(text)).toBe(quoteFileText(text).slice(1, -1));
    }
  });

  test("holds none of the code points held back, and no line break", () => {
    const all = String.fromCodePoint(...RAW_AFTER_JSON, ...C0_AND_LINE_BREAKS);
    const result = escapeFileText(all);
    for (const code of [...RAW_AFTER_JSON, ...C0_AND_LINE_BREAKS]) {
      expect(isRaw(result, code)).toBe(false);
    }
    expect(JSON.parse(`"${result}"`)).toBe(all);
  });
});

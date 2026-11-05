import { describe, expect, test } from "bun:test";
import { imageMediaTypeOf } from "../../src/excerpts/image.ts";
import { decodeText, splitLines, textMediaTypeOf } from "../../src/excerpts/text.ts";

// Board-host spec, Text and images are recognised by content (excerpts, task 2.4; design decision
// 3, step 6; proposal B5 and B6): tables over bytes, with no file system.

const bytes = (...parts: readonly (string | readonly number[])[]): Uint8Array =>
  Uint8Array.from(
    parts.flatMap((part) =>
      typeof part === "string" ? [...new TextEncoder().encode(part)] : part,
    ),
  );

describe("text (proposal B5)", () => {
  test.each([
    ["plain UTF-8", bytes("# Título\nlínea\n"), "# Título\nlínea\n"],
    ["a leading BOM dropped", bytes([0xef, 0xbb, 0xbf], "# A\n"), "# A\n"],
    ["only the leading BOM dropped", bytes([0xef, 0xbb, 0xbf], "a﻿b"), "a﻿b"],
    ["an empty file", bytes(), ""],
    ["four-byte characters", bytes("😀 ok"), "😀 ok"],
    ["a bidirectional control kept as written", bytes("a‮b"), "a‮b"],
  ] as const)("%s decodes", (_, input, expected) => {
    expect(decodeText(input)).toBe(expected);
  });

  test.each([
    ["a NUL byte", bytes("# A\n", [0x00], "b")],
    ["a NUL byte alone", bytes([0x00])],
    ["a lone continuation byte", bytes("a", [0x80], "b")],
    ["a truncated sequence", bytes("a", [0xe2, 0x82])],
    ["an overlong encoding", bytes([0xc0, 0xaf])],
    ["an encoded surrogate", bytes([0xed, 0xa0, 0x80])],
    ["Latin-1", bytes([0x63, 0x61, 0x66, 0xe9])],
    ["UTF-16 with its BOM", bytes([0xff, 0xfe, 0x41, 0x00])],
    ["a PNG", bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ] as const)("%s is not text", (_, input) => {
    expect(decodeText(input)).toBeUndefined();
  });

  test.each([
    ["LF", "a\nb\nc", ["a", "b", "c"]],
    ["CRLF", "a\r\nb\r\nc\r\n", ["a", "b", "c"]],
    ["CR", "a\rb\rc\r", ["a", "b", "c"]],
    ["mixed", "a\r\nb\rc\nd", ["a", "b", "c", "d"]],
    ["a final newline adds no line", "a\n", ["a"]],
    ["blank lines kept", "a\n\n\nb\n\n", ["a", "", "", "b", ""]],
    ["one line without a newline", "a", ["a"]],
    ["a newline alone", "\n", [""]],
    ["nothing", "", []],
  ] as const)("lines split on %s", (_, input, expected) => {
    expect(splitLines(input)).toEqual([...expected]);
  });

  test.each([
    ["docs/a.md", "text/markdown"],
    ["docs/a.markdown", "text/markdown"],
    ["README.MD", "text/markdown"],
    ["notes.Markdown", "text/markdown"],
    ["src/retry.ts", "text/plain"],
    ["docs/a.mdx", "text/plain"],
    ["docs/a.md.txt", "text/plain"],
    ["docs/md", "text/plain"],
    ["Makefile", "text/plain"],
  ] as const)("%s is %s", (path, mediaType) => {
    expect(textMediaTypeOf(path)).toBe(mediaType);
  });
});

describe("images, by their first bytes (proposal B6)", () => {
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  test.each([
    ["PNG", bytes(PNG, [0, 0, 0, 13]), "image/png"],
    ["JPEG", bytes([0xff, 0xd8, 0xff, 0xe0, 0, 16]), "image/jpeg"],
    ["GIF87a", bytes("GIF87a", [1, 0, 1, 0]), "image/gif"],
    ["GIF89a", bytes("GIF89a", [1, 0, 1, 0]), "image/gif"],
    ["WebP", bytes("RIFF", [36, 0, 0, 0], "WEBPVP8 "), "image/webp"],
  ] as const)("%s is recognised", (_, input, mediaType) => {
    expect(imageMediaTypeOf(input)).toBe(mediaType);
  });

  test.each([
    ["an SVG", bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    ["an SVG with an XML declaration", bytes('<?xml version="1.0"?><svg/>')],
    ["HTML named as a PNG", bytes("<!doctype html><script>alert(1)</script>")],
    ["a truncated PNG header", bytes(PNG.slice(0, 4))],
    ["a truncated JPEG header", bytes([0xff, 0xd8])],
    ["a truncated GIF header", bytes("GIF8")],
    ["a GIF of another version", bytes("GIF88a", [1, 0])],
    ["a truncated WebP header", bytes("RIFF", [36, 0, 0, 0], "WEB")],
    ["a RIFF file that is no WebP", bytes("RIFF", [36, 0, 0, 0], "WAVEfmt ")],
    ["a PDF", bytes("%PDF-1.7\n")],
    ["text", bytes("# A\n")],
    ["nothing", bytes()],
  ] as const)("%s is not an image", (_, input) => {
    expect(imageMediaTypeOf(input)).toBeUndefined();
  });
});

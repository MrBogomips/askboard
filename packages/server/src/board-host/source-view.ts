// The source view (excerpts, design decision 5; proposal A2, A11, A14; AD-8): the page `/s/` serves
// into the reading panel's sandboxed frame, built from a file's current text. Every character of
// the path and the text is escaped, so nothing the file holds becomes markup; bidirectional
// controls, which could reorder what the user reads, and NUL show as visible markers. Each line is a
// span `L<n>`, its number in a span of its own that a copy leaves out. One static stylesheet, whose
// hash the page's policy names, and nothing else: no script, link, base or form.

import { createHash } from "node:crypto";
import { sourceViewPolicy } from "@askboard/contract";
import type { SourceText } from "@askboard/core";

/** The board's colour scheme, which the reading panel passes in the frame's URL. */
export type SourceScheme = "light" | "dark";

export type SourceViewInput = {
  /** The pointer's path, as the agent wrote it. */
  readonly path: string;
  /** What ask-core read of the file now. */
  readonly source: SourceText;
  /** The system's when absent. */
  readonly scheme?: SourceScheme;
};

// DESIGN's code type and the reading panel's colours (popover, foreground, muted-foreground, muted),
// light, then dark by the board's scheme or the system's. No font loads (`default-src 'none'`):
// JetBrains Mono shows where it is installed, else the system's monospace face.
const STYLE = [
  ":root{color-scheme:light;--bg:#fffdf9;--fg:#2b2722;--dim:#6b6358;--hit:#f0ece4}",
  ':root[data-scheme="dark"]{color-scheme:dark;--bg:#2c2925;--fg:#ebe6dd;--dim:#a39a8d;--hit:#161411}',
  "@media (prefers-color-scheme:dark){:root:not([data-scheme]){color-scheme:dark;--bg:#2c2925;--fg:#ebe6dd;--dim:#a39a8d;--hit:#161411}}",
  "body{margin:0;background:var(--bg);color:var(--fg);font:12px/1.5 'JetBrains Mono',ui-monospace,Menlo,monospace;font-variant-ligatures:none}",
  "pre{margin:0;padding:8px 0;font:inherit;overflow-x:auto}",
  ".line{display:block;min-height:1.5em;padding:0 12px;white-space:pre}",
  ".hit{background:var(--hit)}",
  ".n{display:inline-block;min-width:5ch;margin-right:16px;text-align:right;color:var(--dim);user-select:none;-webkit-user-select:none}",
  ".mark,.state,.path{color:var(--dim)}",
  ".state{margin:0;padding:12px}",
  ".path{color:var(--fg)}",
].join("");

/** The SHA-256 of the page's stylesheet, in lowercase hex. */
export const SOURCE_VIEW_STYLE_SHA256 = createHash("sha256").update(STYLE, "utf8").digest("hex");

/** The policy every source view is served with. */
export const SOURCE_VIEW_POLICY = sourceViewPolicy(SOURCE_VIEW_STYLE_SHA256);

// The bidirectional controls of the board header's rule (contract, `notice-text.ts`), and NUL.
const MARKED: ReadonlySet<number> = new Set([
  0x0000, 0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068,
  0x2069,
]);

// A carriage return as a reference, since the HTML parser turns a literal one into a line feed.
const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "\r": "&#13;",
};

const hex = (code: number): string => code.toString(16).toUpperCase().padStart(4, "0");

const marker = (point: string): string => {
  const code = hex(point.codePointAt(0) ?? 0);
  return `<span class="mark" data-code="${code}">\\u${code}</span>`;
};

// Every character that is escaped or marked, written as `\u` escapes.
const SPECIAL = new RegExp(
  `[&<>"'\\r${[...MARKED].map((code) => `\\u${hex(code)}`).join("")}]`,
  "g",
);

/** Text as HTML text: every special character escaped, each marked control a marker. */
export const escapeText = (text: string): string =>
  text.replace(SPECIAL, (point) =>
    MARKED.has(point.codePointAt(0) ?? 0) ? marker(point) : (ESCAPES[point] ?? point),
  );

const BYTES = new Intl.NumberFormat("en-US");

// The one line of a source that is not shown (proposal A14's provisional strings).
const stateLine = (source: Exclude<SourceText, { status: "available" }>): string => {
  switch (source.status) {
    case "missing":
    case "outside-root":
      return "This file is not available";
    case "not-text":
      return "This file cannot be shown as text";
    case "too-large":
      return "This file is too large to show here";
  }
};

const unavailable = (path: string, source: Exclude<SourceText, { status: "available" }>) => {
  const size = source.status === "too-large" ? ` (${BYTES.format(source.size)} bytes)` : "";
  return `<p class="state">${stateLine(source)}: <span class="path">${escapeText(path)}</span>${size}</p>`;
};

const lines = (source: Extract<SourceText, { status: "available" }>): string => {
  const { hit } = source;
  const spans = source.text.split("\n").map((text, index) => {
    const n = index + 1;
    const kind = hit !== undefined && n >= hit.start && n <= hit.end ? "line hit" : "line";
    return `<span id="L${n}" class="${kind}"><span class="n">${n}</span>${escapeText(text)}</span>`;
  });
  return `<pre>${spans.join("")}</pre>`;
};

/** The source view's page: the file's lines, or one line saying why it is not shown. */
export const sourceViewPage = ({ path, source, scheme }: SourceViewInput): string =>
  [
    "<!doctype html>",
    scheme === undefined ? '<html lang="en">' : `<html lang="en" data-scheme="${scheme}">`,
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeText(path)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    source.status === "available" ? lines(source) : unavailable(path, source),
    "</body>",
    "</html>",
    "",
  ].join("\n");

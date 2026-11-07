// Checks on what the view build writes, each naming the chunk it fails (AD-9, renderer row 18).
// Every script and style is inlined: the board page holds its own, and `assemble` inlines the
// chunks into the view's srcdoc, where the CSP admits each by the hash of its exact text.

/** A classic script that holds `import.meta` does not parse, in any engine. */
export const importMetaProblem = (chunk: string, code: string): string | undefined =>
  /\bimport\s*\.\s*meta\b/.test(code)
    ? `the chunk "${chunk}" holds import.meta, which a classic script cannot: its code must not read it`
    : undefined;

// The HTML parser turns a carriage return into a line feed and a NUL into U+FFFD before a script
// or style runs, so the text it hashes would no longer be the file's.
const rawCharacterProblems = (chunk: string, what: string, text: string): string[] => [
  ...(text.includes("\r")
    ? [`the chunk "${chunk}" holds a raw carriage return in its ${what}`]
    : []),
  ...(text.includes("\0") ? [`the chunk "${chunk}" holds a raw NUL character in its ${what}`] : []),
];

/**
 * A script as it can sit inside `<script>`: `</script` would end the element and `<!--` changes
 * how the parser reads the rest. Minified code holds them only in strings, templates and regular
 * expressions, where `<\/script` and `\x3C!--` mean the same text.
 */
export const inlineScript = (
  chunk: string,
  code: string,
): { readonly code: string; readonly problems: readonly string[] } => ({
  code: code.replace(/<\/(script)/gi, "<\\/$1").replaceAll("<!--", "\\x3C!--"),
  problems: rawCharacterProblems(chunk, "script", code),
});

/** A stylesheet that cannot sit inside `<style>` as it is. */
export const inlineStyleProblem = (chunk: string, css: string): string | undefined => {
  if (/<\/style/i.test(css)) return `the chunk "${chunk}" holds a style end tag in its styles`;
  return rawCharacterProblems(chunk, "styles", css)[0];
};

// The board page cannot compile a schema under its CSP: it bundles Ajv's run-time helpers only,
// which the standalone validators need, and never the contract's validation module.
const COMPILER_INPUTS = [
  /\/ajv\/dist\/(?!runtime\/)/,
  /(^|\/)packages\/contract\/src\/validate\.ts$/,
];

/** The board page script's inputs that would bring a schema compiler, and so `new Function`. */
export const boardPageInputProblems = (inputs: readonly string[]): string[] =>
  inputs
    .filter((input) => COMPILER_INPUTS.some((pattern) => pattern.test(input)))
    .map((input) => `the board page bundles ${input}, which compiles schemas at run time`);

/** A chunk as the host-only check reads it: its name, its mark and the chunks it needs. */
export type NeedingChunk = {
  readonly name: string;
  readonly hostOnly?: boolean | undefined;
  readonly needs: readonly string[];
};

/**
 * Host-only chunks (snapshot design decision 5) are loaded only by a view with a host, so a chunk
 * that is not one must not need one: it would pull the chunk into a Snapshot. The shared-modules
 * plugin records a need for every import of a shared module, so this fails a static import.
 */
export const hostOnlyNeedProblems = (chunks: readonly NeedingChunk[]): string[] => {
  const hostOnly = new Set(
    chunks.filter((chunk) => chunk.hostOnly === true).map(({ name }) => name),
  );
  return chunks
    .filter((chunk) => chunk.hostOnly !== true)
    .flatMap(({ name, needs }) =>
      needs
        .filter((needed) => hostOnly.has(needed))
        .map(
          (needed) =>
            `the chunk "${name}" needs the host-only chunk "${needed}", which only a view with a host loads: take it from the shared-module registry when there is one, never by an import`,
        ),
    );
};

const URL_CALL = /url\(/gi;
const IMPORT_RULE = /@import\b/gi;
const SHOWN_CHARACTERS = 80;
const MAX_ESCAPE_DIGITS = 6;
const MAX_CODE_POINT = 0x10ffff;

// The characters CSS Syntax gives a meaning outside identifiers: an escape that would read as one
// stays an escape, so decoding never makes a string, a comment, a function or a blank that the
// browser would not read.
const STRUCTURAL = new Set(['"', "'", "(", ")", "\\", "/", "*", " ", "\t", "\n", "\r", "\f"]);
const BLANKS = new Set([" ", "\t", "\n", "\r", "\f"]);

const isHex = (char: string | undefined): boolean =>
  char !== undefined && /^[0-9a-fA-F]$/.test(char);

// The code point an escape names; none, a surrogate or one past U+10FFFF read as U+FFFD.
const codePointOf = (hex: number): number =>
  hex === 0 || hex > MAX_CODE_POINT || (hex >= 0xd800 && hex <= 0xdfff) ? 0xfffd : hex;

type Decoded = {
  readonly text: string;
  /** For each character of `text`, where it starts in the source. */
  readonly at: readonly number[];
};

// One escape at `from` (a backslash): the text it reads as and where it ends.
const escapeAt = (css: string, from: number): { text: string; end: number } => {
  let end = from + 1;
  while (end - from - 1 < MAX_ESCAPE_DIGITS && isHex(css[end])) end += 1;
  if (end > from + 1) {
    const text = String.fromCodePoint(codePointOf(Number.parseInt(css.slice(from + 1, end), 16)));
    if (css[end] === "\r" && css[end + 1] === "\n") end += 1;
    if (BLANKS.has(css[end] ?? "")) end += 1;
    return { text, end };
  }
  const char = String.fromCodePoint(css.codePointAt(from + 1) as number);
  return { text: char, end: from + 1 + char.length };
};

/**
 * `css` as CSS Syntax reads names: each escape (a backslash and one to six hex digits with one
 * optional blank after them, or a backslash and any other character) replaced by the character it
 * names, except where that character has a syntactic meaning, which keeps its escape. One pass,
 * no backtracking, so a long run of backslashes and blanks stays linear.
 */
const decode = (css: string): Decoded => {
  const chars: string[] = [];
  const at: number[] = [];
  let from = 0;
  const put = (text: string, source: number) => {
    for (const char of text) {
      chars.push(char);
      at.push(source);
      if (char.length === 2) at.push(source);
    }
  };
  while (from < css.length) {
    if (css[from] !== "\\" || from + 1 >= css.length) {
      put(css.charAt(from), from);
      from += 1;
      continue;
    }
    const { text, end } = escapeAt(css, from);
    // Kept escapes map each of their characters to the escape's start.
    put(STRUCTURAL.has(text) ? css.slice(from, end) : text, from);
    from = end;
  }
  return { text: chars.join(""), at };
};

// The text at a match, cut: a URL or an import as the author wrote it, never a whole stylesheet.
const shown = (css: string, from: number): string => {
  const rest = css.slice(from, from + SHOWN_CHARACTERS + 1);
  return rest.length > SHOWN_CHARACTERS ? `${rest.slice(0, SHOWN_CHARACTERS)}...` : rest;
};

// Whether `text` at `from`, after blanks and one quote and blanks, starts a data: URL.
const startsData = (text: string, from: number): boolean => {
  let at = from;
  const skipBlanks = () => {
    while (BLANKS.has(text[at] ?? "")) at += 1;
  };
  skipBlanks();
  if (text[at] === '"' || text[at] === "'") at += 1;
  skipBlanks();
  return text.slice(at, at + 5).toLowerCase() === "data:";
};

// The end of the string that opens at `from`: its closing quote, a line end or the text's end.
const stringEnd = (text: string, from: number): number => {
  const quote = text[from];
  for (let at = from + 1; at < text.length; at += 1) {
    const char = text[at];
    if (char === "\\") at += 1;
    else if (char === quote || char === "\n" || char === "\r" || char === "\f") return at;
  }
  return text.length;
};

type Call = "url" | "image-set" | "other";

const callBefore = (text: string, at: number): Call => {
  const name = (length: number) => text.slice(Math.max(0, at - length), at).toLowerCase();
  if (name(9) === "image-set") return "image-set";
  return name(3) === "url" ? "url" : "other";
};

/**
 * The positions of quoted strings inside `image-set(` or `-webkit-image-set(`, which a browser
 * reads as URLs; a string inside a `url(` there is that URL's own and the URL check's. One pass
 * over `text` with a stack of the open calls; comments and strings are skipped as CSS skips them.
 */
const imageSetStrings = (text: string): number[] => {
  const found: number[] = [];
  const open: Call[] = [];
  let sets = 0;
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (char === "\\") at += 1;
    else if (char === "/" && text[at + 1] === "*") {
      const close = text.indexOf("*/", at + 2);
      at = close === -1 ? text.length : close + 1;
    } else if (char === "(") {
      const call = callBefore(text, at);
      open.push(call);
      if (call === "image-set") sets += 1;
    } else if (char === ")") {
      if (open.pop() === "image-set") sets -= 1;
    } else if (char === '"' || char === "'") {
      if (sets > 0 && open[open.length - 1] !== "url") found.push(at);
      at = stringEnd(text, at);
    }
  }
  return found;
};

/**
 * A chunk's styles that would request a file (AD-8, AD-9, NFR-9): any `url(` not followed by
 * `data:`, any `@import`, and any quoted string inside `image-set(` or `-webkit-image-set(`. The
 * names are read as CSS Syntax reads them, escapes decoded (`u\72l(`, `@\69mport`), and a message
 * shows the text as the author wrote it. A chunk's styles are inlined into the view, whose policy
 * admits no other font or style source, so the build fails here rather than the board in the
 * browser.
 */
export const styleUrlProblems = (chunk: string, css: string): string[] => {
  const { text, at } = decode(css);
  const where = (index: number) => shown(css, at[index] ?? 0);
  const problems: string[] = [];
  for (const { index } of text.matchAll(URL_CALL)) {
    if (!startsData(text, index + 4)) {
      problems.push(`the chunk "${chunk}" styles name a file it would request: ${where(index)}`);
    }
  }
  for (const { index } of text.matchAll(IMPORT_RULE)) {
    problems.push(
      `the chunk "${chunk}" styles hold an @import, which would request a file: ${where(index)}`,
    );
  }
  for (const index of imageSetStrings(text)) {
    problems.push(
      `the chunk "${chunk}" styles hold a string in image-set(), which would request a file: ${where(index)}`,
    );
  }
  return problems;
};

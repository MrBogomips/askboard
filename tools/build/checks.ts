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

// The text at a match, cut: a URL or an import as the author wrote it, never a whole stylesheet.
const shown = (css: string, from: number): string => {
  const rest = css.slice(from, from + SHOWN_CHARACTERS + 1);
  return rest.length > SHOWN_CHARACTERS ? `${rest.slice(0, SHOWN_CHARACTERS)}...` : rest;
};

/**
 * A chunk's styles that would request a file (AD-8, AD-9, NFR-9): any `url(` not followed by
 * `data:`, and any `@import`. A chunk's styles are inlined into the view, whose policy admits no
 * other font or style source, so the build fails here rather than the board in the browser.
 */
export const styleUrlProblems = (chunk: string, css: string): string[] => {
  const problems: string[] = [];
  for (const { index } of css.matchAll(URL_CALL)) {
    const after = css.slice(index + 4).replace(/^\s*["']?\s*/, "");
    if (!/^data:/i.test(after)) {
      problems.push(
        `the chunk "${chunk}" styles name a file it would request: ${shown(css, index)}`,
      );
    }
  }
  for (const { index } of css.matchAll(IMPORT_RULE)) {
    problems.push(
      `the chunk "${chunk}" styles hold an @import, which would request a file: ${shown(css, index)}`,
    );
  }
  return problems;
};

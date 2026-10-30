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

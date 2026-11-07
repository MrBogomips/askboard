// Checks on what the view build writes, each naming the chunk it fails (AD-9, renderer row 18).
// Every script and style is inlined: the board page holds its own, and `assemble` inlines the
// chunks into the view's srcdoc, where the CSP admits each by the hash of its exact text.

import { transform } from "lightningcss";

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

const SHOWN_CHARACTERS = 80;
const SHOWN_MESSAGE_CHARACTERS = 200;
const IMAGE_SET_FUNCTIONS = new Set(["image-set", "-webkit-image-set"]);
// A value that takes its content from elsewhere: a string put there by `var()` or `env()` is read as
// a URL by `image-set()`.
const SUBSTITUTING_FUNCTIONS = new Set(["var", "env"]);
// The one URL the font rewrite makes (`tools/build/stylesheets.ts`).
const WOFF2_DATA_URL = /^data:font\/woff2[;,]/i;

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null;

// A URL or a string as the parser decoded it, cut: never a whole stylesheet in a message.
const shown = (text: string, limit = SHOWN_CHARACTERS): string =>
  text.length > limit ? `${text.slice(0, limit)}...` : text;

// The `url` objects of a font face's `src` entries that hold a woff2 data: URL: the exception.
const fontSourceUrls = (face: Node): Node[] => {
  const properties = isNode(face.value) ? face.value.properties : undefined;
  if (!Array.isArray(properties)) return [];
  return properties
    .filter((property) => isNode(property) && property.type === "source")
    .flatMap((property) => (Array.isArray(property.value) ? property.value : []))
    .flatMap((source) => {
      const url =
        isNode(source) && source.type === "url" && isNode(source.value) && source.value.url;
      return isNode(url) && typeof url.url === "string" && WOFF2_DATA_URL.test(url.url)
        ? [url]
        : [];
    });
};

const imageSetName = (node: Node): boolean =>
  node.type === "function" &&
  isNode(node.value) &&
  typeof node.value.name === "string" &&
  IMAGE_SET_FUNCTIONS.has(node.value.name.toLowerCase());

// `var()` and `env()` as the parser gives them: its own node types, or a function by name (in any
// case, when it does not recognise the spelling); and a call of a CSS custom function, a function
// named by a dashed ident (`--u()`), whose `@function` rule puts what it likes in its result.
const substitutes = (node: Node): boolean => {
  if (node.type === "var" || node.type === "env") return true;
  if (node.type !== "function" || !isNode(node.value) || typeof node.value.name !== "string") {
    return false;
  }
  return (
    SUBSTITUTING_FUNCTIONS.has(node.value.name.toLowerCase()) || node.value.name.startsWith("--")
  );
};

// An `@function` rule: the parser keeps it as an unknown rule named by its spelling, an escape
// decoded.
const definesFunction = (node: Node): boolean =>
  node.type === "unknown" &&
  isNode(node.value) &&
  typeof node.value.name === "string" &&
  node.value.name.toLowerCase() === "function";

type Reach = { readonly node: unknown; readonly inImageSet: boolean };

/**
 * What a stylesheet's tree asks a browser to fetch, in document order: an `import` rule, every
 * node holding a `url` string except a font face's woff2 data: URL, every string token of an
 * `image-set()` (which a browser reads as a URL), every `var()`, `env()` or call of a custom
 * function inside one (which could put a string there), and every `@function` rule. The walk is iterative, so a deep nest ends in the
 * parser's verdict and not in a stack overflow here.
 */
const requests = (sheet: unknown, chunk: string): string[] => {
  const problems: string[] = [];
  const allowed = new Set<unknown>();
  const stack: Reach[] = [{ node: sheet, inImageSet: false }];
  const request = (what: string, text: string) =>
    problems.push(`the chunk "${chunk}" styles ${what}: ${shown(text)}`);
  for (let reach = stack.pop(); reach !== undefined; reach = stack.pop()) {
    const { node, inImageSet } = reach;
    if (Array.isArray(node)) {
      for (let at = node.length - 1; at >= 0; at -= 1) stack.push({ node: node[at], inImageSet });
      continue;
    }
    if (!isNode(node)) continue;
    if (node.type === "font-face") for (const url of fontSourceUrls(node)) allowed.add(url);
    if (node.type === "import" && isNode(node.value) && typeof node.value.url === "string") {
      request("hold an @import, which would request a file", node.value.url);
      continue;
    }
    if (typeof node.url === "string" && !allowed.has(node)) {
      request("name a file it would request", node.url);
    }
    if (
      inImageSet &&
      node.type === "token" &&
      isNode(node.value) &&
      node.value.type === "string" &&
      typeof node.value.value === "string"
    ) {
      request("hold a string in image-set(), which would request a file", node.value.value);
    }
    if (definesFunction(node)) {
      problems.push(
        `the chunk "${chunk}" styles define a CSS function with @function, whose result could put a file into a value`,
      );
    }
    if (inImageSet && substitutes(node)) {
      problems.push(
        `the chunk "${chunk}" styles: a value substituted into image-set() could request a file`,
      );
    }
    const inside = inImageSet || imageSetName(node);
    const keys = Object.keys(node);
    for (let at = keys.length - 1; at >= 0; at -= 1) {
      stack.push({ node: node[keys[at] as string], inImageSet: inside });
    }
  }
  return problems;
};

/**
 * A chunk's styles that would request a file (AD-8, AD-9, NFR-9). The styles are parsed with
 * lightningcss, as CSS Syntax reads them (escapes decoded, `xurl(` a function and only `url(` a
 * URL), and its tree is walked: an `@import`, any URL other than a woff2 `data:` URL in the source
 * of a `@font-face`, any string in `image-set()` or `-webkit-image-set()`, any `var()`, `env()` or
 * call of a custom function (`--u()`) inside one, and any `@function` rule are problems, and so are
 * styles that do not parse, so the check fails closed. A chunk's styles are inlined into the view,
 * whose policy admits no other font or style source, so the build fails here rather than the board
 * in the browser.
 */
export const styleUrlProblems = (chunk: string, css: string): string[] => {
  let sheet: unknown;
  try {
    transform({
      filename: chunk,
      code: Buffer.from(css),
      visitor: {
        StyleSheet(given) {
          sheet = given;
        },
      },
    });
  } catch (error) {
    const { message, loc } = error as { message?: unknown; loc?: { line?: unknown } };
    const at = typeof loc?.line === "number" ? ` (line ${loc.line})` : "";
    return [
      `the chunk "${chunk}" styles do not parse: ${shown(String(message ?? error), SHOWN_MESSAGE_CHARACTERS)}${at}`,
    ];
  }
  if (sheet === undefined) return [`the chunk "${chunk}" styles gave no stylesheet to check`];
  return requests(sheet, chunk);
};

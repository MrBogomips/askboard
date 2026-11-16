// Each chunk's styles, from the Tailwind CLI over that chunk's own sources (design decision 7): a
// document's (the board page's and the shell's) start with Tailwind's preflight, DESIGN.md's tokens
// and the base layer; a component's hold only its utilities. All share one theme, and `dark:`
// follows the `.dark` class the board page sets, not the media query (renderer row 15).

import { dirname, join } from "node:path";
import { PALETTES } from "@askboard/contract";
import { BASE_CSS, DESIGN_FILE, resolveFromView } from "./paths.ts";
import { checkPalettes, paletteCss, readDesignTokens, themeCss, tokensCss } from "./tokens.ts";

export type StylePlan = "document" | "utilities";

export const DARK_VARIANT = "@custom-variant dark (&:where(.dark, .dark *));";

const TAILWIND_DIR = dirname(resolveFromView("tailwindcss/package.json"));
const TAILWIND_CLI = join(
  dirname(resolveFromView("@tailwindcss/cli/package.json")),
  "dist/index.mjs",
);

/** Tailwind's preflight, which a document's styles copy: an input of its chunk for the notices. */
export const PREFLIGHT_FILE = join(TAILWIND_DIR, "preflight.css");

const TOKENS = "tokens.css";
const THEME = "theme.css";
const PALETTES_FILE = "palettes.css";

/**
 * Writes the tokens, the theme and the palettes from DESIGN.md into the build's work folder, and
 * returns each named palette's CSS, which the view build writes as the shell's own sheets (D4).
 * The palettes are checked against the contract's list first (D3).
 */
export const writeTokenFiles = async (
  work: string,
): Promise<{ readonly palettes: Readonly<Record<string, string>> }> => {
  const tokens = readDesignTokens(await Bun.file(DESIGN_FILE).text());
  checkPalettes(tokens, PALETTES);
  const palettes = Object.fromEntries(
    PALETTES.filter((name) => name !== "carta").map((name) => [name, paletteCss(tokens, name)]),
  );
  await Bun.write(join(work, TOKENS), tokensCss(tokens));
  await Bun.write(join(work, PALETTES_FILE), Object.values(palettes).join(""));
  await Bun.write(join(work, THEME), themeCss(tokens));
  return { palettes };
};

const quoted = (path: string) => JSON.stringify(path);

/**
 * Tailwind's input for one chunk, scanning only `sources` for utilities. The board page's carries
 * every palette after the tokens (it never goes into a Snapshot); the shell's are separate files.
 */
export const tailwindInput = (
  plan: StylePlan,
  sources: readonly string[],
  work: string,
  options: { readonly palettes?: boolean } = {},
): string => {
  const document =
    plan === "document"
      ? [
          `@import ${quoted(PREFLIGHT_FILE)} layer(base);`,
          `@import ${quoted(join(work, TOKENS))};`,
          ...(options.palettes === true ? [`@import ${quoted(join(work, PALETTES_FILE))};`] : []),
          `@import ${quoted(BASE_CSS)};`,
        ]
      : [];
  const lines = [
    "@layer theme, base, components, utilities;",
    `@import ${quoted(join(TAILWIND_DIR, "theme.css"))} layer(theme);`,
    ...document,
    `@import ${quoted(join(TAILWIND_DIR, "utilities.css"))} layer(utilities) source(none);`,
    `@import ${quoted(join(work, THEME))};`,
    DARK_VARIANT,
    ...sources.map((source) => `@source ${quoted(source)};`),
  ];
  return `${lines.join("\n")}\n`;
};

/** Runs the Tailwind CLI on one input file and returns the minified styles. */
export const runTailwind = async (input: string, output: string): Promise<string> => {
  const run = Bun.spawn([process.execPath, TAILWIND_CLI, "-i", input, "-o", output, "--minify"], {
    cwd: dirname(input),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stderr] = await Promise.all([run.exited, new Response(run.stderr).text()]);
  if (code !== 0) throw new Error(`Tailwind failed on ${input}:\n${stderr.trim()}`);
  return (await Bun.file(output).text()).trim();
};

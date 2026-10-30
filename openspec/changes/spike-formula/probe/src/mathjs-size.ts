// Bundle sizes for task 5.2: what mathjs's `parse` alone adds to a view chunk, against the
// own parser and the whole own engine. Each entry is built with `bun build --minify` and
// measured raw and with `gzip -9`, the same measure findings-parts/own.md uses.

import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PROBE = join(import.meta.dir, "..");
const MATHJS_ESM = join(PROBE, "node_modules", "mathjs", "lib", "esm", "index.js");
const MATHJS_BROWSER = join(PROBE, "node_modules", "mathjs", "lib", "browser", "math.js");
const OWN = join(PROBE, "src");

export interface BundleSize {
  readonly name: string;
  readonly what: string;
  readonly command: string;
  readonly rawBytes: number;
  readonly gzipBytes: number;
}

interface Entry {
  readonly name: string;
  readonly what: string;
  readonly source: string;
  /** Imports to leave out of the bundle (Bun.build API: the CLI's --external takes package names only). */
  readonly externalize?: RegExp;
}

// Entries assign to globalThis so the bundler keeps what they import.
const ENTRIES: readonly Entry[] = [
  {
    name: "mathjs-parse",
    what: 'mathjs 15.2.0, `import { parse } from "mathjs"` only',
    source: `import { parse } from ${JSON.stringify(MATHJS_ESM)};\nglobalThis.parseFormula = parse;\n`,
  },
  {
    name: "mathjs-parse-factory",
    what: "mathjs 15.2.0, `create({ parseDependencies }).parse`",
    source: `import { create, parseDependencies } from ${JSON.stringify(MATHJS_ESM)};\nglobalThis.parseFormula = create({ parseDependencies }).parse;\n`,
  },
  {
    name: "own-parser",
    what: "own parser alone (src/own/parser.ts, which imports the function table for arity checks)",
    source: `import { parse } from ${JSON.stringify(join(OWN, "own", "parser.ts"))};\nglobalThis.parseFormula = parse;\n`,
  },
  {
    name: "own-parser-without-table",
    what: "own parser alone, with src/own/functions.ts left external",
    source: `import { parse } from ${JSON.stringify(join(OWN, "own", "parser.ts"))};\nglobalThis.parseFormula = parse;\n`,
    externalize: /\/functions\.ts$|^\.\/functions\.ts$/,
  },
  {
    name: "own-lexer-and-parser",
    what: "own lexer and whitelist check (src/refs.ts) plus the parser: the like-for-like of mathjs's tokenizer and parser",
    source: `import { checkFormula, lex } from ${JSON.stringify(join(OWN, "refs.ts"))};\nimport { parse } from ${JSON.stringify(join(OWN, "own", "parser.ts"))};\nglobalThis.formula = { checkFormula, lex, parse };\n`,
  },
  {
    name: "own-engine",
    what: "whole own engine (engine, parser, interpreter, functions, lexer, precheck, whitelist)",
    source: `import { createOwnEngine } from ${JSON.stringify(join(OWN, "engines.ts"))};\nglobalThis.createOwnEngine = createOwnEngine;\n`,
  },
];

function gzipBytes(file: string): number {
  const out = Bun.spawnSync(["gzip", "-9", "-c", file]);
  if (out.exitCode !== 0) throw new Error(`gzip failed on ${file}: ${out.stderr.toString()}`);
  return out.stdout.length;
}

async function buildExternal(input: string, output: string, pattern: RegExp): Promise<string> {
  const result = await Bun.build({
    entrypoints: [input],
    minify: true,
    format: "esm",
    plugins: [
      {
        name: "externalize",
        setup(b) {
          b.onResolve({ filter: pattern }, (args) => ({ path: args.path, external: true }));
        },
      },
    ],
  });
  const [artifact] = result.outputs;
  if (!result.success || !artifact) throw new Error(`Bun.build failed: ${result.logs.join("\n")}`);
  writeFileSync(output, await artifact.text());
  return `Bun.build({ entrypoints: [entry], minify: true, format: "esm", plugin marking ${pattern} external })`;
}

async function build(dir: string, entry: Entry): Promise<BundleSize> {
  const input = join(dir, `${entry.name}.entry.js`);
  const output = join(dir, `${entry.name}.min.js`);
  writeFileSync(input, entry.source);
  if (entry.externalize) {
    const command = await buildExternal(input, output, entry.externalize);
    return { name: entry.name, what: entry.what, command, rawBytes: statSync(output).size, gzipBytes: gzipBytes(output) };
  }
  const args = ["build", input, "--minify", "--format=iife", "--outfile", output];
  const result = Bun.spawnSync([process.execPath, ...args], { cwd: PROBE });
  if (result.exitCode !== 0) throw new Error(`bun ${args.join(" ")} failed: ${result.stderr.toString()}`);
  return {
    name: entry.name,
    what: entry.what,
    // Recorded with the directory elided: evidence files hold no machine-specific paths.
    command: `bun ${args.join(" ").replaceAll(dir, "<dir>")}`,
    rawBytes: statSync(output).size,
    gzipBytes: gzipBytes(output),
  };
}

export async function measureBundles(dir: string): Promise<BundleSize[]> {
  mkdirSync(dir, { recursive: true });
  const sizes: BundleSize[] = [];
  for (const entry of ENTRIES) sizes.push(await build(dir, entry));
  // The package's own prebuilt browser bundle (all of mathjs), for scale.
  sizes.push({
    name: "mathjs-browser-full",
    what: "mathjs 15.2.0 lib/browser/math.js as shipped (everything)",
    command: "none (file in the package)",
    rawBytes: statSync(MATHJS_BROWSER).size,
    gzipBytes: gzipBytes(MATHJS_BROWSER),
  });
  return sizes;
}

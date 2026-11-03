// `bun run build:mod` (push delivery, design decision 7; packaging spec, "The mod module"): bundles
// `packages/mod/src/index.ts` into one ESM file, `hooks/askboard-mod.js`, the hooks module that
// `hooks/hooks.json` names. The mod environment has no Node, no DOM and no module loader for the
// plugin's other files, so the file holds every helper at module scope and exports `register(on)`
// alone; the build fails on an `import`, `require` or `import.meta` in it. The mod compiles no
// schema at run time either: the build generates Ajv's standalone code for what the mod checks
// (the session file, the poll, the local API's acknowledgements), with the contract's own Ajv, and
// bundles it in place of the mod's `validators.ts`, as the view build does for the board page. The
// third-party code it carries (Ajv's run-time helper) ships with its licence notice, at the top.
// Claude Code's module check accepts `$` passed only to functions declared at the top of the file,
// as function declarations or `const` bindings, and Bun writes top-level bindings as `var`: the
// build binds the module's top-level functions with `const` and checks the rule (mod-bindings.ts).
//
// Usage: bun tools/build/mod.ts [--out <file>]

import { join, relative } from "node:path";
import { LOCAL_API_MESSAGES, PUSH_SCHEMA_IDS, PUSH_SCHEMAS } from "@askboard/contract";
import { createAjv } from "@askboard/contract/validate";
import standaloneCode from "ajv/dist/standalone";
import type { BunPlugin } from "bun";
import { chunkInputs, collectNotices, type NoticeFile } from "./licences.ts";
import { constFunctionBindings, modBindingProblems } from "./mod-bindings.ts";
import { ROOT } from "./paths.ts";

export const MOD_ENTRY = join(ROOT, "packages/mod/src/index.ts");
export const MOD_VALIDATORS_FILE = join(ROOT, "packages/mod/src/validators.ts");
/** The hooks module, beside `hooks/hooks.json`, which names it `./askboard-mod.js`. */
export const MOD_OUT = join(ROOT, "hooks/askboard-mod.js");

/** Where Ajv's run-time helpers resolve from: the contract, which depends on Ajv. */
const AJV_HOME = join(ROOT, "packages/contract");
const NAME = "the mod";

/** ESM exporting `checks`, the mod's validators module's one export, as standalone code. */
export const modValidatorsCode = (): string => {
  const ajv = createAjv({ code: { source: true, esm: true } });
  for (const schema of PUSH_SCHEMAS) ajv.addSchema(schema);
  const code = standaloneCode(ajv, {
    sessionFile: PUSH_SCHEMA_IDS.sessionFile,
    poll: LOCAL_API_MESSAGES.pollResponse,
    ack: LOCAL_API_MESSAGES.modHelloResponse,
  });
  // The helpers resolve from the contract's folder, since the mod does not depend on Ajv itself.
  const resolved = code.replace(
    /require\("(ajv\/dist\/runtime\/[a-z0-9]+)"\)/g,
    (_call, specifier: string) =>
      `require(${JSON.stringify(Bun.resolveSync(specifier, AJV_HOME))})`,
  );
  return `${resolved}\nexport const checks = { sessionFile, poll, ack };\n`;
};

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Ajv's run-time helpers, which the standalone code requires. */
const AJV_RUNTIME = /\/ajv\/dist\/runtime\/[a-z0-9]+\.js$/;

/**
 * The text by which each helper tells Ajv's code generator how to require it, such as
 * `ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';`. Only the generator reads
 * it, never a standalone validator, and the mod's module may hold no `require`.
 */
const GENERATOR_NOTE = /^[\w$]+\.code = (["'])[^\n]*\1;$/gm;

/**
 * Loads the generated code in place of the mod's validators module, and Ajv's run-time helpers
 * without their notes to its code generator.
 */
export const modValidatorsPlugin = (code: string): BunPlugin => ({
  name: "askboard-mod-validators",
  setup(build) {
    build.onLoad({ filter: new RegExp(`^${escaped(MOD_VALIDATORS_FILE)}$`) }, () => ({
      contents: code,
      loader: "js",
    }));
    build.onLoad({ filter: AJV_RUNTIME }, async ({ path }) => ({
      contents: (await Bun.file(path).text()).replace(GENERATOR_NOTE, ""),
      loader: "js",
    }));
  },
});

// What the mod environment cannot load. Bun's own helper for an unresolved require is a bare
// `require` too; `require_<name>`, a bundled CommonJS module, is not.
const FORBIDDEN: readonly (readonly [RegExp, string])[] = [
  [/\bimport\s*\.\s*meta\b/, "import.meta"],
  [/\bimport\s*\(/, "a dynamic import"],
  [/(^|[;}\n])\s*import\b\s*[\w*{"'$]/, "an import statement"],
  [/\brequire\b/, "require"],
];

/** Why the built text cannot be the mod's module, one problem per kind. */
export const modOutputProblems = (code: string): string[] =>
  FORBIDDEN.filter(([pattern]) => pattern.test(code)).map(
    ([, what]) => `${NAME} holds ${what}, which the mod environment cannot load`,
  );

// A schema compiler would need `new Function`; only Ajv's run-time helpers belong in the module.
const COMPILER_INPUTS = [
  /\/ajv\/dist\/(?!runtime\/)/,
  /(^|\/)packages\/contract\/src\/validate\.ts$/,
  /(^|\/)packages\/contract\/src\/compiled\.ts$/,
];

/** The bundle's inputs that would compile schemas at run time. */
export const modInputProblems = (inputs: readonly string[]): string[] =>
  inputs
    .filter((input) => COMPILER_INPUTS.some((pattern) => pattern.test(input)))
    .map((input) => `${NAME} bundles ${input}, which compiles schemas at run time`);

export type BuiltMod = { readonly code: string; readonly inputs: readonly string[] };

// One comment at the top: the notice of each package the module holds code of, the packages that
// share a licence text named together (AskBoard's own share the repository's).
const banner = (notices: readonly NoticeFile[]): string => {
  const byText = new Map<string, string[]>();
  for (const { notice, text } of notices) {
    const named = `${notice.package} ${notice.version} (${notice.licence})`;
    byText.set(text, [...(byText.get(text) ?? []), named]);
  }
  const parts = [...byText].map(([text, names]) => `${names.join(", ")}\n\n${text}`);
  const body = [
    "AskBoard's mod (hooks/askboard-mod.js), built by `bun run build:mod`: do not edit.",
    ...parts,
  ].join("\n\n");
  if (body.includes("*/")) throw new Error(`${NAME}'s licence notices cannot sit in a comment`);
  return `/*\n${body}\n*/\n`;
};

/**
 * Bundles the mod, its validators standalone, binds its top-level functions with `const`, and checks
 * what it bundled and wrote.
 */
export const buildMod = async (): Promise<BuiltMod> => {
  const result = await Bun.build({
    entrypoints: [MOD_ENTRY],
    format: "esm",
    target: "browser",
    metafile: true,
    plugins: [modValidatorsPlugin(modValidatorsCode())],
  });
  const [output] = result.outputs;
  if (!result.success || output === undefined || result.metafile === undefined) {
    throw new Error(`${NAME} did not build:\n${result.logs.join("\n")}`);
  }
  const inputs = chunkInputs(result.metafile, process.cwd());
  const problems = modInputProblems(inputs.map((input) => relative(ROOT, input)));
  const bound = constFunctionBindings(await output.text());
  const code = `${banner(await collectNotices(NAME, inputs, ROOT))}${bound.code}`;
  const found = [
    ...problems,
    ...bound.problems,
    ...modOutputProblems(code),
    ...modBindingProblems(code),
  ];
  if (found.length > 0) throw new Error(found.join("\n"));
  return { code, inputs };
};

const outOf = (args: readonly string[]): string | { error: string } => {
  if (args.length === 0) return MOD_OUT;
  const [flag, path, ...rest] = args;
  if (flag !== "--out" || path === undefined || rest.length > 0) {
    return { error: "usage: bun tools/build/mod.ts [--out <file>]" };
  }
  return path;
};

export const main = async (
  args: readonly string[],
  log: (line: string) => void = console.log,
): Promise<number> => {
  const out = outOf(args);
  if (typeof out !== "string") {
    log(out.error);
    return 2;
  }
  const started = performance.now();
  const { code } = await buildMod();
  await Bun.write(out, code);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const where = out.startsWith(`${ROOT}/`) ? relative(ROOT, out) : out;
  log(`build:mod: wrote ${where} (${Buffer.byteLength(code)} bytes) in ${seconds} s`);
  return 0;
};

if (import.meta.main) {
  process.exitCode = await main(Bun.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  });
}

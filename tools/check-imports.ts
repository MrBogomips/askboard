// Import-boundary check (AD-1): fails on any import that crosses the dependency diagram of
// docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md (Invariants & Rules, AD-1), between
// packages and between the server units, on relative paths that leave their package, and on Node
// or Bun built-ins in the sources of core and compute. Repository tooling, not a shipped unit: it
// may use Bun APIs.
//
// Usage: bun tools/check-imports.ts [root]

import { readdir } from "node:fs/promises";
import { builtinModules } from "node:module";
import { join, posix, relative, sep } from "node:path";

export type Violation = {
  file: string;
  specifier: string;
  target: string;
  rule: string;
};

const SERVER_UNITS = new Set([
  "mcp-tools",
  "board-host",
  "excerpts",
  "molecule-source",
  "snapshot",
  "notifier",
]);

// What each unit may import, from the spine's Invariants & Rules diagram and AD-1. `view/assemble`
// (AD-9) and `view/catalog` (the CatalogRenderer port) are the two view entries other units use.
// A change to the diagram updates this table in the same OpenSpec change.
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  contract: [],
  compute: ["contract"],
  core: ["contract", "compute"],
  "mcp-tools": ["core", "contract"],
  "board-host": ["core", "contract"],
  excerpts: ["core", "contract"],
  "molecule-source": ["core", "contract", "molecules"],
  snapshot: ["core", "contract", "view/assemble"],
  notifier: ["core", "contract"],
  // Files in packages/server/src outside the six unit folders. The diagram gives them no rule
  // yet: where the session process entry point lives is an open question of setup-workspace.
  server: [],
  molecules: ["contract"],
  view: ["contract", "compute"],
  widgets: ["contract", "compute", "view/catalog"],
  mod: ["contract"],
  hooks: ["contract"],
  bench: ["contract"],
};

const PACKAGES = new Set([
  "contract",
  "core",
  "compute",
  "server",
  "view",
  "widgets",
  "molecules",
  "mod",
  "hooks",
  "bench",
]);
const RUNTIME_NEUTRAL = new Set(["core", "compute"]);
// core and compute compile contract's sources too, so its type references would reach them.
const TYPE_ISOLATED = new Set(["contract", "core", "compute"]);
const VIEW_ENTRIES = new Set(["assemble", "catalog"]);
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "coverage"]);
const SCOPE = "@askboard/";

const RULE_BUILT_IN =
  "core and compute use no Node-only or Bun-only API outside their tests (AD-1)";
const RULE_OUTSIDE = "resolves outside packages/: not an AskBoard unit (AD-1)";
const RULE_UNKNOWN = "not an AskBoard package of the spine's layer table (AD-1)";
const RULE_UNRESOLVED =
  "the check cannot resolve absolute paths, file URLs or subpath imports: use @askboard/<unit>, or a relative path inside the package (AD-1)";
const RULE_REFERENCE =
  "contract, core and compute reference no type package and no library beyond ECMAScript outside their tests: core and compute compile without DOM, Node or Bun types (AD-1)";
const RULE_LINK = "a symbolic link under packages/, which the check does not follow (AD-1)";

type Target =
  | { kind: "unit"; unit: string }
  // A relative path into another package: it would bypass that package's exports and the
  // importer's dependency declaration (setup-workspace decision 6, review finding L3).
  | { kind: "other-package"; unit: string }
  | { kind: "built-in" }
  | { kind: "outside" }
  | { kind: "unknown" }
  | { kind: "unresolved" }
  | { kind: "third-party" };

const baseUnit = (target: string): string => target.split("/")[0] ?? target;

// The unit a repository path belongs to; with `entries`, view's two entries count as their own
// targets. Paths are repository-relative with forward slashes.
const unitOfPath = (path: string, entries: boolean): Target => {
  const [top, pkg, area, folder] = path.split("/");
  if (top !== "packages" || pkg === undefined) return { kind: "outside" };
  if (!PACKAGES.has(pkg)) return { kind: "unknown" };
  const inArea = area === "src" || area === "test";
  if (pkg === "server" && inArea && folder !== undefined && SERVER_UNITS.has(folder)) {
    return { kind: "unit", unit: folder };
  }
  if (pkg === "view" && entries && area === "src" && folder !== undefined) {
    if (VIEW_ENTRIES.has(folder)) return { kind: "unit", unit: `view/${folder}` };
  }
  return { kind: "unit", unit: pkg };
};

const isBuiltIn = (specifier: string): boolean =>
  specifier === "bun" ||
  specifier.startsWith("bun:") ||
  specifier.startsWith("node:") ||
  // Under Bun this list also names ws and undici, which core and compute have no use for either.
  builtinModules.includes(specifier);

const targetOf = (file: string, specifier: string): Target => {
  if (specifier.startsWith(SCOPE)) {
    const [pkg = "", ...rest] = specifier.slice(SCOPE.length).split("/");
    if (!PACKAGES.has(pkg)) return { kind: "unknown" };
    const entry = rest.join("/");
    if (pkg === "view" && VIEW_ENTRIES.has(entry)) return { kind: "unit", unit: `view/${entry}` };
    return { kind: "unit", unit: pkg };
  }
  if (specifier.startsWith(".")) {
    const resolved = posix.normalize(posix.join(posix.dirname(file), specifier));
    const target = unitOfPath(resolved, true);
    const leaves = resolved.split("/")[1] !== file.split("/")[1];
    return target.kind === "unit" && leaves ? { kind: "other-package", unit: target.unit } : target;
  }
  if (/^(\/|#|file:)/.test(specifier)) return { kind: "unresolved" };
  if (isBuiltIn(specifier)) return { kind: "built-in" };
  return { kind: "third-party" };
};

const isTestFile = (file: string): boolean =>
  /\.test\.[cm]?[jt]sx?$/.test(file) || file.split("/")[2] === "test";

const unitRule = (unit: string): string => {
  const allowed = ALLOWED[unit] ?? [];
  const may = allowed.length === 0 ? "no AskBoard unit" : `only ${allowed.join(", ")}`;
  const server = SERVER_UNITS.has(unit) ? "; never another server unit" : "";
  const where = unit === "server" ? " (files outside the six server unit folders)" : "";
  return `${unit}${where} may import ${may}${server} (spine Invariants & Rules, AD-1)`;
};

const relativeRule = (target: string): string =>
  `a relative path may not leave its package: import @askboard/${target}, so its exports and the importer's declared dependencies apply (AD-1)`;

// Type-only imports and exports leave no trace in Bun's scan, so they are rewritten as value ones
// first; comments may sit between the keywords. A rewrite inside a string or comment changes
// nothing the scan reports.
const GAP = String.raw`(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)`;
const TYPE_IMPORT = new RegExp(String.raw`\bimport${GAP}+type\b${GAP}*(?!from\b)(?=[\w$*{])`, "g");
const TYPE_EXPORT = new RegExp(String.raw`\bexport${GAP}+type\b${GAP}*(?=[*{])`, "g");
const INLINE_TYPE = new RegExp(
  String.raw`([{,]${GAP}*)type${GAP}+(?=[\w$]+${GAP}*(?:,|}|as\b))`,
  "g",
);
const asValueImports = (source: string): string =>
  source.replace(TYPE_IMPORT, "import ").replace(TYPE_EXPORT, "export ").replace(INLINE_TYPE, "$1");

// Import type queries such as `import("x").T`, with or without import attributes, and Bun's
// `import.meta.require("x")` leave no trace either. This pattern also matches inside strings and
// comments: such a match fails the check loudly rather than passing silently.
const IMPORT_CALL = /\bimport(?:\.meta\.require)?\s*\(\s*(["'`])([^"'`$\n]+)\1\s*(?:,[^)]*)?\)/g;

// Triple-slash references bring in type packages and libraries, or other files.
const REFERENCE =
  /^[ \t]*\/\/\/[ \t]*<reference[ \t]+(types|lib|path)[ \t]*=[ \t]*(["'])([^"'\n]*)\2/gm;

const loaderOf = (file: string): "ts" | "tsx" | "js" => {
  if (/\.[jt]sx$/.test(file)) return "tsx";
  return /\.[cm]?ts$/.test(file) ? "ts" : "js";
};

const specifiersOf = (file: string, source: string): string[] => {
  const transpiler = new Bun.Transpiler({ loader: loaderOf(file) });
  const scanned = transpiler.scanImports(asValueImports(source)).map((entry) => entry.path);
  const queried = [...source.matchAll(IMPORT_CALL)].map((match) => match[2] ?? "");
  return [...new Set([...scanned, ...queried])];
};

const violationOf = (file: string, unit: string, specifier: string): Violation | undefined => {
  const target = targetOf(file, specifier);
  switch (target.kind) {
    case "third-party":
      return undefined;
    case "outside":
      return { file, specifier, target: "outside packages/", rule: RULE_OUTSIDE };
    case "unknown":
      return { file, specifier, target: "unknown", rule: RULE_UNKNOWN };
    case "unresolved":
      return { file, specifier, target: "unresolved", rule: RULE_UNRESOLVED };
    case "built-in":
      if (!RUNTIME_NEUTRAL.has(unit) || isTestFile(file)) return undefined;
      return { file, specifier, target: "built-in", rule: RULE_BUILT_IN };
    case "unit":
    case "other-package": {
      // The unit rule comes first, so a forbidden edge reports the boundary it crosses.
      if (baseUnit(target.unit) !== unit && !ALLOWED[unit]?.includes(target.unit)) {
        return { file, specifier, target: target.unit, rule: unitRule(unit) };
      }
      if (target.kind === "unit") return undefined;
      return { file, specifier, target: target.unit, rule: relativeRule(target.unit) };
    }
  }
};

const referenceViolations = (file: string, unit: string, source: string): Violation[] =>
  [...source.matchAll(REFERENCE)].flatMap(([, kind = "", , value = ""]) => {
    const specifier = `/// <reference ${kind}="${value}" />`;
    if (kind === "path") {
      const violation = violationOf(file, unit, value.startsWith(".") ? value : `./${value}`);
      return violation ? [{ ...violation, specifier }] : [];
    }
    if (!TYPE_ISOLATED.has(unit) || isTestFile(file)) return [];
    if (kind === "lib" && /^es/i.test(value)) return [];
    return [{ file, specifier, target: "reference", rule: RULE_REFERENCE }];
  });

// Checks one file; `file` is its repository-relative path with forward slashes.
export const checkSource = (file: string, source: string): Violation[] => {
  const owner = unitOfPath(file, false);
  if (owner.kind !== "unit") {
    return [{ file, specifier: "", target: "-", rule: RULE_UNKNOWN }];
  }
  let specifiers: string[];
  try {
    specifiers = specifiersOf(file, source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [{ file, specifier: "", target: "-", rule: `could not parse: ${message}` }];
  }
  return [
    ...specifiers.flatMap((specifier) => violationOf(file, owner.unit, specifier) ?? []),
    ...referenceViolations(file, owner.unit, source),
  ];
};

type Walk = { files: string[]; links: string[] };

const walk = async (root: string, directory: string): Promise<Walk> => {
  const entries = await readdir(join(root, directory), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry): Promise<Walk> => {
      const path = posix.join(directory, entry.name);
      if (entry.isSymbolicLink()) return { files: [], links: [path] };
      if (entry.isDirectory()) {
        return SKIPPED_DIRECTORIES.has(entry.name) ? { files: [], links: [] } : walk(root, path);
      }
      const source = entry.isFile() && SOURCE_FILE.test(entry.name);
      return { files: source ? [path] : [], links: [] };
    }),
  );
  return {
    files: nested.flatMap((result) => result.files),
    links: nested.flatMap((result) => result.links),
  };
};

export const checkImports = async (
  root: string,
): Promise<{ files: number; violations: Violation[] }> => {
  const { files, links } = await walk(root, "packages");
  files.sort();
  const results = await Promise.all(
    files.map(async (file) => checkSource(file, await Bun.file(join(root, file)).text())),
  );
  const linked = links
    .sort()
    .map((file) => ({ file, specifier: "", target: "-", rule: RULE_LINK }));
  return { files: files.length, violations: [...results.flat(), ...linked] };
};

export const formatViolation = (violation: Violation): string =>
  `${violation.file}: "${violation.specifier}" (${violation.target}): ${violation.rule}`;

export const main = async (
  args: readonly string[],
  log: (line: string) => void = console.log,
): Promise<number> => {
  const root = args[0] ?? join(import.meta.dir, "..");
  const { files, violations } = await checkImports(root);
  for (const violation of violations) log(formatViolation(violation));
  const where = relative(process.cwd(), root).split(sep).join("/") || ".";
  const outcome =
    violations.length === 1 ? "1 violation" : `${violations.length || "no"} violations`;
  log(`check:imports: ${files} files under ${where}/packages, ${outcome}`);
  return violations.length === 0 ? 0 : 1;
};

if (import.meta.main) {
  process.exitCode = await main(Bun.argv.slice(2));
}

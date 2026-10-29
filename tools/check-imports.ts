// Import-boundary check (AD-1): fails on any import that crosses the dependency diagram of
// docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md (Invariants & Rules, AD-1), between
// packages and between the server units, and on Node or Bun built-ins in the sources of core and
// compute. Repository tooling, not a shipped unit: it may use Bun APIs.
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
const VIEW_ENTRIES = new Set(["assemble", "catalog"]);
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "coverage"]);
const SCOPE = "@askboard/";

const RULE_BUILT_IN =
  "core and compute use no Node-only or Bun-only API outside their tests (AD-1)";
const RULE_OUTSIDE = "resolves outside packages/: not an AskBoard unit (AD-1)";
const RULE_UNKNOWN = "not an AskBoard package of the spine's layer table (AD-1)";

type Target =
  | { kind: "unit"; unit: string }
  | { kind: "built-in" }
  | { kind: "outside" }
  | { kind: "unknown" }
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
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const resolved = posix.normalize(posix.join(posix.dirname(file), specifier));
    return unitOfPath(resolved, true);
  }
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

// Type-only imports and exports leave no trace in Bun's scan, so they are rewritten as value ones
// first. A rewrite inside a string or comment changes nothing the scan reports.
const asValueImports = (source: string): string =>
  source
    .replace(/\bimport\s+type\s+(?!from\b)(?=[\w$*{])/g, "import ")
    .replace(/\bexport\s+type\s+(?=[*{])/g, "export ")
    .replace(/([{,]\s*)type\s+(?=[\w$]+\s*(?:,|}|as\b))/g, "$1");

// Import type queries such as `import("x").T` leave no trace either. This pattern also matches
// inside strings and comments: such a match fails the check loudly rather than passing silently.
const IMPORT_TYPE_QUERY = /\bimport\s*\(\s*(["'`])([^"'`$\n]+)\1\s*\)/g;

const loaderOf = (file: string): "ts" | "tsx" | "js" => {
  if (/\.[jt]sx$/.test(file)) return "tsx";
  return /\.[cm]?ts$/.test(file) ? "ts" : "js";
};

const specifiersOf = (file: string, source: string): string[] => {
  const transpiler = new Bun.Transpiler({ loader: loaderOf(file) });
  const scanned = transpiler.scanImports(asValueImports(source)).map((entry) => entry.path);
  const queried = [...source.matchAll(IMPORT_TYPE_QUERY)].map((match) => match[2] ?? "");
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
    case "built-in":
      if (!RUNTIME_NEUTRAL.has(unit) || isTestFile(file)) return undefined;
      return { file, specifier, target: "built-in", rule: RULE_BUILT_IN };
    case "unit":
      if (baseUnit(target.unit) === unit || ALLOWED[unit]?.includes(target.unit)) return undefined;
      return { file, specifier, target: target.unit, rule: unitRule(unit) };
  }
};

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
  return specifiers.flatMap((specifier) => violationOf(file, owner.unit, specifier) ?? []);
};

const sourceFiles = async (root: string, directory: string): Promise<string[]> => {
  const entries = await readdir(join(root, directory), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = posix.join(directory, entry.name);
      if (entry.isDirectory()) {
        const skipped = SKIPPED_DIRECTORIES.has(entry.name) || entry.name.startsWith(".");
        return skipped ? [] : sourceFiles(root, path);
      }
      return entry.isFile() && SOURCE_FILE.test(entry.name) ? [path] : [];
    }),
  );
  return nested.flat();
};

export const checkImports = async (
  root: string,
): Promise<{ files: number; violations: Violation[] }> => {
  const files = (await sourceFiles(root, "packages")).sort();
  const results = await Promise.all(
    files.map(async (file) => checkSource(file, await Bun.file(join(root, file)).text())),
  );
  return { files: files.length, violations: results.flat() };
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
  const outcome = violations.length === 0 ? "no violations" : `${violations.length} violations`;
  log(`check:imports: ${files} files under ${where}/packages, ${outcome}`);
  return violations.length === 0 ? 0 : 1;
};

if (import.meta.main) {
  process.exitCode = await main(Bun.argv.slice(2));
}

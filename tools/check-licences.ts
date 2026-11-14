// Licence check (AD-19): fails on a package in bun.lock whose licence is outside the adoption
// rule of docs/prd-askboard-2026-10-25/addendum.md, and on a direct dependency whose repository
// is archived. Licences come from the installed package.json, or from the npm registry for
// packages meant for another platform. Repository tooling, not a shipped unit: it may use Bun APIs.
//
// Usage: GITHUB_TOKEN=<token> bun tools/check-licences.ts [root]
// Without a token a local run skips the archive lookups and says so; a CI run fails instead.

import { readdir } from "node:fs/promises";
import { join } from "node:path";

export type Verdict = "permissive" | "unmodified-only" | "outside";

export type Installed = {
  name: string;
  version: string;
  licence: string | undefined;
  repository: unknown;
};

// Corrects wrong package metadata only; never admits a licence outside the rule.
export type Override = {
  package: string;
  version: string;
  found: string;
  licence: string;
  evidence: string;
};

// A licence exception the addendum names (atoms, design decision 9): admitted for this exact
// package name at this exact licence only, and for a package that ships in no chunk.
export type LicenceException = {
  name: string;
  licence: string;
  reason: string;
  source: string;
  shippedIn: string[];
};

type Repository = { owner: string; repo: string };
type Direct = { name: string; repository: unknown };

// The addendum names MIT, Apache-2.0 and BSD as its OSI-approved permissive examples; ISC and
// 0BSD are the same kind. MPL-2.0 and EPL-2.0 are admitted for unmodified dependencies only.
const PERMISSIVE = new Set(["MIT", "APACHE-2.0", "BSD-2-CLAUSE", "BSD-3-CLAUSE", "ISC", "0BSD"]);
const UNMODIFIED_ONLY = new Set(["MPL-2.0", "EPL-2.0"]);
const RANK: Record<Verdict, number> = { outside: 0, "unmodified-only": 1, permissive: 2 };
const OPERATORS = new Set(["AND", "OR", "WITH"]);
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
const OVERRIDE_FIELDS = ["package", "version", "licence", "evidence"] as const;
const OVERRIDES_FILE = "tools/licence-overrides.json";
const EXCEPTIONS_FILE = "tools/licence-exceptions.json";
const EXCEPTION_FIELDS = ["name", "licence", "reason", "source"] as const;
const GITHUB_API = "https://api.github.com/repos";
const NPM_REGISTRY = "https://registry.npmjs.org";

const best = (a: Verdict, b: Verdict): Verdict => (RANK[a] >= RANK[b] ? a : b);
const worst = (a: Verdict, b: Verdict): Verdict => (RANK[a] <= RANK[b] ? a : b);

const verdictOfId = (id: string): Verdict => {
  const upper = id.toUpperCase();
  if (PERMISSIVE.has(upper)) return "permissive";
  return UNMODIFIED_ONLY.has(upper) ? "unmodified-only" : "outside";
};

// SPDX expression: `OR` passes when one alternative passes, `AND` needs all; AND binds tighter.
// A `WITH` exception, an unknown identifier or a malformed expression is outside the rule.
export const classify = (expression: string | undefined): Verdict => {
  const tokens = expression?.match(/\(|\)|[^\s()]+/g) ?? [];
  let position = 0;
  const peek = () => tokens[position]?.toUpperCase();
  function fail(): never {
    throw new SyntaxError(`malformed licence expression: ${expression}`);
  }

  const atom = (): Verdict => {
    const token = tokens[position++];
    if (token === "(") {
      const inner = or();
      if (tokens[position++] !== ")") fail();
      return inner;
    }
    if (token === undefined || token === ")" || OPERATORS.has(token.toUpperCase())) fail();
    if (peek() === "WITH") {
      if (tokens[position + 1] === undefined) fail();
      position += 2;
      return "outside";
    }
    return verdictOfId(token);
  };
  const and = (): Verdict => {
    let verdict = atom();
    while (peek() === "AND") {
      position++;
      verdict = worst(verdict, atom());
    }
    return verdict;
  };
  const or = (): Verdict => {
    let verdict = and();
    while (peek() === "OR") {
      position++;
      verdict = best(verdict, and());
    }
    return verdict;
  };

  if (tokens.length === 0) return "outside";
  try {
    const verdict = or();
    return position === tokens.length ? verdict : "outside";
  } catch {
    return "outside";
  }
};

// The licence a package.json declares: `license`, or the legacy `license.type` or `licenses`.
// Several legacy entries must all pass, so they are joined with AND.
export const licenceOf = (manifest: Record<string, unknown>): string | undefined => {
  const { license, licenses } = manifest;
  const typeOf = (value: unknown): string | undefined => {
    if (typeof value === "string") return value.trim() || undefined;
    const type = (value as { type?: unknown } | null)?.type;
    return typeof type === "string" ? type : undefined;
  };
  if (license !== undefined) return typeOf(license);
  if (!Array.isArray(licenses) || licenses.length === 0) return undefined;
  const types = licenses.map(typeOf);
  return types.every((type) => type !== undefined)
    ? types.map((type) => `(${type})`).join(" AND ")
    : undefined;
};

export const parseOverrides = (raw: unknown): { overrides: Override[]; errors: string[] } => {
  if (!Array.isArray(raw)) return { overrides: [], errors: [`${OVERRIDES_FILE} must be a list`] };
  const overrides: Override[] = [];
  const errors: string[] = [];
  raw.forEach((entry: unknown, index) => {
    const record = (typeof entry === "object" && entry !== null ? entry : {}) as Record<
      string,
      unknown
    >;
    const missing: string[] = OVERRIDE_FIELDS.filter(
      (field) => typeof record[field] !== "string" || record[field] === "",
    );
    // `found` may be empty: the metadata had no licence at all.
    if (typeof record.found !== "string") missing.push("found");
    if (missing.length > 0) {
      errors.push(`${OVERRIDES_FILE} entry ${index}: ${missing.join(", ")} must be strings`);
      return;
    }
    overrides.push(record as unknown as Override);
  });
  return { overrides, errors };
};

/**
 * What the exceptions table says wrong of itself: an entry may not admit a licence the rule
 * already admits (it would be no exception) or one that names a conjunction with an excluded term.
 */
export const parseExceptions = (
  raw: unknown,
): { exceptions: LicenceException[]; errors: string[] } => {
  if (!Array.isArray(raw)) {
    return { exceptions: [], errors: [`${EXCEPTIONS_FILE} must be a list`] };
  }
  const exceptions: LicenceException[] = [];
  const errors: string[] = [];
  raw.forEach((entry: unknown, index) => {
    const record = (typeof entry === "object" && entry !== null ? entry : {}) as Record<
      string,
      unknown
    >;
    const where = `${EXCEPTIONS_FILE} entry ${index}`;
    const missing = EXCEPTION_FIELDS.filter(
      (field) => typeof record[field] !== "string" || record[field] === "",
    );
    if (missing.length > 0) {
      errors.push(`${where}: ${missing.join(", ")} must be non-empty strings`);
    } else if (!Array.isArray(record.shippedIn) || record.shippedIn.length > 0) {
      errors.push(
        `${where}: shippedIn must be an empty list: an exception holds only while no chunk ships the package`,
      );
    } else if (/^(GPL|AGPL|LGPL)/i.test(String(record.licence))) {
      errors.push(
        `${where}: the licence ${record.licence} is a copyleft licence the table does not admit`,
      );
    } else {
      exceptions.push(record as unknown as LicenceException);
    }
  });
  return { exceptions, errors };
};

/** An entry the rule already admits is no exception and stays out of the table. */
export const exceptionProblems = (exceptions: readonly LicenceException[]): string[] =>
  exceptions
    .filter(({ licence }) => classify(licence) !== "outside")
    .map(
      ({ name, licence }) =>
        `${EXCEPTIONS_FILE}: ${name} at ${licence} needs no exception: the adoption rule admits it`,
    );

const checkPackage = (
  pkg: Installed,
  override: Override | undefined,
  patched: ReadonlySet<string>,
  exceptions: readonly LicenceException[],
): string[] => {
  const id = `${pkg.name}@${pkg.version}`;
  let licence = pkg.licence;
  if (override) {
    if ((pkg.licence ?? "") !== override.found) {
      return [
        `${id}: the override expects licence "${override.found}", but the metadata says "${pkg.licence ?? ""}": it does not match`,
      ];
    }
    if (classify(override.licence) === "outside") {
      return [`${id}: override to ${override.licence} refused: it is outside the adoption rule`];
    }
    licence = override.licence;
  }
  const verdict = classify(licence);
  if (verdict === "outside") {
    // The table admits one name at one licence, as the addendum names it, and nothing else.
    if (exceptions.some((entry) => entry.name === pkg.name && entry.licence === licence)) return [];
    return [
      licence === undefined
        ? `${id}: no licence`
        : `${id}: licence ${licence} is outside the adoption rule`,
    ];
  }
  if (verdict === "unmodified-only" && (patched.has(id) || patched.has(pkg.name))) {
    return [`${id}: ${licence} is admitted only for unmodified dependencies, and it is patched`];
  }
  return [];
};

export const checkPackages = (
  packages: readonly Installed[],
  overrides: readonly Override[],
  patched: ReadonlySet<string>,
  exceptions: readonly LicenceException[] = [],
): string[] => {
  const used = new Set<Override>();
  const problems = packages.flatMap((pkg) => {
    const override = overrides.find(
      (entry) => entry.package === pkg.name && entry.version === pkg.version,
    );
    if (override) used.add(override);
    return checkPackage(pkg, override, patched, exceptions);
  });
  for (const entry of exceptions) {
    if (!packages.some((pkg) => pkg.name === entry.name && pkg.licence === entry.licence)) {
      problems.push(`exception ${entry.name} (${entry.licence}) matches no installed package`);
    }
  }
  for (const override of overrides) {
    if (!used.has(override)) {
      problems.push(
        `override ${override.package}@${override.version} matches no installed package`,
      );
    }
  }
  return problems;
};

// github.com must be the host: git+https://, https://, git://, ssh:// or git@ forms.
const GITHUB_URL =
  /^(?:git\+)?(?:(?:https?|ssh|git):\/\/(?:[^@/\s]+@)?|[^@/\s]+@)github\.com[/:]([^/\s]+)\/([^/#?\s]+?)(?:\.git)?(?:[/#?].*)?$/;
const GITHUB_SHORTHAND = /^(?:github:)?([\w.-]+)\/([\w.-]+?)(?:\.git)?$/;

export const repositoryOf = (value: unknown): Repository | undefined => {
  if (typeof value === "object" && value !== null) {
    return repositoryOf((value as { url?: unknown }).url);
  }
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(GITHUB_URL) ?? value.trim().match(GITHUB_SHORTHAND);
  const [, owner, repo] = match ?? [];
  return owner && repo ? { owner, repo } : undefined;
};

const lookUpArchived = async (
  { owner, repo }: Repository,
  names: string,
  token: string,
  fetcher: typeof fetch,
): Promise<string[]> => {
  const where = `${names}: GitHub lookup of ${owner}/${repo}`;
  try {
    const response = await fetcher(`${GITHUB_API}/${owner}/${repo}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
      },
    });
    if (response.status !== 200) return [`${where} returned ${response.status}`];
    const { archived } = (await response.json()) as { archived?: unknown };
    if (typeof archived !== "boolean") return [`${where}: the reply has no archived field`];
    return archived ? [`${names}: repository ${owner}/${repo} is archived`] : [];
  } catch (error) {
    return [`${where} failed: ${error instanceof Error ? error.message : String(error)}`];
  }
};

export const checkArchives = async (
  direct: readonly Direct[],
  options: { token: string | undefined; ci: boolean; fetch: typeof fetch },
): Promise<{ problems: string[]; skipped: boolean }> => {
  const problems: string[] = [];
  const repositories = new Map<string, { repository: Repository; names: string[] }>();
  for (const { name, repository } of direct) {
    const found = repositoryOf(repository);
    if (!found) {
      problems.push(`${name}: no GitHub repository in its package.json`);
      continue;
    }
    const key = `${found.owner}/${found.repo}`.toLowerCase();
    const group = repositories.get(key) ?? { repository: found, names: [] };
    group.names.push(name);
    repositories.set(key, group);
  }
  if (!options.token) {
    if (!options.ci) return { problems, skipped: true };
    problems.push("archive step: GITHUB_TOKEN is not set, and a CI run must not skip it");
    return { problems, skipped: false };
  }
  const { token } = options;
  const lookups = await Promise.all(
    [...repositories.values()].map(({ repository, names }) =>
      lookUpArchived(repository, names.join(", "), token, options.fetch),
    ),
  );
  return { problems: [...problems, ...lookups.flat()], skipped: false };
};

type Tree = {
  packages: Installed[];
  otherPlatforms: string[];
  // Per package, the names of the bundled dependencies bun.lock lists under its key.
  bundled: Map<string, Set<string>>;
  direct: Direct[];
  patched: Set<string>;
  problems: string[];
};

type LockEntry = [string, string?, Record<string, unknown>?, string?];
type Lockfile = {
  workspaces: Record<string, Record<string, unknown>>;
  packages: Record<string, LockEntry>;
};

// The bun.lock format this check reads, written by Bun 1.4.4. Another format fails the check
// rather than passing it with nothing to check.
const LOCKFILE_VERSION = 2;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const lockfileOf = (parsed: unknown): Lockfile => {
  if (!isRecord(parsed) || parsed.lockfileVersion !== LOCKFILE_VERSION) {
    throw new Error(`bun.lock: lockfileVersion ${LOCKFILE_VERSION} expected`);
  }
  const { workspaces, packages } = parsed;
  if (!isRecord(packages) || !isRecord(workspaces) || !isRecord(workspaces[""])) {
    throw new Error("bun.lock: packages, workspaces and the root workspace expected");
  }
  for (const [key, entry] of Object.entries(packages)) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string" || entry[0].lastIndexOf("@") < 1) {
      throw new Error(`bun.lock: malformed entry for ${key}`);
    }
  }
  const ids = Object.values(packages).map((entry) => (entry as LockEntry)[0]);
  if (ids.every((id) => id.includes("@workspace:"))) {
    throw new Error("bun.lock: no packages besides the workspaces");
  }
  return parsed as unknown as Lockfile;
};

// npm's os and cpu fields: values that admit a platform, or `!value` to exclude one.
const admits = (constraint: unknown, current: string): boolean => {
  if (constraint === undefined) return true;
  const values = (Array.isArray(constraint) ? constraint : [constraint]).map(String);
  if (values.includes(`!${current}`)) return false;
  return values.includes(current) || values.every((value) => value.startsWith("!"));
};

// Whether a package missing from node_modules may be meant for another platform. This machine's
// libc is not detected, so a package that names a libc may be.
const forAnotherPlatform = (meta: Record<string, unknown>): boolean => {
  if (meta.libc) return true;
  if (!meta.os && !meta.cpu) return false;
  return !(admits(meta.os, process.platform) && admits(meta.cpu, process.arch));
};

const bundles = (manifest: Record<string, unknown>): boolean => {
  const bundled = manifest.bundleDependencies ?? manifest.bundledDependencies;
  return bundled === true || (Array.isArray(bundled) && bundled.length > 0);
};

// The names a manifest bundles: its list, or every dependency when the field is `true`.
const bundledNames = (manifest: Record<string, unknown>): string[] => {
  const bundled = manifest.bundleDependencies ?? manifest.bundledDependencies;
  if (bundled === true)
    return Object.keys(isRecord(manifest.dependencies) ? manifest.dependencies : {});
  return Array.isArray(bundled) ? bundled.map(String) : [];
};

// Bun lists a bundled dependency under its parent's key, `<parent key>/<name>`, marked `bundled`.
const bundledParentKey = (
  key: string,
  name: string,
  meta: Record<string, unknown>,
): string | undefined =>
  meta.bundled === true && key.endsWith(`/${name}`) ? key.slice(0, -name.length - 1) : undefined;

// A package's bundled dependencies pass when bun.lock lists each of them, since each is then
// checked as a package of its own; any it does not list stay unseen and are named.
const bundlingProblems = (
  id: string,
  manifest: Record<string, unknown>,
  listed: ReadonlySet<string>,
): string[] => {
  if (!bundles(manifest)) return [];
  const names = bundledNames(manifest);
  const unseen = names.filter((bundled) => !listed.has(bundled));
  if (names.length > 0 && unseen.length === 0) return [];
  const named = unseen.length > 0 ? `: ${unseen.join(", ")}` : "";
  return [`${id}: bundles dependencies, which this check cannot see${named}`];
};

const splitId = (id: string): { name: string; version: string } => {
  const at = id.lastIndexOf("@");
  return { name: id.slice(0, at), version: id.slice(at + 1) };
};

// Every package in bun.lock, read from its installed package.json under Bun's isolated layout,
// node_modules/.bun/<name with + for />@<version>/node_modules/<name>/.
const readTree = async (root: string): Promise<Tree> => {
  let parsed: unknown;
  try {
    parsed = Bun.JSONC.parse(await Bun.file(join(root, "bun.lock")).text());
  } catch (error) {
    throw new Error(`cannot read bun.lock: ${error instanceof Error ? error.message : error}`);
  }
  const lock = lockfileOf(parsed);
  const manifest = (await Bun.file(join(root, "package.json")).json()) as Record<string, unknown>;
  // A patch on any version of a package counts, whatever form its key takes.
  const patchKeys = Object.keys((manifest.patchedDependencies as object | null) ?? {});
  const patched = new Set(
    patchKeys.flatMap((key) => [key, key.lastIndexOf("@") > 0 ? splitId(key).name : key]),
  );
  const store = join(root, "node_modules", ".bun");
  const directories = await readdir(store).catch(() => [] as string[]);
  const directoryOf = (name: string, version: string): string | undefined => {
    const stem = `${name.replaceAll("/", "+")}@${version.replaceAll("/", "+")}`;
    return directories.find((entry) => entry === stem || entry.startsWith(`${stem}+`));
  };
  // A package that is not installed may be meant for another platform by its own os, cpu or libc,
  // or as a bundled dependency of such a package, which ships inside it (renderer spike, row 20).
  const forAnotherPlatformAt = (key: string): boolean => {
    const [id, , meta = {}] = lock.packages[key] ?? [];
    if (id === undefined) return false;
    const { name, version } = splitId(id);
    if (directoryOf(name, version) !== undefined) return false;
    if (forAnotherPlatform(meta)) return true;
    const parent = bundledParentKey(key, name, meta);
    return parent !== undefined && forAnotherPlatformAt(parent);
  };

  const parentKeyOf = (key: string): string | undefined => {
    const [id, , meta = {}] = lock.packages[key] ?? [];
    return id === undefined ? undefined : bundledParentKey(key, splitId(id).name, meta);
  };
  // The folder a package is installed in. A bundled dependency of an installed package ships
  // inside it, where npm packs it: in its parent's node_modules or hoisted to a bundling
  // ancestor's. That copy is the one checked, whatever version bun.lock names, since Bun
  // resolves a bundled range afresh. Otherwise, the package's own folder in Bun's store.
  const installedAt = async (key: string): Promise<string | undefined> => {
    const [id] = lock.packages[key] ?? [];
    if (id === undefined) return undefined;
    const { name, version } = splitId(id);
    for (let at = parentKeyOf(key); at !== undefined; at = parentKeyOf(at)) {
      const base = await installedAt(at);
      if (base === undefined) break;
      const candidate = join(base, "node_modules", name);
      const found: unknown = await Bun.file(join(candidate, "package.json"))
        .json()
        .catch(() => undefined);
      if (isRecord(found) && found.name === name) return candidate;
    }
    const directory = directoryOf(name, version);
    return directory === undefined ? undefined : join(store, directory, "node_modules", name);
  };

  const tree: Tree = {
    packages: [],
    otherPlatforms: [],
    bundled: new Map(),
    direct: [],
    patched,
    problems: [],
  };
  for (const [key, [id, , meta = {}]] of Object.entries(lock.packages)) {
    const parentId = lock.packages[bundledParentKey(key, splitId(id).name, meta) ?? ""]?.[0];
    if (parentId !== undefined) {
      tree.bundled.set(parentId, (tree.bundled.get(parentId) ?? new Set()).add(splitId(id).name));
    }
  }
  const byId = new Map<string, Installed>();
  // Installed packages are read once per folder, so a bundled copy is read beside the store's
  // copy of the same id; packages not installed, once per id.
  const seen = new Set<string>();
  for (const [key, [id]] of Object.entries(lock.packages)) {
    const { name, version } = splitId(id);
    if (version.startsWith("workspace:")) continue;
    const directory = await installedAt(key);
    if (seen.has(directory ?? id)) continue;
    seen.add(directory ?? id);
    if (directory === undefined) {
      if (forAnotherPlatformAt(key)) tree.otherPlatforms.push(id);
      else tree.problems.push(`${id}: listed in bun.lock but not installed; run bun install`);
      continue;
    }
    const installed = (await Bun.file(join(directory, "package.json")).json()) as Record<
      string,
      unknown
    >;
    tree.problems.push(...bundlingProblems(id, installed, tree.bundled.get(id) ?? new Set()));
    // A bundled copy is named by the version it holds.
    const held = typeof installed.version === "string" ? installed.version : version;
    const pkg = {
      name,
      version: held,
      licence: licenceOf(installed),
      repository: installed.repository,
    };
    // A direct dependency is a package of its own, never a bundled copy.
    if (parentKeyOf(key) === undefined) byId.set(id, pkg);
    tree.packages.push(pkg);
  }

  const directNames = new Set<string>();
  for (const workspace of Object.values(lock.workspaces)) {
    for (const field of DEPENDENCY_FIELDS) {
      const dependencies = (workspace[field] ?? {}) as Record<string, string>;
      for (const [name, spec] of Object.entries(dependencies)) {
        if (!String(spec).startsWith("workspace:")) directNames.add(name);
      }
    }
  }
  for (const name of [...directNames].sort()) {
    const id = lock.packages[name]?.[0];
    const pkg = id === undefined ? undefined : byId.get(id);
    if (pkg) tree.direct.push({ name, repository: pkg.repository });
    else if (id === undefined || !tree.otherPlatforms.includes(id)) {
      tree.problems.push(`${name}: a direct dependency that is not installed; run bun install`);
    }
  }
  return tree;
};

const readFromRegistry = async (
  id: string,
  fetcher: typeof fetch,
  listed: ReadonlySet<string>,
): Promise<{ pkg?: Installed; problems: string[] }> => {
  const { name, version } = splitId(id);
  const where = `${id}: npm registry lookup`;
  try {
    const response = await fetcher(`${NPM_REGISTRY}/${name}/${version}`, {
      headers: { accept: "application/json" },
    });
    if (response.status !== 200) return { problems: [`${where} returned ${response.status}`] };
    const manifest: unknown = await response.json();
    if (!isRecord(manifest)) return { problems: [`${where}: the reply is not a package manifest`] };
    const pkg = { name, version, licence: licenceOf(manifest), repository: manifest.repository };
    return { pkg, problems: bundlingProblems(id, manifest, listed) };
  } catch (error) {
    return {
      problems: [`${where} failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
};

// Packages for another platform are not installed here, so their licences come from the npm
// registry's metadata for the exact version. `bundled` holds, per package, the bundled
// dependencies that bun.lock lists, which are read as packages of their own.
export const readRegistry = async (
  ids: readonly string[],
  fetcher: typeof fetch,
  bundled: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
): Promise<{ packages: Installed[]; problems: string[] }> => {
  const results = await Promise.all(
    ids.map((id) => readFromRegistry(id, fetcher, bundled.get(id) ?? new Set())),
  );
  return {
    packages: results.flatMap((result) => (result.pkg ? [result.pkg] : [])),
    problems: results.flatMap((result) => result.problems),
  };
};

const readOverrides = async (
  root: string,
): Promise<{ overrides: Override[]; errors: string[] }> => {
  try {
    return parseOverrides(await Bun.file(join(root, OVERRIDES_FILE)).json());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { overrides: [], errors: [`cannot read ${OVERRIDES_FILE}: ${message}`] };
  }
};

const readExceptions = async (
  root: string,
): Promise<{ exceptions: LicenceException[]; errors: string[] }> => {
  try {
    const { exceptions, errors } = parseExceptions(
      await Bun.file(join(root, EXCEPTIONS_FILE)).json(),
    );
    return { exceptions, errors: [...errors, ...exceptionProblems(exceptions)] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exceptions: [], errors: [`cannot read ${EXCEPTIONS_FILE}: ${message}`] };
  }
};

export const main = async (
  args: readonly string[],
  dependencies: {
    env?: Record<string, string | undefined>;
    fetch?: typeof fetch;
    log?: (line: string) => void;
  } = {},
): Promise<number> => {
  const { env = process.env, fetch: fetcher = fetch, log = console.log } = dependencies;
  const root = args[0] ?? join(import.meta.dir, "..");
  let tree: Tree;
  try {
    tree = await readTree(root);
  } catch (error) {
    log(`check:licences: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const { overrides, errors } = await readOverrides(root);
  const named = await readExceptions(root);
  const remote = await readRegistry(tree.otherPlatforms, fetcher, tree.bundled);
  const token = env.GITHUB_TOKEN || undefined;
  const archive = await checkArchives(tree.direct, {
    token,
    ci: Boolean(env.CI) && env.CI !== "false",
    fetch: fetcher,
  });
  const problems = [
    ...tree.problems,
    ...errors,
    ...named.errors,
    ...remote.problems,
    ...checkPackages(
      [...tree.packages, ...remote.packages],
      overrides,
      tree.patched,
      named.exceptions,
    ),
    ...archive.problems,
  ];
  for (const problem of problems) log(problem);
  const archiveStep = token ? "checked" : archive.skipped ? "skipped (no GITHUB_TOKEN)" : "not run";
  const outcome = problems.length === 1 ? "1 problem" : `${problems.length || "no"} problems`;
  log(
    `check:licences: ${tree.packages.length} installed packages, ${tree.otherPlatforms.length} for other platforms read from the npm registry, ${tree.direct.length} direct dependencies, archive step: ${archiveStep}, ${outcome}`,
  );
  return problems.length === 0 ? 0 : 1;
};

if (import.meta.main) {
  process.exitCode = await main(Bun.argv.slice(2));
}

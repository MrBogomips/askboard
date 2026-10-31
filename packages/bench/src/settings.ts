// The benchmark's commands and settings (early-benchmark design decision 12). Every run of one
// benchmark uses the same pinned settings, and the user can set each of them (FR-32, AD-17).

import { ARMS, type Arm, CASE_IDS, CASES, type CaseId } from "./scenarios.ts";

/** Which session process every command uses: E1's, or the stub of bench's tests (decision 4). */
export type Session = "e1" | "stub";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type CacheTtl = "5m" | "1h";

export type RunSettings = {
  readonly session: Session;
  /** Overrides the session's plugin directory. */
  readonly pluginDir?: string;
  readonly cases: readonly CaseId[];
  readonly arms: readonly Arm[];
  readonly runs: number;
  readonly model: string;
  readonly effort: Effort;
  readonly cacheTtl: CacheTtl;
  /** `ENABLE_TOOL_SEARCH`'s value. */
  readonly toolSearch: string;
  readonly maxTurns: number;
  readonly timeoutSeconds: number;
  /** The `claude` command. */
  readonly claude: string;
  /** When set, the installed Claude Code must report this version. */
  readonly claudeVersion?: string;
  readonly auqPermissionHost: boolean;
  readonly out: string;
  readonly keepProjects: boolean;
};

export type Command =
  | { readonly kind: "run"; readonly settings: RunSettings }
  | { readonly kind: "smoke"; readonly session: Session; readonly pluginDir?: string }
  | { readonly kind: "report"; readonly folder: string }
  | { readonly kind: "help" };

/** A command line the benchmark cannot run; its message names the option at fault. */
export class UsageError extends Error {
  override readonly name = "UsageError";
}

const SESSIONS: readonly Session[] = ["e1", "stub"];
const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];
const TTLS: readonly CacheTtl[] = ["5m", "1h"];

// The proposal's open question 10.
export const DEFAULTS: RunSettings = {
  session: "e1",
  cases: ["S1", "S6"],
  arms: ["askboard", "auq", "baseline"],
  runs: 5,
  model: "claude-opus-5-5",
  effort: "medium",
  cacheTtl: "5m",
  toolSearch: "true",
  maxTurns: 12,
  timeoutSeconds: 300,
  claude: "claude",
  auqPermissionHost: true,
  out: ".askboard/bench",
  keepProjects: false,
};

export const USAGE = `Usage:
  bun packages/bench/src/cli.ts run    [--session e1|stub] [--cases S1,S6]
                                       [--arms askboard,auq,baseline]
                                       [--runs 5] [--model claude-opus-5-5] [--effort medium]
                                       [--cache-ttl 5m|1h] [--tool-search true] [--max-turns 12]
                                       [--timeout 300] [--claude claude] [--claude-version x.y.z]
                                       [--plugin-dir <dir>] [--auq-permission-host on|off]
                                       [--out .askboard/bench] [--keep-projects]
  bun packages/bench/src/cli.ts smoke  [--session e1|stub] [--plugin-dir <dir>]
  bun packages/bench/src/cli.ts report <run folder>`;

type Options = { readonly values: ReadonlyMap<string, string>; readonly rest: readonly string[] };

const FLAGS = new Set(["--keep-projects"]);

// `--name value` and `--name=value`; a flag takes no value.
const readOptions = (command: string, argv: readonly string[], known: Set<string>): Options => {
  const values = new Map<string, string>();
  const rest: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";
    if (!argument.startsWith("--")) {
      rest.push(argument);
      continue;
    }
    const equals = argument.indexOf("=");
    const name = equals === -1 ? argument : argument.slice(0, equals);
    if (!known.has(name)) throw new UsageError(`unknown option "${name}" for ${command}`);
    if (FLAGS.has(name)) {
      if (equals !== -1) throw new UsageError(`${name} takes no value`);
      values.set(name, "");
      continue;
    }
    if (equals === -1) index += 1;
    const value = equals === -1 ? argv[index] : argument.slice(equals + 1);
    if (value === undefined || value === "") throw new UsageError(`${name} needs a value`);
    values.set(name, value);
  }
  return { values, rest };
};

const oneOf = <T extends string>(name: string, value: string, allowed: readonly T[]): T => {
  const found = allowed.find((candidate) => candidate === value);
  if (found === undefined) throw new UsageError(`${name} must be one of ${allowed.join(", ")}`);
  return found;
};

const listOf = <T extends string>(
  name: string,
  value: string,
  allowed: readonly T[],
  noun: string,
): T[] => {
  const items = value.split(",").map((item) => item.trim());
  const found = items.map((item) => allowed.find((candidate) => candidate === item));
  if (items.length === 0 || found.some((item) => item === undefined)) {
    throw new UsageError(`${name} must name ${noun} among ${allowed.join(", ")}`);
  }
  return allowed.filter((candidate) => found.includes(candidate));
};

const wholeNumber = (name: string, value: string): number => {
  const number = Number(value);
  if (!/^\d+$/.test(value) || number < 1) {
    throw new UsageError(`${name} must be a whole number of at least 1`);
  }
  return number;
};

const TOOL_SEARCH = /^(true|false|auto|auto:\d{1,3})$/;
const VERSION = /^\d+\.\d+\.\d+$/;

const RUN_OPTIONS = new Set([
  "--session",
  "--plugin-dir",
  "--cases",
  "--arms",
  "--runs",
  "--model",
  "--effort",
  "--cache-ttl",
  "--tool-search",
  "--max-turns",
  "--timeout",
  "--claude",
  "--claude-version",
  "--auq-permission-host",
  "--out",
  "--keep-projects",
]);

// Each option's reader, applied to the defaults.
const RUN_READERS: Readonly<
  Record<string, (value: string, name: string) => Partial<Record<keyof RunSettings, unknown>>>
> = {
  "--session": (value, name) => ({ session: oneOf(name, value, SESSIONS) }),
  "--plugin-dir": (value) => ({ pluginDir: value }),
  "--cases": (value, name) => ({ cases: listOf(name, value, CASE_IDS, "cases") }),
  "--arms": (value, name) => ({ arms: listOf(name, value, ARMS, "arms") }),
  "--runs": (value, name) => ({ runs: wholeNumber(name, value) }),
  "--model": (value) => ({ model: value }),
  "--effort": (value, name) => ({ effort: oneOf(name, value, EFFORTS) }),
  "--cache-ttl": (value, name) => ({ cacheTtl: oneOf(name, value, TTLS) }),
  "--tool-search": (value, name) => {
    if (!TOOL_SEARCH.test(value)) {
      throw new UsageError(`${name} must be true, false, auto or auto:<percent>`);
    }
    return { toolSearch: value };
  },
  "--max-turns": (value, name) => ({ maxTurns: wholeNumber(name, value) }),
  "--timeout": (value, name) => ({ timeoutSeconds: wholeNumber(name, value) }),
  "--claude": (value) => ({ claude: value }),
  "--claude-version": (value, name) => {
    if (!VERSION.test(value)) throw new UsageError(`${name} must be a version such as 2.1.314`);
    return { claudeVersion: value };
  },
  "--auq-permission-host": (value, name) => ({
    auqPermissionHost: oneOf(name, value, ["on", "off"]) === "on",
  }),
  "--out": (value) => ({ out: value }),
  "--keep-projects": () => ({ keepProjects: true }),
};

const parseRun = (argv: readonly string[]): Command => {
  const { values, rest } = readOptions("run", argv, RUN_OPTIONS);
  if (rest.length > 0) throw new UsageError(`run takes no argument, got "${rest[0]}"`);
  let settings: RunSettings = DEFAULTS;
  for (const [name, value] of values) {
    const read = RUN_READERS[name];
    if (read !== undefined) settings = { ...settings, ...read(value, name) } as RunSettings;
  }
  const runnable = settings.cases.filter((id) =>
    CASES[id].arms.some((arm) => settings.arms.includes(arm)),
  );
  if (runnable.length === 0) {
    const where = settings.cases.map((id) => `${id} runs in ${CASES[id].arms.join(", ")}`);
    throw new UsageError(`no case runs in the arms chosen: ${where.join("; ")}`);
  }
  return { kind: "run", settings };
};

const parseSmoke = (argv: readonly string[]): Command => {
  const { values, rest } = readOptions("smoke", argv, new Set(["--session", "--plugin-dir"]));
  if (rest.length > 0) throw new UsageError(`smoke takes no argument, got "${rest[0]}"`);
  const session = oneOf("--session", values.get("--session") ?? DEFAULTS.session, SESSIONS);
  const pluginDir = values.get("--plugin-dir");
  return pluginDir === undefined
    ? { kind: "smoke", session }
    : { kind: "smoke", session, pluginDir };
};

const parseReport = (argv: readonly string[]): Command => {
  const { rest } = readOptions("report", argv, new Set());
  if (rest.length !== 1 || rest[0] === undefined) {
    throw new UsageError("report needs one run folder");
  }
  return { kind: "report", folder: rest[0] };
};

const PARSERS: Readonly<Record<string, (argv: readonly string[]) => Command>> = {
  run: parseRun,
  smoke: parseSmoke,
  report: parseReport,
};

/** Reads a command line (without the runtime and script); throws `UsageError` on a mistake. */
export const parseCommand = (argv: readonly string[]): Command => {
  const [name, ...rest] = argv;
  if (name === undefined || argv.includes("--help") || name === "help") return { kind: "help" };
  const parse = Object.hasOwn(PARSERS, name) ? PARSERS[name] : undefined;
  if (parse === undefined) throw new UsageError(`unknown command "${name}"`);
  return parse(rest);
};

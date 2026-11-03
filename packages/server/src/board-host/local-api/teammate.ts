// Telling an agent-team teammate (board-host spec, Telling a teammate and A teammate's stop is
// idle; design decision 4, Origin, PO decisions of 2026-11-03):
//
// - a pane teammate is a Claude Code process of its own, whose identity reaches it only as its
//   launch flags `--agent-id`, `--agent-name` and `--team-name`; nothing in the environment, the
//   hook input or the mod API names it. So this session process reads its parent's argument vector
//   once, `/proc/<ppid>/cmdline` on Linux and WSL, `ps` on macOS (argument vector, no shell, the
//   runner's 2 s bound), and keeps only those three values, taking the name only when the address
//   is `<name>@<team>`; the rest, which can hold settings and paths, is never kept, logged or sent.
//   Any doubt names nobody, so the label stays "Main agent";
// - an in-process teammate runs inside the lead's process under an opaque `agent_id`
//   (`aresearcher-096d99adc3d94b0a` in the PO's probe): the mod's turn report names it, and the
//   record table keeps that name (plan B). Only what its stop ends falls back, without that name, on
//   the form of that ID.

import { readFile } from "node:fs/promises";
import type { StopEnd } from "@askboard/core";
import type { Run } from "./origin.ts";

/** What a parent's argument vector says of this session. */
export type TeammateFlags =
  | { readonly kind: "teammate"; readonly name: string }
  /** None of the three flags: an ordinary session, the normal case. */
  | { readonly kind: "none" }
  /** Some of them, or all three not agreeing: no name, and a note. */
  | { readonly kind: "inconsistent" };

const AGENT_ID = "--agent-id";
const AGENT_NAME = "--agent-name";
const TEAM_NAME = "--team-name";
const FLAGS = [AGENT_ID, AGENT_NAME, TEAM_NAME] as const;
type Flag = (typeof FLAGS)[number];

/** The longest address taken, as the contract's agent-id schema bounds an `agent_id`. */
const ADDRESS_MAX_CHARS = 256;

/** The diagnostics notes; neither names an argument. */
export const PARENT_UNREADABLE_NOTE =
  "could not tell whether this session is a teammate: its parent's command line could not be read";
export const PARENT_UNCLEAR_NOTE =
  "could not tell whether this session is a teammate: its parent's command line is inconsistent";

// The flag an argument gives, and its value when it is the `--flag=value` form.
const flagOf = (arg: string): { flag: Flag; value?: string } | undefined => {
  for (const flag of FLAGS) {
    if (arg === flag) return { flag };
    if (arg.startsWith(`${flag}=`)) return { flag, value: arg.slice(flag.length + 1) };
  }
  return undefined;
};

// Each of the three flags' values, in order of appearance; a flag without a value gives undefined.
const valuesOf = (argv: readonly string[]): Map<Flag, (string | undefined)[]> => {
  const values = new Map<Flag, (string | undefined)[]>();
  for (let index = 0; index < argv.length; index += 1) {
    const found = flagOf(argv[index] as string);
    if (found === undefined) continue;
    let { value } = found;
    if (value === undefined) {
      value = argv[index + 1];
      index += 1;
    }
    values.set(found.flag, [...(values.get(found.flag) ?? []), value]);
  }
  return values;
};

/**
 * The teammate a parent's argument vector names: only when `--agent-id`, `--agent-name` and
 * `--team-name` are each given once, non-blank, and the ID is `<name>@<team>` within an agent ID's
 * length. Nothing else of the vector is returned.
 */
export const teammateFromArgv = (argv: readonly string[]): TeammateFlags => {
  const values = valuesOf(argv);
  if (values.size === 0) return { kind: "none" };
  const [id, name, team] = FLAGS.map((flag) => {
    const given = values.get(flag);
    return given?.length === 1 ? given[0] : undefined;
  });
  if (id === undefined || name === undefined || team === undefined) return { kind: "inconsistent" };
  if (name.trim() === "" || team.trim() === "" || id.length > ADDRESS_MAX_CHARS) {
    return { kind: "inconsistent" };
  }
  return id === `${name}@${team}` ? { kind: "teammate", name } : { kind: "inconsistent" };
};

/** `/proc/<pid>/cmdline`: arguments ended by NUL, an empty one kept. */
export const argvOfProc = (contents: string): string[] => {
  const args = contents.split("\0");
  if (args.at(-1) === "") args.pop();
  return args;
};

/**
 * `ps -o args=`: the arguments joined by spaces. An argument holding a space is split, so a name
 * with one cannot agree with its address.
 */
export const argvOfPs = (text: string): string[] => {
  const trimmed = text.trim();
  return trimmed === "" ? [] : trimmed.split(/\s+/);
};

const LOWERCASE_HEX = /^[0-9a-f]+$/;

// Whether the agent ID reads `a<agent_type>-<hex>`, as Claude Code 2.1.317 names a named agent
// (the PO's probe). Undocumented, so it serves the stop alone, never the label.
const isNamedAgentId = (agentId: string, agentType: string | undefined): boolean => {
  if (agentType === undefined) return false;
  const prefix = `a${agentType}-`;
  return agentId.startsWith(prefix) && LOWERCASE_HEX.test(agentId.slice(prefix.length));
};

/**
 * What an agent's allowed stop ends (board-host spec, A teammate's stop is idle; AD-10): only the
 * turn of an in-process teammate, which then waits for a message, and the work of any other agent.
 * A teammate is one the mod's report named (`teammate`, its name) or, without that, one whose ID
 * has a named agent's form. The open ask is the safe side: taking a teammate for a subagent loses
 * its ask, while taking a subagent for a teammate only leaves its asks open until the session
 * discards them (design decision 4, "Without the mod's report").
 */
export const stopEndOf = (
  teammate: string | undefined,
  agentId: string,
  agentType: string | undefined,
): StopEnd => {
  if (teammate !== undefined) return "idle";
  return isNamedAgentId(agentId, agentType) ? "idle" : "finished";
};

export type ParentArgvOptions = {
  /** `process.platform`: `ps` on macOS, `/proc` elsewhere. */
  readonly platform: string;
  readonly parentPid: number;
  /** The environment `ps` runs with, for its `PATH`. */
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly run: Run;
  /** Reads a file's text: the file system's by default. */
  readonly readFile?: (path: string) => Promise<string>;
};

const readText = (path: string): Promise<string> => readFile(path, "utf8");

/** Reads the parent's argument vector; none when it cannot. It never rejects. */
export type ParentArgv = (options: ParentArgvOptions) => Promise<readonly string[] | undefined>;

/** The system's parent argument vector: `ps` on macOS, `/proc/<ppid>/cmdline` on Linux and WSL. */
export const readParentArgv: ParentArgv = async (options) => {
  const { platform, parentPid, env, run, readFile: read = readText } = options;
  try {
    const argv =
      platform === "darwin"
        ? argvOfPs(
            (await run("ps", ["-ww", "-o", "args=", "-p", String(parentPid)], { cwd: "/", env })) ??
              "",
          )
        : argvOfProc(await read(`/proc/${parentPid}/cmdline`));
    return argv.length === 0 ? undefined : argv;
  } catch {
    return undefined;
  }
};

/**
 * This session process's own teammate name, from its parent's argument vector: none for an
 * ordinary session, and none, with one note naming no argument, when the vector cannot be read or
 * its flags disagree. It never rejects.
 */
export const parentTeammate = async ({
  argv,
  diagnose,
}: {
  readonly argv: Promise<readonly string[] | undefined>;
  readonly diagnose: (text: string) => void;
}): Promise<string | undefined> => {
  const read = await argv.catch(() => undefined);
  if (read === undefined) {
    diagnose(PARENT_UNREADABLE_NOTE);
    return undefined;
  }
  const flags = teammateFromArgv(read);
  if (flags.kind === "inconsistent") diagnose(PARENT_UNCLEAR_NOTE);
  return flags.kind === "teammate" ? flags.name : undefined;
};

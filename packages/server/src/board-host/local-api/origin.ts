// The origin of an owned ask (design decision 4; AD-5, AD-12): the label from the agent record, or
// from the teammate it names (`teammate.ts`), and, from one git run in the record's `cwd`, the
// worktree's top level, its branch and whether it
// belongs to the project's repository. Root is that top level when it does, else the project root,
// and the directory the header shows is the `cwd` relative to it, worked out here once.
// git runs with an argument vector, never through a shell (AD-8), and without the variables that
// would point it at another repository; a failed run gives the project root and no branch, never an
// error to the agent. A session without a project root gives no root, and git never runs.

import { realpathSync } from "node:fs";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import type { AgentRecord } from "@askboard/contract";
import type { Origin } from "@askboard/core";
import { teammateOfAgent } from "./teammate.ts";

/**
 * Runs a command and gives its standard output; no value when it exited with a failure. A command
 * that cannot start or run, such as one past its time bound, rejects. The entry point's runner
 * bounds every run at 2 s.
 */
export type Run = (
  command: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly env: Readonly<Record<string, string | undefined>> },
) => Promise<string | undefined>;

export type OriginOptions = {
  /**
   * The session project root, the real path of `CLAUDE_PROJECT_DIR` (AD-12); absent when the
   * variable is not set or its real path cannot be read.
   */
  readonly projectRoot?: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly run: Run;
  /**
   * This session process's own teammate name, when it is a pane teammate's (`parentTeammate`): read
   * once at start, awaited only for the main conversation's records.
   */
  readonly teammate?: Promise<string | undefined>;
};

// Variables that would make git read another repository than the one of the folder it runs in.
const STEERING_VARIABLES = ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"];

/** Resolves an agent record's origin; it never rejects. */
export type OriginOf = (record: AgentRecord) => Promise<Origin>;

/**
 * "Teammate <name>" for an in-process teammate's record, whose `agent_id` is its team address, and
 * for the main conversation when this session process is the pane teammate `teammate`; otherwise
 * "Main agent" for the main conversation and "Subagent <type>" for a subagent (design decision 4).
 */
export const labelOf = ({ agent_id, agent_type }: AgentRecord, teammate?: string): string => {
  const name = (agent_id === undefined ? teammate : teammateOfAgent(agent_id))?.trim() ?? "";
  if (name !== "") return `Teammate ${name}`;
  if (agent_id === undefined) return "Main agent";
  const type = agent_type?.trim() ?? "";
  return type === "" ? "Subagent" : `Subagent ${type}`;
};

// A directory git named, relative to the folder it ran in, as its real path; none when it has none.
const realDirectory = (from: string, path: string): string | undefined => {
  try {
    return realpathSync(isAbsolute(path) ? path : resolve(from, path));
  } catch {
    return undefined;
  }
};

const isInside = (path: string): boolean =>
  path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);

/**
 * `cwd` relative to `root`, a real path: "." at the root, relative inside it, and `cwd` itself
 * outside it. A `cwd` through a link into the root counts as inside.
 */
const directoryOf = (cwd: string, root: string): string => {
  for (const path of [cwd, realDirectory(cwd, cwd)]) {
    if (path === undefined) continue;
    const inside = relative(root, path);
    if (inside === "") return ".";
    if (isInside(inside)) return inside;
  }
  return cwd;
};

// The origin at `root`, with the directory the header shows.
const placed = (origin: Origin, root: string): Origin => ({
  ...origin,
  root,
  directory: directoryOf(origin.cwd, root),
});

type Git = (cwd: string, args: readonly string[], count: number) => Promise<string[] | undefined>;

// git, run from the project root without the steering variables; each run gives undefined when it
// failed or gave something else than asked.
const gitOf = ({ env, run }: OriginOptions, projectRoot: string): Git => {
  const gitEnv = Object.fromEntries(
    Object.entries(env).filter(([name]) => !STEERING_VARIABLES.includes(name)),
  );
  return async (cwd, args, count) => {
    try {
      const output = await run("git", ["-C", cwd, "rev-parse", ...args], {
        cwd: projectRoot,
        env: gitEnv,
      });
      const lines = output?.replace(/\n$/, "").split("\n");
      return lines?.length === count && lines.every((line) => line !== "") ? lines : undefined;
    } catch {
      return undefined;
    }
  };
};

/** The origin resolver of a session: the project's own common directory is looked up once. */
export const createOrigins = (options: OriginOptions): OriginOf => {
  const { projectRoot } = options;
  // A read that rejects names nobody; a subagent's label never waits for it.
  const teammate = options.teammate?.catch(() => undefined);
  const labelFor = async (record: AgentRecord) =>
    labelOf(record, record.agent_id === undefined ? await teammate : undefined);
  if (projectRoot === undefined)
    return async (record) => ({ label: await labelFor(record), cwd: record.cwd });
  const git = gitOf(options, projectRoot);
  let projectCommon: Promise<string | undefined> | undefined;
  const commonOfProject = () => {
    projectCommon ??= git(projectRoot, ["--git-common-dir"], 1).then((lines) =>
      lines === undefined ? undefined : realDirectory(projectRoot, lines[0] as string),
    );
    return projectCommon;
  };
  return async (record) => {
    const { cwd } = record;
    const args = ["--show-toplevel", "--git-common-dir", "--abbrev-ref", "HEAD"];
    const [label, place, project] = await Promise.all([
      labelFor(record),
      git(cwd, args, 3),
      commonOfProject(),
    ]);
    const bare: Origin = { label, cwd };
    const outside = placed(bare, projectRoot);
    if (place === undefined || project === undefined) return outside;
    const [named, common, branch] = place as [string, string, string];
    const top = realDirectory(cwd, named);
    if (top === undefined || realDirectory(cwd, common) !== project) return outside;
    return { ...placed(bare, top), branch, worktree: basename(top) };
  };
};

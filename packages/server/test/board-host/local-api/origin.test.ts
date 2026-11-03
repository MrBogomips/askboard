import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AgentRecord, LOCAL_API_VERSION } from "@askboard/contract";
import { createOrigins, labelOf, type Run } from "../../../src/board-host/local-api/origin.ts";

// The origin of an ask (design decision 4; core spec, Origin of an ask; task 4.4): its label from
// the record, and its root, directory, branch and worktree from one git run in the record's cwd,
// the directory being the cwd relative to the root, "." at it and absolute outside it, against
// temporary repositories: the main checkout, a linked worktree, a folder outside the repository and
// a cwd where git fails; and without a session project root, no root and no git run (AD-12).

const folder = realpathSync(mkdtempSync(join(tmpdir(), "askboard-origin-")));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

// Git with no system or global configuration, so no signing or hook of the machine runs.
const env = {
  PATH: process.env.PATH ?? "",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  HOME: folder,
};

const git = (cwd: string, ...args: string[]) => {
  const run = Bun.spawnSync(["git", ...args], { cwd, env });
  if (run.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr.toString()}`);
};

const project = join(folder, "order-service");
const worktree = join(folder, "order-service-fix-retry");
const elsewhere = join(folder, "notes");
const otherRepo = join(folder, "other-repo");
mkdirSync(project);
git(project, "init", "--quiet", "--initial-branch=main");
git(
  project,
  "-c",
  "user.name=Paola",
  "-c",
  "user.email=p@example.com",
  "commit",
  "--quiet",
  "--allow-empty",
  "-m",
  "init",
);
mkdirSync(join(project, "services"));
git(project, "worktree", "add", "--quiet", "-b", "fix/retry", worktree);
mkdirSync(join(worktree, "services"));
mkdirSync(elsewhere);
mkdirSync(otherRepo);
git(otherRepo, "init", "--quiet", "--initial-branch=trunk");
git(
  otherRepo,
  "-c",
  "user.name=Paola",
  "-c",
  "user.email=p@example.com",
  "commit",
  "--quiet",
  "--allow-empty",
  "-m",
  "init",
);

const recordOf = (cwd: string, fields: Partial<AgentRecord> = {}): AgentRecord => ({
  version: LOCAL_API_VERSION,
  cwd,
  tool_name: "mcp__plugin_askboard_askboard__ask",
  askIds: ["order-db-choice-x7k2"],
  timestamp: "2026-10-29T09:40:31Z",
  ...fields,
});

const SUBAGENT = { agent_id: "a3f9c1d27b8e4f60", agent_type: "code-reviewer" } as const;

// The entry point's runner in short (`identity.ts`, which board-host's tests may not import): git
// with an argument vector, its output when it exits 0.
const runGit: Run = async (command, args, { cwd, env: runEnv }) => {
  const run = Bun.spawnSync([command, ...args], {
    cwd,
    env: { ...runEnv } as Record<string, string>,
  });
  return run.exitCode === 0 ? run.stdout.toString() : undefined;
};

const originsFor = (
  run: Run = runGit,
  options: {
    projectRoot?: string;
    env?: Record<string, string>;
    teammate?: Promise<string | undefined>;
  } = { projectRoot: project },
) => {
  const calls: string[][] = [];
  const environments: Readonly<Record<string, string | undefined>>[] = [];
  const counted: Run = (command, args, runOptions) => {
    calls.push([command, ...args]);
    environments.push(runOptions.env);
    return run(command, args, runOptions);
  };
  const { projectRoot, env: given = env, teammate } = options;
  const originOf = createOrigins({
    ...(projectRoot === undefined ? {} : { projectRoot }),
    ...(teammate === undefined ? {} : { teammate }),
    env: given,
    run: counted,
  });
  return { originOf, calls, environments };
};

describe("the label", () => {
  test("is Main agent without an agent ID, and Subagent with its type otherwise", async () => {
    const { originOf } = originsFor();
    expect((await originOf(recordOf(project))).label).toBe("Main agent");
    expect((await originOf(recordOf(project, SUBAGENT))).label).toBe("Subagent code-reviewer");
    const sideAgent = recordOf(project, { agent_id: "a0", agent_type: "" });
    expect((await originOf(sideAgent)).label).toBe("Subagent");
  });
});

// Telling a teammate (board-host spec; design decision 4, Origin; tasks 17.1 and 18.2): in a pane
// teammate's own session, "Teammate <name>" for its main conversation, from its parent's flags; its
// subagents stay subagents. An in-process teammate is named by the mod's report, in the record
// table, never by the form of its agent ID, which is opaque.
describe("a teammate's label", () => {
  const ADDRESS_LIKE = {
    agent_id: "researcher@session-a1b2c3d4",
    agent_type: "researcher",
  } as const;
  const OPAQUE = { agent_id: "aresearcher-096d99adc3d94b0a", agent_type: "researcher" } as const;

  test("labelOf covers the main conversation, a subagent and a pane teammate", () => {
    expect(labelOf(recordOf(project))).toBe("Main agent");
    expect(labelOf(recordOf(project, SUBAGENT))).toBe("Subagent code-reviewer");
    expect(labelOf(recordOf(project), "ask-log-level")).toBe("Teammate ask-log-level");
    expect(labelOf(recordOf(project, SUBAGENT), "ask-log-level")).toBe("Subagent code-reviewer");
    expect(labelOf(recordOf(project), " ")).toBe("Main agent");
  });

  test("an agent ID's form names no teammate: an address or a named agent's ID is a subagent", () => {
    expect(labelOf(recordOf(project, ADDRESS_LIKE))).toBe("Subagent researcher");
    expect(labelOf(recordOf(project, OPAQUE))).toBe("Subagent researcher");
  });

  test("a pane teammate's main conversation waits for the parent's name; its subagent does not", async () => {
    for (const projectRoot of [project, undefined]) {
      let tell: (name: string | undefined) => void = () => {};
      const teammate = new Promise<string | undefined>((resolve) => {
        tell = resolve;
      });
      const { originOf } = originsFor(runGit, {
        ...(projectRoot === undefined ? {} : { projectRoot }),
        teammate,
      });
      expect((await originOf(recordOf(project, SUBAGENT))).label).toBe("Subagent code-reviewer");
      const main = originOf(recordOf(project));
      tell("ask-log-level");
      expect((await main).label).toBe("Teammate ask-log-level");
      expect((await originOf(recordOf(project, OPAQUE))).label).toBe("Subagent researcher");
    }
  });

  test("a parent read that names nothing, or rejects, leaves the main agent", async () => {
    for (const teammate of [Promise.resolve(undefined), Promise.reject(new Error("EPERM"))]) {
      const { originOf } = originsFor(runGit, { projectRoot: project, teammate });
      expect((await originOf(recordOf(project))).label).toBe("Main agent");
    }
  });
});

describe("the place", () => {
  test("the main checkout: its top level as root, its branch and its folder name", async () => {
    const { originOf, calls } = originsFor();
    expect(await originOf(recordOf(project))).toEqual({
      label: "Main agent",
      cwd: project,
      root: project,
      directory: ".",
      branch: "main",
      worktree: "order-service",
    });
    expect(calls).toContainEqual([
      "git",
      "-C",
      project,
      "rev-parse",
      "--show-toplevel",
      "--git-common-dir",
      "--abbrev-ref",
      "HEAD",
    ]);
  });

  test("a folder inside the main checkout keeps the top level as root", async () => {
    const cwd = join(project, "services");
    const { originOf } = originsFor();
    expect(await originOf(recordOf(cwd))).toMatchObject({
      cwd,
      root: project,
      directory: "services",
      branch: "main",
    });
  });

  test("a linked worktree of the project's repository is the root, with its branch", async () => {
    const cwd = join(worktree, "services");
    const { originOf } = originsFor();
    expect(await originOf(recordOf(cwd, SUBAGENT))).toEqual({
      label: "Subagent code-reviewer",
      cwd,
      root: worktree,
      directory: "services",
      branch: "fix/retry",
      worktree: "order-service-fix-retry",
    });
  });

  test("a detached HEAD reads HEAD", async () => {
    const detached = join(folder, "detached");
    git(project, "worktree", "add", "--quiet", "--detach", detached);
    const { originOf } = originsFor();
    expect(await originOf(recordOf(detached))).toMatchObject({
      root: detached,
      directory: ".",
      branch: "HEAD",
    });
  });

  test("a folder outside any repository gives the project root and no branch", async () => {
    const { originOf } = originsFor();
    expect(await originOf(recordOf(elsewhere))).toEqual({
      label: "Main agent",
      cwd: elsewhere,
      root: project,
      directory: elsewhere,
    });
  });

  test("a folder of another repository gives the project root and no branch either", async () => {
    const { originOf } = originsFor();
    expect(await originOf(recordOf(otherRepo))).toEqual({
      label: "Main agent",
      cwd: otherRepo,
      root: project,
      directory: otherRepo,
    });
  });

  test("a cwd where git fails gives the project root, never an error", async () => {
    const gone = join(folder, "removed-since");
    const { originOf } = originsFor();
    expect(await originOf(recordOf(gone))).toEqual({
      label: "Main agent",
      cwd: gone,
      root: project,
      directory: gone,
    });
    const failing = originsFor(async () => {
      throw Object.assign(new Error("spawn git ENOENT"), { code: "ENOENT" });
    });
    expect(await failing.originOf(recordOf(project))).toEqual({
      label: "Main agent",
      cwd: project,
      root: project,
      directory: ".",
    });
  });

  test("output git did not give in three lines counts as a failed run", async () => {
    const { originOf } = originsFor(async () => `${project}\n.git\n`);
    expect(await originOf(recordOf(project))).toEqual({
      label: "Main agent",
      cwd: project,
      root: project,
      directory: ".",
    });
  });

  test("a top level git names through a link gives its real path as the root", async () => {
    const linked = join(folder, "linked-fix-retry");
    symlinkSync(worktree, linked);
    const { originOf } = originsFor(async (_command, args) =>
      args.includes("--show-toplevel")
        ? `${linked}\n${join(project, ".git")}\nfix/retry\n`
        : `${join(project, ".git")}\n`,
    );
    expect(await originOf(recordOf(linked))).toEqual({
      label: "Main agent",
      cwd: linked,
      root: worktree,
      directory: ".",
      branch: "fix/retry",
      worktree: "order-service-fix-retry",
    });
  });

  test("a top level whose real path cannot be read gives the project root and no branch", async () => {
    const gone = join(folder, "gone-since");
    const { originOf } = originsFor(async (_command, args) =>
      args.includes("--show-toplevel")
        ? `${gone}\n${join(project, ".git")}\nmain\n`
        : `${join(project, ".git")}\n`,
    );
    expect(await originOf(recordOf(project))).toEqual({
      label: "Main agent",
      cwd: project,
      root: project,
      directory: ".",
    });
  });

  test("git runs without GIT_DIR, GIT_WORK_TREE, GIT_COMMON_DIR or GIT_INDEX_FILE", async () => {
    const otherGit = join(otherRepo, ".git");
    const steering = {
      GIT_DIR: otherGit,
      GIT_WORK_TREE: otherRepo,
      GIT_COMMON_DIR: otherGit,
      GIT_INDEX_FILE: join(otherGit, "index"),
    };
    const cwd = join(worktree, "services");
    const { originOf, environments } = originsFor(runGit, {
      projectRoot: project,
      env: { ...env, ...steering },
    });
    expect(await originOf(recordOf(cwd))).toEqual({
      label: "Main agent",
      cwd,
      root: worktree,
      directory: "services",
      branch: "fix/retry",
      worktree: "order-service-fix-retry",
    });
    expect(environments.length).toBeGreaterThan(0);
    for (const runEnv of environments) {
      for (const name of Object.keys(steering)) expect(runEnv).not.toHaveProperty(name);
      expect(runEnv).toMatchObject({ PATH: env.PATH, HOME: folder });
    }
  });

  test("a cwd through a link into the root is named relative to it", async () => {
    const linked = join(folder, "link-to-order-service");
    symlinkSync(project, linked);
    const { originOf } = originsFor();
    expect(await originOf(recordOf(join(linked, "services")))).toMatchObject({
      root: project,
      directory: "services",
      branch: "main",
    });
  });

  test("the project's common directory is looked up once for the session", async () => {
    const { originOf, calls } = originsFor();
    await originOf(recordOf(project));
    await originOf(recordOf(worktree));
    const lookups = calls.filter((call) => !call.includes("--show-toplevel"));
    expect(lookups).toEqual([["git", "-C", project, "rev-parse", "--git-common-dir"]]);
  });
});

describe("without a session project root (AD-12)", () => {
  test("an origin has the label and the cwd only, and git never runs", async () => {
    const { originOf, calls } = originsFor(runGit, {});
    expect(await originOf(recordOf(project, SUBAGENT))).toEqual({
      label: "Subagent code-reviewer",
      cwd: project,
    });
    expect(await originOf(recordOf(join(worktree, "services")))).toEqual({
      label: "Main agent",
      cwd: join(worktree, "services"),
    });
    expect(calls).toEqual([]);
  });
});

// What makes an asker real for the built session process (push delivery, task 8.5): a git project
// in a temporary folder with its git user and a first commit, a linked worktree on its branch when
// the asker works in one, and the agent's working folder; then, once the session process has
// written its session file, the agent records its `PreToolUse` hooks would send, posted to its
// local API. The session file is found by the project it names, which is the scenario's own, so
// the runtime's launcher, a Volta shim say, never has to be the session process's parent.

import { mkdir, mkdtemp, readdir, readFile, realpath, rm } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AgentRecord,
  LOCAL_API_HOST,
  LOCAL_API_ROUTES,
  LOCAL_API_VERSION,
  SESSION_TOKEN_HEADER,
  type SessionEnvironment,
  sessionFolder,
} from "@askboard/contract";
import { validateSessionFile } from "@askboard/contract/validate";
import { type Asker, MAIN_BRANCH } from "./asker.ts";

/** The asking subagent's ID, and the prefix of the IDs of those of its type before it. */
export const SUBAGENT_ID = "a3f9c1d27b8e4f60";
const EARLIER_ID = "e2e0earlier";
/** The ask the earlier subagents' records name, which never binds. */
const EARLIER_ASK = "earlier-ask-e2e0";
const RECORD_TIME = "2026-10-31T09:40:31Z";
const SESSION_FILE_WAIT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 2_000;

export type AskerPlace = {
  /** The session project: `CLAUDE_PROJECT_DIR` for the session process. */
  readonly projectDir: string;
  /** The agent's working folder. */
  readonly cwd: string;
  cleanup(): Promise<void>;
};

// No automatic maintenance: git runs it detached after a commit, which would write into the
// project while the cleanup removes it.
const QUIET_GIT = ["-c", "maintenance.auto=false", "-c", "gc.auto=0"] as const;

const git = (args: readonly string[]): void => {
  const ran = Bun.spawnSync(["git", ...QUIET_GIT, ...args], { stdout: "ignore", stderr: "pipe" });
  if (ran.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${ran.stderr.toString().trim()}`);
  }
};

/** Makes the asker's project, worktree and working folder in a new temporary folder. */
export const prepareProject = async (asker: Asker): Promise<AskerPlace> => {
  const base = await mkdtemp(join(tmpdir(), "askboard-e2e-project-"));
  const cleanup = () => rm(base, { recursive: true, force: true });
  try {
    const projectDir = join(base, asker.project);
    git(["init", "--quiet", "--initial-branch", MAIN_BRANCH, projectDir]);
    git(["-C", projectDir, "config", "user.name", asker.gitUser]);
    git(["-C", projectDir, "config", "user.email", "askboard-e2e@example.invalid"]);
    git(["-C", projectDir, "commit", "--quiet", "--allow-empty", "--message", "start"]);
    const worktree = asker.agent?.worktree;
    let root = projectDir;
    if (worktree !== undefined) {
      root = join(base, worktree.folder);
      git(["-C", projectDir, "worktree", "add", "--quiet", "-b", worktree.branch, root]);
    }
    const directory = asker.agent?.directory;
    const cwd = directory === undefined ? root : join(root, directory);
    await mkdir(cwd, { recursive: true });
    return { projectDir, cwd, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
};

const recordOf = (
  tool: "ask" | "collect",
  askId: string,
  cwd: string,
  agent?: { readonly agent_id: string; readonly agent_type: string },
): AgentRecord => ({
  version: LOCAL_API_VERSION,
  ...agent,
  cwd,
  tool_name: `mcp__plugin_askboard_askboard__${tool}`,
  askIds: [askId],
  timestamp: RECORD_TIME,
});

/**
 * The records the asker's hooks send before a call: for an `ask`, first one record of each earlier
 * subagent of the type, which numbers the asking one; none for an unchecked ask.
 */
export const recordsFor = (
  asker: Asker,
  tool: "ask" | "collect",
  askId: string,
  cwd: string,
): AgentRecord[] => {
  const { agent } = asker;
  if (agent === undefined) return [];
  const subagent = agent.subagent;
  if (subagent === undefined) return [recordOf(tool, askId, cwd)];
  const earlier =
    tool === "ask"
      ? Array.from({ length: subagent.before ?? 0 }, (_, index) =>
          recordOf("collect", EARLIER_ASK, cwd, {
            agent_id: `${EARLIER_ID}${index + 1}`,
            agent_type: subagent.type,
          }),
        )
      : [];
  return [
    ...earlier,
    recordOf(tool, askId, cwd, { agent_id: SUBAGENT_ID, agent_type: subagent.type }),
  ];
};

export type LocalApi = { readonly apiAddress: string; readonly sessionToken: string };

/**
 * The local API of the session process whose session file names `projectDir`, once written: by its
 * real path, which the session file holds (AD-12).
 */
export const findLocalApi = async (
  env: SessionEnvironment,
  uid: number,
  projectDir: string,
  waitMs = SESSION_FILE_WAIT_MS,
): Promise<LocalApi> => {
  const folder = sessionFolder({ env, uid });
  const named = await realpath(projectDir).catch(() => projectDir);
  const until = Date.now() + waitMs;
  for (;;) {
    const names = await readdir(folder).catch(() => [] as string[]);
    for (const name of names.filter((entry) => entry.endsWith(".json"))) {
      const text = await readFile(join(folder, name), "utf8").catch(() => "");
      const checked = (() => {
        try {
          return validateSessionFile(JSON.parse(text));
        } catch {
          return undefined;
        }
      })();
      if (checked?.ok && checked.value.projectDir === named) {
        return { apiAddress: checked.value.apiAddress, sessionToken: checked.value.sessionToken };
      }
    }
    if (Date.now() > until) {
      throw new Error(`no session file in ${folder} names the project ${projectDir}`);
    }
    await Bun.sleep(25);
  }
};

/** Posts one record to the local API, as a `PreToolUse` hook does; fails unless it is taken. */
export const postRecord = (api: LocalApi, record: AgentRecord): Promise<void> =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(record);
    const sent = request(
      {
        socketPath: api.apiAddress,
        path: LOCAL_API_ROUTES.records.path,
        method: "POST",
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Host: LOCAL_API_HOST,
          [SESSION_TOKEN_HEADER]: api.sessionToken,
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(body)),
        },
      },
      (answer) => {
        answer.resume();
        answer.on("end", () =>
          answer.statusCode === 200
            ? resolve()
            : reject(new Error(`the local API refused a record with ${answer.statusCode}`)),
        );
      },
    );
    sent.on("timeout", () => sent.destroy(new Error("the local API did not answer a record")));
    sent.on("error", reject);
    sent.end(body);
  });

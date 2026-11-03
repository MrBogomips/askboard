// Push delivery as the session process composes it (E4, design decisions 3, 4, 9 and 12): the
// record table with its origin resolver, which the parent's teammate flags, read once here, feed,
// the notifier's notices, the local API with its session
// file, and the context header's data, beside E1's and the ask lifecycle's wiring, which it leaves
// as it is. ask-core takes `ports`, board-host the session project, mcp-tools `deps` and
// `firstRequest`, at which the local API starts (AD-2); `close` ends what it started.

import { realpathSync, statSync } from "node:fs";
import { basename, isAbsolute } from "node:path";
import { BACKGROUND_THRESHOLD_VARIABLE } from "@askboard/contract";
import { type AskCore, backgroundThreshold, type CorePorts } from "@askboard/core";
import {
  createLocalApi,
  createOrigins,
  type ParentArgv,
  parentTeammate,
  RecordTable,
  readParentArgv,
} from "./board-host/index.ts";
import { runCommand } from "./identity.ts";
import { type Diagnostics, note, type ToolDeps } from "./mcp-tools/index.ts";
import { createNotices, createNotifier, type Environment } from "./notifier/index.ts";

export type PushOptions = {
  readonly env: Environment;
  /** `process.platform`. */
  readonly platform: string;
  /** The working folder, which names the project when `CLAUDE_PROJECT_DIR` is not set. */
  readonly cwd: string;
  /** This process's PID, which the session file names (design decision 3). */
  readonly pid: number;
  /** The parent's PID: the Claude Code process, which keys the session file (AD-5). */
  readonly parentPid: number;
  /** The user's ID, which names the session folder outside `XDG_RUNTIME_DIR`. */
  readonly uid: number;
  /**
   * Reads the parent's argument vector, for the teammate label (design decision 4, Origin): the
   * system's by default. Only tests give another.
   */
  readonly parentArgv?: ParentArgv;
};

export type PushComposition = {
  /** ask-core's push delivery ports. */
  readonly ports: Pick<CorePorts, "records" | "notices" | "diagnose" | "header">;
  /** The project as the header names it: `CLAUDE_PROJECT_DIR`, else the working folder. */
  readonly projectDir: string;
  /** mcp-tools' part: which owner is the main conversation. */
  readonly deps: Pick<ToolDeps, "mainConversation">;
  /** Starts the local API, at the first request other than `server/discover`. */
  readonly firstRequest: () => void;
  /** Ends the notifications and closes the local API. */
  readonly close: () => Promise<void>;
};

/**
 * The session project root (AD-12): the real path of `CLAUDE_PROJECT_DIR`, and none when the
 * variable is not set, is not absolute, or its real path cannot be read or is not a folder. The
 * working folder never stands in for it, nor resolves a relative path.
 */
export const sessionProjectRoot = (env: Environment): string | undefined => {
  const named = env.CLAUDE_PROJECT_DIR;
  if (!named || !isAbsolute(named)) return undefined;
  try {
    const real = realpathSync(named);
    return statSync(real).isDirectory() ? real : undefined;
  } catch {
    return undefined;
  }
};

// The threshold as the header's ports take it: absent when calls are never moved to the background.
const optionalThreshold = (ms: number | undefined) =>
  ms === undefined ? {} : { backgroundThresholdMs: ms };

/** Builds push delivery's parts; nothing starts until `firstRequest`. */
export const composePush = (
  options: PushOptions,
  context: {
    readonly core: () => AskCore;
    readonly diagnostics: Diagnostics;
    readonly reportAs: (what: string) => (error: unknown) => void;
  },
): PushComposition => {
  const { env, platform } = options;
  const { diagnostics, reportAs } = context;
  const diagnose = (text: string) => diagnostics.write(note(text));
  // The project as the header, the notification and the identity name it; the working folder stands
  // in for display only, and an ask's root comes from the session project root alone.
  const projectDir = env.CLAUDE_PROJECT_DIR || options.cwd;
  const projectRoot = sessionProjectRoot(env);
  // The board opener the notification's action uses, and AD-18's check for the local API.
  const showing = createNotifier({ platform, env, report: reportAs("opening the board failed") });
  const notices = createNotices({
    platform,
    env,
    project: basename(projectDir),
    open: showing.open,
    report: reportAs("the system notification failed"),
    diagnose,
  });
  // Whether this session is a pane teammate's, read once from its parent's launch flags; the rest of
  // that argument vector is never kept (design decision 4, Origin).
  const teammate = parentTeammate({
    argv: (options.parentArgv ?? readParentArgv)({
      platform,
      parentPid: options.parentPid,
      env,
      run: runCommand,
    }),
    diagnose,
  });
  const records = new RecordTable({
    now: Date.now,
    originOf: createOrigins({
      ...(projectRoot === undefined ? {} : { projectRoot }),
      env,
      run: runCommand,
      teammate,
    }),
  });
  const localApi = createLocalApi({
    core: context.core,
    records,
    env,
    uid: options.uid,
    key: options.parentPid,
    pid: options.pid,
    platform,
    ...(projectRoot === undefined ? {} : { projectRoot }),
    showable: async () => (await showing.check()).showable,
    report: reportAs("the local API failed"),
    diagnose,
  });
  return {
    ports: {
      records,
      notices,
      diagnose,
      header: optionalThreshold(backgroundThreshold(env[BACKGROUND_THRESHOLD_VARIABLE])),
    },
    projectDir,
    deps: { mainConversation: (ownerKey) => records.isMainConversation(ownerKey) },
    firstRequest: () => {
      void localApi.start();
    },
    close: async () => {
      notices.close();
      await localApi.close();
    },
  };
};

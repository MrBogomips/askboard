// The session process as the entry point composes it (design decisions 3 and 9): ask-core, holding
// board-host's address, the notifier's showing, this machine's identity and the system clock,
// served over stdio by mcp-tools, whose shutdown closes the board host. Building it touches
// nothing: the board listener opens at the first ask (AD-2). board-host and mcp-tools each hear
// ask-core's events through its one subscription, the ask lifecycle's included (ask-lifecycle,
// task 5.3). Push delivery (E4) joins through `composePush`: its ports, the session project for
// board-host's context header, the local API started at the first request other than
// `server/discover`, and its close beside the board host's. Excerpts (E5) read pointers in the
// session project root alone, through the excerpts unit. The configuration (settings-languages,
// design decisions 3 and 12) joins as ask-core's `Config` port over the two files; the local API
// starts once ask-core has read them, so that its first `/v1/rule` answers the rule in effect, and
// board-host's editor command is the user file's (design decision 5).

import { randomBytes } from "node:crypto";
import { AskCore, type Clock, type SourceFiles } from "@askboard/core";
import type { Transport } from "@modelcontextprotocol/server";
import type { EditorCommand } from "./board-host/editor.ts";
import type { BoardHostOptions, ParentArgv } from "./board-host/index.ts";
import { createBoardHost } from "./board-host/index.ts";
import { systemClock } from "./clock.ts";
import { configFiles } from "./config-files.ts";
import { createSourceFiles } from "./excerpts/index.ts";
import { systemIdentity } from "./identity.ts";
import {
  failure,
  type Session,
  type SessionProcess,
  serveSession,
  systemTimers,
} from "./mcp-tools/index.ts";
import { createNotifier, type Environment } from "./notifier/index.ts";
import { composePush, sessionProjectRoot } from "./push-composition.ts";

export type SessionProcessOptions = {
  readonly env: Environment;
  /** `process.platform`. */
  readonly platform: string;
  /** The working folder, the project when `CLAUDE_PROJECT_DIR` is not set. */
  readonly cwd: string;
  /** The view build's folder, `view/` beside the bundle (design decision 7). */
  readonly view: string;
  readonly version: string;
  readonly process: SessionProcess;
  /** Writes one diagnostics line to stderr. */
  readonly stderr: (line: string) => void;
  /** The transport to serve on; the process's stdio by default. */
  readonly transport?: Transport;
  /**
   * ask-core's clock, which runs its grace timer and the agent status's background threshold: the
   * system clock by default. Only tests give another; the entry point gives none, so nothing it
   * reads changes the grace period.
   */
  readonly clock?: Clock;
  /** This process's PID, which the session file names (push delivery, design decision 3). */
  readonly pid: number;
  /** The parent's PID: the Claude Code process, which keys the session file (AD-5). */
  readonly parentPid: number;
  /** The user's ID, which names the session folder outside `XDG_RUNTIME_DIR`. */
  readonly uid: number;
  /**
   * Reads the parent's argument vector, for the teammate label: the system's by default. Only tests
   * give another; the entry point gives none.
   */
  readonly parentArgv?: ParentArgv;
  /**
   * ask-core's `SourceFiles` port: the excerpts unit over the session project root by default.
   * Only tests give another; the entry point gives none (excerpts, design decision 5).
   */
  readonly sources?: SourceFiles;
  /**
   * The editor command board-host starts on "Open in editor": the user file's `editor` by default.
   * Only tests give another; the entry point gives none.
   */
  readonly editorCommand?: BoardHostOptions["editorCommand"];
};

// The user file's argument vector, as the launch takes it: never empty.
const userEditor = (core: AskCore): EditorCommand | undefined => {
  const [program, ...args] = core.editorCommand() ?? [];
  return program === undefined ? undefined : [program, ...args];
};

export const startSessionProcess = (options: SessionProcessOptions): Session => {
  const diagnostics = { write: options.stderr };
  // A failure no caller can take: only its class and code reach stderr (AD-11).
  const reportAs = (what: string) => (error: unknown) => diagnostics.write(failure(what, error));
  let core: AskCore | undefined;
  const coreOf = () => {
    if (core === undefined) throw new Error("ask-core is not built yet");
    return core;
  };
  // The root pointers resolve in: E4's session project root, never the working folder (AD-12).
  const projectRoot = sessionProjectRoot(options.env);
  const push = composePush(options, {
    core: coreOf,
    diagnostics,
    reportAs,
    rule: () => coreOf().askingRule(),
  });
  const host = createBoardHost({
    core: coreOf,
    view: options.view,
    report: reportAs("the board host failed"),
    projectDir: push.projectDir,
    editorCommand: options.editorCommand ?? (() => userEditor(coreOf())),
  });
  core = new AskCore({
    address: host.address,
    showing: createNotifier({
      platform: options.platform,
      env: options.env,
      report: reportAs("opening the board failed"),
    }),
    identity: systemIdentity({
      projectDir: options.env.CLAUDE_PROJECT_DIR || options.cwd,
      env: options.env,
    }),
    randomness: { bytes: (count) => randomBytes(count) },
    report: reportAs("ask-core failed"),
    clock: options.clock ?? systemClock,
    ...push.ports,
    sources: options.sources ?? createSourceFiles({ projectRoot }),
    ...(projectRoot === undefined ? {} : { projectRoot }),
    config: configFiles({ env: options.env }),
  });
  // The first request other than `server/discover` reads the configuration, then starts the local
  // API, whatever the read gives: a file not applied still lets it start, with the defaults.
  const firstRequest = () => {
    coreOf()
      .settings()
      .catch(reportAs("reading the configuration failed"))
      .finally(push.firstRequest);
  };
  return serveSession({
    deps: { core, timers: systemTimers, diagnostics, ...push.deps },
    process: options.process,
    firstRequest,
    beforeExit: async () => {
      await Promise.all([host.close(), push.close()]);
    },
    version: options.version,
    ...(options.transport ? { transport: options.transport } : {}),
  });
};

// The session process as the entry point composes it (design decisions 3 and 9): ask-core, holding
// board-host's address, the notifier's showing, this machine's identity and the system clock,
// served over stdio by mcp-tools, whose shutdown closes the board host. Building it touches
// nothing: the board listener opens at the first ask (AD-2). board-host and mcp-tools each hear
// ask-core's events through its one subscription, the ask lifecycle's included (ask-lifecycle,
// task 5.3).

import { randomBytes } from "node:crypto";
import { AskCore, type Clock } from "@askboard/core";
import type { Transport } from "@modelcontextprotocol/server";
import { createBoardHost } from "./board-host/index.ts";
import { systemClock } from "./clock.ts";
import { systemIdentity } from "./identity.ts";
import {
  failure,
  type Session,
  type SessionProcess,
  serveSession,
  systemTimers,
} from "./mcp-tools/index.ts";
import { createNotifier, type Environment } from "./notifier/index.ts";

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
   * ask-core's clock, which runs its grace timer: the system clock by default. Only tests give
   * another; the entry point gives none, so nothing it reads changes the grace period.
   */
  readonly clock?: Clock;
};

export const startSessionProcess = (options: SessionProcessOptions): Session => {
  const diagnostics = { write: options.stderr };
  // A failure no caller can take: only its class and code reach stderr (AD-11).
  const reportAs = (what: string) => (error: unknown) => diagnostics.write(failure(what, error));
  let core: AskCore | undefined;
  const host = createBoardHost({
    core: () => {
      if (core === undefined) throw new Error("ask-core is not built yet");
      return core;
    },
    view: options.view,
    report: reportAs("the board host failed"),
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
  });
  return serveSession({
    deps: { core, timers: systemTimers, diagnostics },
    process: options.process,
    beforeExit: () => host.close(),
    version: options.version,
    ...(options.transport ? { transport: options.transport } : {}),
  });
};

// The hook mode as a process (design decision 6; AD-19): the runner fed the process's stdin,
// environment and parent PID, its outcome written and flushed, then exit 0 whatever happened, even
// with stdin still open after an input over the limit.

import type { SessionEnvironment } from "@askboard/contract";
import { HOOK_HANDLERS } from "./hooks.ts";
import { type HookHandlers, runHook } from "./runner.ts";

/** A stream the process writes to, with a callback once the text is handed on. */
export type ProcessOutput = {
  write(text: string, done: (error?: Error | null) => void): unknown;
};

/** The parts of Node's `process` the hook and client modes use. */
export type ModeProcess = {
  readonly stdin: AsyncIterable<Uint8Array | string>;
  readonly stdout: ProcessOutput;
  readonly stderr: ProcessOutput;
  readonly env: SessionEnvironment;
  readonly ppid: number;
  readonly getuid?: () => number;
  exit(code?: number): void;
};

/** Writes `text` and resolves once it is handed on, or failed to be. */
export const flushed = (output: ProcessOutput, text: string): Promise<void> =>
  text === ""
    ? Promise.resolve()
    : new Promise((resolve) => {
        output.write(text, () => resolve());
      });

/** The user's ID: NFR-7's platforms all have one. */
export const uidOf = (io: Pick<ModeProcess, "getuid">): number => io.getuid?.() ?? 0;

/** Runs the hook of `event` for this process, by default with the hooks' own, and exits 0. */
export const hookProcess = async (
  event: string | undefined,
  io: ModeProcess,
  handlers: HookHandlers = HOOK_HANDLERS,
): Promise<void> => {
  const outcome = await runHook(event ?? "", {
    stdin: io.stdin,
    env: io.env,
    uid: uidOf(io),
    ppid: io.ppid,
    handlers,
  });
  await flushed(io.stdout, outcome.stdout);
  await flushed(io.stderr, outcome.stderr);
  io.exit(0);
};

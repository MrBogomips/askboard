// Child-process events through Node's EventEmitter type. bench's programs load two versions of
// @types/node (24 from the workspace, 26 through bun-types), whose merged ChildProcess loses its
// listener methods; the value is a real EventEmitter on both runtimes.

import type { ChildProcess } from "node:child_process";
import type { EventEmitter } from "node:events";

export const eventsOf = (child: ChildProcess): EventEmitter => child as unknown as EventEmitter;

/** Resolves the exit code, or null when a signal ended the process. */
export const exitOf = (child: ChildProcess): Promise<number | null> =>
  new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve(child.exitCode);
    else eventsOf(child).once("exit", (code: number | null) => resolve(code));
  });

/** Resolves once the process has started; rejects with the command and the error's code. */
export const spawnedOf = (child: ChildProcess, command: string): Promise<void> =>
  new Promise((resolve, reject) => {
    eventsOf(child).once("spawn", () => resolve());
    eventsOf(child).once("error", (error: NodeJS.ErrnoException) =>
      reject(new Error(`cannot start ${command}: ${error.code ?? error.message}`)),
    );
  });

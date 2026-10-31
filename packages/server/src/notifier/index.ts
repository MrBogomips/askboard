// notifier: whether a board can be shown, and bringing a new board to the user's browser (AD-2,
// AD-18). It imports only ask-core and the contract (AD-1). The opener starts with an argument
// vector, never through a shell (AD-8): the link reaches it as one argument, whatever it holds.

import { spawn as spawnProcess } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { join } from "node:path";
import type { BoardShowing } from "@askboard/core";
import { type Detection, detect, type Environment } from "./detect.ts";

export { type Detection, type DetectionInput, detect, type Environment } from "./detect.ts";

/** The part of a started process the opener uses. */
export type Started = {
  on(event: "error", listener: (error: Error) => void): unknown;
  unref(): unknown;
};

/** `child_process.spawn`, narrowed to what the opener passes. */
export type Spawn = (
  command: string,
  args: readonly string[],
  options: { shell: false; detached: true; stdio: "ignore" },
) => Started;

export type NotifierOptions = {
  /** `process.platform`. */
  readonly platform: string;
  readonly env: Environment;
  /** Where a failed start goes: the opener never throws. */
  readonly report: (error: unknown) => void;
  readonly exists?: (path: string) => boolean;
  readonly onPath?: (command: string) => boolean;
  readonly spawn?: Spawn;
};

/** No opener could start: no board can be shown at the moment of opening. */
export class NoBoardOpenerError extends Error {
  override readonly name = "NoBoardOpenerError";
  readonly code = "NO_BOARD_OPENER";
}

const isExecutableFile = (path: string): boolean => {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/** Whether a command is an executable file in one of `PATH`'s folders. */
export const onPathOf =
  (env: Environment) =>
  (command: string): boolean =>
    (env.PATH ?? "")
      .split(":")
      .some((folder) => folder !== "" && isExecutableFile(join(folder, command)));

const fileExists = (path: string): boolean => {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
};

// Node's `spawn`, narrowed to the opener's use. The assertion is for the test program, which loads
// two versions of Node's types whose merged `ChildProcess` loses its event methods.
const systemSpawn = spawnProcess as unknown as Spawn;

/** The `BoardShowing` port over this machine's environment. */
export const createNotifier = (options: NotifierOptions): BoardShowing => {
  const spawn = options.spawn ?? systemSpawn;
  const detection = (): Detection =>
    detect({
      platform: options.platform,
      env: options.env,
      exists: options.exists ?? fileExists,
      onPath: options.onPath ?? onPathOf(options.env),
    });
  return {
    check: async () => {
      const found = detection();
      return found.showable ? { showable: true } : found;
    },
    open: (link) => {
      try {
        const found = detection();
        if (!found.showable) throw new NoBoardOpenerError(found.detail);
        const started = spawn(found.opener, [link], {
          shell: false,
          detached: true,
          stdio: "ignore",
        });
        started.on("error", (error) => options.report(error));
        started.unref();
      } catch (error) {
        options.report(error);
      }
    },
  };
};

// Whether a command is on `PATH`, for the opener's detection rule and the notification's notifier.

import { accessSync, constants, statSync } from "node:fs";
import { join } from "node:path";
import type { Environment } from "./detect.ts";

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

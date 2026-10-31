// The `Identity` port ask-core declares, over this machine (FR-19): the session project's git user
// name, read by running `git` with an argument vector, never through a shell (AD-8), and the
// operating system's login name.

import { execFile } from "node:child_process";
import { userInfo } from "node:os";
import type { Identity } from "@askboard/core";
import type { Environment } from "./notifier/index.ts";

/** The longest a lookup command may run: an ask waits for it before it is created. */
const COMMAND_TIMEOUT_MS = 2_000;

/**
 * Runs a command and gives its standard output; no value when it ran and exited with a failure,
 * such as `git config` for a key that is not set. A command that cannot start or run rejects.
 */
export type Run = (
  command: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly env: Environment },
) => Promise<string | undefined>;

export const runCommand: Run = (command, args, { cwd, env }) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      [...args],
      { cwd, env, timeout: COMMAND_TIMEOUT_MS, shell: false },
      (error, stdout) => {
        if (error === null) resolve(stdout);
        else if (typeof error.code === "number") resolve(undefined);
        else reject(error);
      },
    );
  });

export type IdentityOptions = {
  /** The session project: `CLAUDE_PROJECT_DIR`, else the working folder. */
  readonly projectDir: string;
  readonly env: Environment;
  readonly run?: Run;
};

export const systemIdentity = ({
  projectDir,
  env,
  run = runCommand,
}: IdentityOptions): Identity => ({
  gitUserName: async () => {
    const name = await run("git", ["config", "--get", "user.name"], { cwd: projectDir, env });
    return name?.trim() || undefined;
  },
  loginName: async () => userInfo().username || undefined,
});

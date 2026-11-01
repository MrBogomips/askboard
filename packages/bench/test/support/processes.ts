// Process checks for tests that must leave no process behind. A machine-wide `pgrep -f` also
// matches the processes of other test runs on the same machine, so every lookup here is scoped to
// the children of one parent: the test process for code it runs in-process, else the command it
// started.

import { afterEach } from "bun:test";
import type { Subprocess } from "bun";

/** Whether the process is still running. */
export const isRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** The children of `parent` whose command line matches `pattern`; BSD and GNU pgrep both have `-P` and `-f`. */
export const childrenOf = (parent: number, pattern: string): number[] => {
  const found = Bun.spawnSync(["pgrep", "-P", String(parent), "-f", pattern]);
  // 0: some matched; 1: none did; anything else is an error, not an empty answer.
  if (found.exitCode !== 0 && found.exitCode !== 1) {
    throw new Error(`pgrep failed with ${found.exitCode}: ${found.stderr.toString().trim()}`);
  }
  return found.stdout.toString().split("\n").filter(Boolean).map(Number);
};

/**
 * Takes this process's children matching `pattern`; the returned function lists the matching
 * children started since and still running, which only the code the test ran can have started.
 */
export const childrenSince = (pattern: string): (() => number[]) => {
  const before = new Set(childrenOf(process.pid, pattern));
  return () => childrenOf(process.pid, pattern).filter((pid) => !before.has(pid));
};

/**
 * Call at a test file's top level; the returned function starts a decoy, a process the test starts
 * itself with the command line the code under test also runs, as another test run on the same
 * machine would. Decoys are killed after each test.
 */
export const useDecoys = (): ((command: string[]) => void) => {
  const started: Subprocess[] = [];
  afterEach(async () => {
    for (const decoy of started.splice(0)) {
      decoy.kill("SIGKILL");
      await decoy.exited;
    }
  });
  return (command) => {
    started.push(Bun.spawn(command, { stdin: "pipe", stdout: "ignore", stderr: "ignore" }));
  };
};

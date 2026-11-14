// A runtime folder per `bun test` worker (e2e-cadence, design decision 5a). The session process
// writes its session file and its socket in the session folder, which is `$XDG_RUNTIME_DIR/askboard`
// when that variable is set and the machine-wide `/tmp/askboard-<uid>` otherwise. Files that run in
// parallel would share the machine-wide one, and so would a developer's own sessions. Each worker
// instead gives the session processes it starts a short folder of its own, as `XDG_RUNTIME_DIR`.

import { afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sessionFolder, socketPathFor, socketPathProblem } from "@askboard/contract";

/** The largest process ID on Linux: the longest session key, so the longest socket name. */
export const LONGEST_SESSION_KEY = 4_194_304;

const PREFIX = "ab-";
// `mkdtemp` appends six random characters.
const SUFFIX_LENGTH = 6;

type Place = { readonly platform?: string; readonly uid?: number };

// The longest socket path a session process could hold in a folder made under `base`; the problem
// with it, if it is too long for the platform.
const problemUnder = (base: string, { platform, uid }: Required<Place>): string | undefined => {
  const worst = join(base, `${PREFIX}${"X".repeat(SUFFIX_LENGTH)}`);
  const folder = sessionFolder({ env: { XDG_RUNTIME_DIR: worst }, uid });
  return socketPathProblem(socketPathFor(folder, LONGEST_SESSION_KEY), platform);
};

/**
 * A new folder `ab-<random>` under `base`, mode 0700 (what `mkdtemp` makes), removed when this
 * process exits. Throws the socket path problem, creating nothing, when the folder's longest socket
 * path would not fit: it never falls back to a shared folder.
 */
export const createRuntimeDir = (base: string, place: Place = {}): string => {
  const checked = {
    platform: place.platform ?? process.platform,
    uid: place.uid ?? process.getuid?.() ?? 0,
  };
  const problem = problemUnder(base, checked);
  if (problem !== undefined)
    throw new Error(`the runtime folder under ${base} is unusable: ${problem}`);
  const folder = mkdtempSync(join(base, PREFIX));
  made.add(folder);
  return folder;
};

// The folders this module instance made, removed when the process, or under `bun test` the file,
// ends. `bun test` runs no `exit` handler (neither in its workers nor serially), so the hook of the
// test runner does the removal there; a plain process gets the `exit` handler.
const made = new Set<string>();
const removeAll = (): void => {
  for (const folder of made) rmSync(folder, { recursive: true, force: true });
  made.clear();
};
process.once("exit", removeAll);
try {
  afterAll(removeAll);
} catch {
  // Not under the test runner: the exit handler covers it.
}

let folder: string | undefined;

/**
 * This worker's runtime folder: made on the first call under the temporary folder, the same after
 * that. Bun reloads the module for each file it isolates, so a worker's successive files each get a
 * folder of their own, and two workers never share one.
 */
export const workerRuntimeDir = (): string => {
  folder ??= createRuntimeDir(tmpdir());
  return folder;
};

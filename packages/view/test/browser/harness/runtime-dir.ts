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
// ends. `bun test` runs no `exit` handler (neither in its workers nor serially), so the hooks of the
// test runner do the removal there; a plain process gets the `exit` handler.
const made = new Set<string>();
// The cached folder of `workerRuntimeDir`: cleared with its removal, so that a later call, or a
// later file of a run that loads this module once (a serial run or `--no-isolate`), makes a new one.
let folder: string | undefined;
const removeAll = (): void => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
  made.clear();
  folder = undefined;
};
process.once("exit", removeAll);
const removeAfterScope = (): void => {
  try {
    afterAll(removeAll);
  } catch {
    // Not under the test runner: the exit handler covers it.
  }
};
removeAfterScope();

/**
 * This worker's runtime folder: made on the first call after the last removal, the same until
 * then, and removed at the end of the scope that made it (the file, or the `describe` block the
 * call ran in; the next call makes another). Each file gets a folder that exists while it runs,
 * whether Bun loads this module once per file (`--parallel`, `--isolate`) or once for all of them
 * (a serial run, `--no-isolate`); two workers never share one.
 */
export const workerRuntimeDir = (): string => {
  if (folder === undefined) {
    folder = createRuntimeDir(tmpdir());
    removeAfterScope();
  }
  return folder;
};

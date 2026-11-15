// A runtime folder for each session process the harness starts (e2e-cadence, design decision 5a).
// The session process writes its session file and its socket in the session folder, which is
// `$XDG_RUNTIME_DIR/askboard` when that variable is set and the machine-wide `/tmp/askboard-<uid>`
// otherwise. Files that run in parallel would share the machine-wide one, and so would a developer's
// own sessions. `isolated()` (session-process.ts) therefore makes a short folder of its own for each
// process, beside its HOME and configuration folder, and the session's cleanup removes it once the
// process has exited. No test scope owns it: a hook that removed it at the end of a test or a
// `beforeAll` would take it from a process that is still running (security review X-2).

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
 * A new folder `ab-<random>` under `base`, mode 0700 (what `mkdtemp` makes), removed by its owner
 * with `removeRuntimeDir`, or when this process exits. Throws the socket path problem, creating nothing, when the folder's longest socket
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

// The folders made and not yet removed: a backstop for a process that ends without removing them
// (the `exit` handler). `bun test` runs no `exit` handler, so under it the owner's `removeRuntimeDir`
// is what removes a folder.
const made = new Set<string>();
/** Removes every folder made and not yet removed: what the `exit` handler runs. */
export const removeAllRuntimeDirs = (): void => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
  made.clear();
};
process.once("exit", removeAllRuntimeDirs);

/** Removes a folder `createRuntimeDir` made, with what is in it; one already gone is no error. */
export const removeRuntimeDir = (folder: string): void => {
  rmSync(folder, { recursive: true, force: true });
  made.delete(folder);
};

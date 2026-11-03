// Finding the session process (design decision 3; AD-5): the session file named by the PID of the
// Claude Code process, parent of the session process and of every hook, in the contract's session
// folder. A file is trusted only in the user's private folder (0700), private itself (0600) and
// owned by the user, since its token and socket decide where a hook's records and decisions go.
// A missing, untrusted, invalid or other-major file is no session: the session process is
// unreachable.

import { lstatSync, readFileSync, type Stats } from "node:fs";
import {
  type SessionEnvironment,
  type SessionFile,
  sessionFilePath,
  sessionFolder,
  socketPathFor,
} from "@askboard/contract";
import { validateSessionFile } from "@askboard/contract/validate";
import { HookFailure } from "./failure.ts";

export type SessionLookup = {
  /** The variables the session folder depends on (`XDG_RUNTIME_DIR`, `TMPDIR`). */
  readonly env: SessionEnvironment;
  readonly uid: number;
  /** The parent's PID: the Claude Code process, which names the session file. */
  readonly ppid: number;
};

const NO_SESSION = "no session file for this Claude Code process";

const statOf = (path: string): Stats | undefined => {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
};

// A folder or file only its owner, this user, can reach; never a link.
const isPrivate = (found: Stats, uid: number, kind: "folder" | "file"): boolean =>
  (kind === "folder" ? found.isDirectory() : found.isFile()) &&
  found.uid === uid &&
  (found.mode & 0o077) === 0;

/** The session file of the parent Claude Code process, read and checked; throws when unreachable. */
export const findSession = ({ env, uid, ppid }: SessionLookup): SessionFile => {
  if (!Number.isSafeInteger(ppid) || ppid < 1) throw new HookFailure(NO_SESSION);
  const folder = sessionFolder({ env, uid });
  const path = sessionFilePath(folder, ppid);
  const file = statOf(path);
  if (file === undefined) throw new HookFailure(NO_SESSION);
  const where = statOf(folder);
  if (where === undefined || !isPrivate(where, uid, "folder") || !isPrivate(file, uid, "file")) {
    throw new HookFailure("the session file or its folder is not private to this user");
  }
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new HookFailure("the file for this Claude Code process is not a session file");
  }
  const checked = validateSessionFile(value);
  if (!checked.ok) {
    if (checked.reason === "version") {
      throw new HookFailure(
        `the session file: ${checked.problems[0]?.message ?? "another format"}`,
      );
    }
    throw new HookFailure("the file for this Claude Code process is not a session file");
  }
  const session = checked.value;
  if (session.key !== ppid || session.apiAddress !== socketPathFor(folder, ppid)) {
    throw new HookFailure("the session file does not match its name");
  }
  return session;
};

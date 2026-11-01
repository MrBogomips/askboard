// Finding the session process (AD-5; mod spec, "Finding the session process", "Trusting the session
// file"; design decision 7, Start): the Claude Code PID, learned once from the parent of a process
// the mod runs, names the session file in the contract's session folder. Like the hooks
// (packages/hooks/src/session.ts), the mod trusts a session file only when it and its folder are
// the user's and private: `$.fs` shows that neither is a link, that each is what it should be and
// that the file is valid and matches its name; owner and mode, which `$.fs` does not show, are
// checked by `find`, which BSD and GNU run alike, so that a folder another user created first
// never feeds the mod a socket or answers (AD-10).

import {
  type SessionFile,
  sessionFilePath,
  sessionFolder,
  socketPathFor,
} from "@askboard/contract";
import type { Location } from "./memory.ts";
import type { FsStat, ModApi } from "./mod-api.ts";
import { checks } from "./validators.ts";

/** Prints the PID of the process that runs it, Claude Code, and the user's uid. */
export const PID_COMMAND: readonly string[] = ["sh", "-c", `printf '%s %s' "$PPID" "$(id -u)"`];

const PID_AND_UID = /^([1-9][0-9]*) (0|[1-9][0-9]*)$/;

/** How long one `find` of the checks may take. */
const CHECK_TIMEOUT_MS = 2_000;

/** `find`'s test of one path: printed when it is of `type`, owned by `uid`, with exactly `mode`. */
export const privateCheck = (
  path: string,
  type: "d" | "f",
  uid: number,
  mode: "700" | "600",
): readonly string[] => [
  "find",
  path,
  "-maxdepth",
  "0",
  "-type",
  type,
  "-user",
  `${uid}`,
  "-perm",
  mode,
];

/** Where this session's file is, or undefined when the PID or the uid cannot be learned. */
export const locate = async ($: ModApi): Promise<Location | undefined> => {
  let printed: string;
  try {
    const ran = await $.process.run(PID_COMMAND);
    if (ran.exitCode !== 0) return undefined;
    printed = ran.stdout.trim();
  } catch {
    return undefined;
  }
  const match = PID_AND_UID.exec(printed);
  if (match === null) return undefined;
  const key = Number(match[1]);
  const uid = Number(match[2]);
  const env = {
    XDG_RUNTIME_DIR: await $.env.get("XDG_RUNTIME_DIR"),
    TMPDIR: await $.env.get("TMPDIR"),
  };
  try {
    const folder = sessionFolder({ env, uid });
    return { key, uid, folder, file: sessionFilePath(folder, key) };
  } catch {
    return undefined;
  }
};

// One `find` of the checks: it passed when it printed the path alone.
const passes = async ($: ModApi, argv: readonly string[], path: string): Promise<boolean> => {
  try {
    const ran = await $.process.run(argv, { timeoutMs: CHECK_TIMEOUT_MS });
    return ran.exitCode === 0 && ran.stdout === `${path}\n`;
  } catch {
    return false;
  }
};

/**
 * Whether the session folder is a folder of the user's with mode 0700 and the session file a plain
 * file of the user's with mode 0600, neither a link; false when a check fails or cannot run.
 */
export const isPrivate = async ($: ModApi, { uid, folder, file }: Location): Promise<boolean> =>
  (await passes($, privateCheck(folder, "d", uid, "700"), folder)) &&
  (await passes($, privateCheck(file, "f", uid, "600"), file));

const statOf = async ($: ModApi, path: string): Promise<FsStat | undefined> => {
  try {
    return await $.fs.stat(path);
  } catch {
    return undefined;
  }
};

/** The session file, read and checked; undefined when there is none the mod can trust. */
export const readSession = async (
  $: ModApi,
  location: Location,
): Promise<SessionFile | undefined> => {
  const folder = await statOf($, location.folder);
  if (folder?.kind !== "dir" || folder.isLink) return undefined;
  const file = await statOf($, location.file);
  if (file?.kind !== "file" || file.isLink) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(await $.fs.read(location.file));
  } catch {
    return undefined;
  }
  if (!checks.sessionFile(value)) return undefined;
  const session = value as SessionFile;
  const matches =
    session.key === location.key &&
    session.apiAddress === socketPathFor(location.folder, location.key);
  return matches ? session : undefined;
};

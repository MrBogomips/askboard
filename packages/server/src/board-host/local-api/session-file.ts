// The session folder and the session file in it (design decision 3; AD-5, AD-22): the folder made
// 0700, owned by the user and not a symlink; the file named by the Claude Code PID, claimed 0600 by
// a temporary file linked to its name, so a reader never sees half of it and two starters cannot
// both hold it; a live owner's file left alone; other sessions' files and sockets pruned once
// their process is gone.

import {
  chmodSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { SessionFile } from "@askboard/contract";

/** Whether a process exists: `kill(pid, 0)` finds it, even one of another user. */
export const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as { code?: unknown }).code === "EPERM";
  }
};

/**
 * Makes the session folder, or checks the one there: a folder of this user, not a symlink, then
 * set to 0700. Returns why it cannot be used, or undefined; a failure to make it throws.
 */
export const prepareFolder = (folder: string, uid: number): string | undefined => {
  try {
    mkdirSync(folder, { mode: 0o700 });
  } catch (error) {
    if ((error as { code?: unknown }).code !== "EEXIST") throw error;
  }
  const found = lstatSync(folder);
  if (found.isSymbolicLink() || !found.isDirectory()) return "the session folder is not a folder";
  if (found.uid !== uid) return "the session folder belongs to another user";
  // Exactly 0700, with no special bit such as a set-group-ID bit inherited from the parent: the mod
  // checks for 0700 exactly.
  if ((found.mode & 0o7777) !== 0o700) chmodSync(folder, 0o700);
  return undefined;
};

const codeOf = (error: unknown): unknown => (error as { code?: unknown }).code;

/**
 * The PID a session file names, or undefined when the file is missing, is not a plain file or holds
 * no session.
 */
export const holderOf = (file: string): number | undefined => {
  try {
    if (!lstatSync(file).isFile()) return undefined;
    const { pid } = JSON.parse(readFileSync(file, "utf8")) as { pid?: unknown };
    return typeof pid === "number" && Number.isSafeInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
};

const SESSION_FILE = /^([1-9][0-9]*)\.json$/;
// A session's socket, or the one a starter listens on before it holds the session file.
const SOCKET = /^([1-9][0-9]*)\.(?:sock|[0-9a-f]{4})$/;
// A claim's temporary file, and a stale file a claim took out of the way, by the claimer's PID.
const TEMPORARY = /^[1-9][0-9]*\.json\.([1-9][0-9]*)\.(?:tmp|old)$/;

/**
 * Removes the folder's files and sockets of sessions whose process is gone, except `key`'s, which
 * the claim settles: a session file with no live process, with its socket; a socket, or a
 * starter's, with no session file whose Claude Code process is gone; a temporary file whose writer
 * is gone.
 */
export const pruneFolder = (folder: string, key: number, alive: (pid: number) => boolean): void => {
  const names = new Set(readdirSync(folder));
  const remove = (name: string) => rmSync(join(folder, name), { force: true });
  for (const name of names) {
    const file = SESSION_FILE.exec(name);
    const socket = SOCKET.exec(name);
    const temporary = TEMPORARY.exec(name);
    if (file !== null && Number(file[1]) !== key) {
      const holder = holderOf(join(folder, name));
      if (holder !== undefined && alive(holder)) continue;
      remove(name);
      remove(`${file[1]}.sock`);
    } else if (socket !== null && Number(socket[1]) !== key) {
      if (!names.has(`${socket[1]}.json`) && !alive(Number(socket[1]))) remove(name);
    } else if (temporary !== null && !alive(Number(temporary[1]))) {
      remove(name);
    }
  }
};

// Links the temporary file to the session file's name: false when the name exists.
const linked = (temporary: string, file: string): boolean => {
  try {
    linkSync(temporary, file);
    return true;
  } catch (error) {
    if (codeOf(error) === "EEXIST") return false;
    throw error;
  }
};

const isLive = (holder: number | undefined, pid: number, alive: (pid: number) => boolean) =>
  holder !== undefined && holder !== pid && alive(holder);

/**
 * Takes a stale file out of the session file's name: renamed to a name of this process, which one
 * starter alone can do, then removed. A file another starter claimed meanwhile, which the rename
 * took in its place, goes back. A folder at the name is not taken: that throws.
 */
const takeStale = (file: string, pid: number, alive: (pid: number) => boolean): void => {
  if (lstatSync(file).isDirectory()) {
    throw Object.assign(new Error("the session file's name holds a folder"), { code: "EISDIR" });
  }
  const taken = `${file}.${pid}.old`;
  renameSync(file, taken);
  try {
    // Another starter's file goes back, unless a third has claimed the name since.
    if (isLive(holderOf(taken), pid, alive)) linked(taken, file);
  } finally {
    rmSync(taken, { force: true });
  }
};

/**
 * Claims the session file (design decision 3, review fix): `session` written 0600 under a temporary
 * name of this process, then linked to the file's name, which fails when the name exists. A name
 * that a live process holds is left alone; one held by a process that is gone, or by nothing
 * readable, is taken out of the way and the claim tried once more. True when this process holds
 * the file, false when another one does.
 */
export const claimSessionFile = (
  file: string,
  session: SessionFile,
  alive: (pid: number) => boolean,
): boolean => {
  const temporary = `${file}.${session.pid}.tmp`;
  rmSync(temporary, { force: true });
  try {
    // `wx` creates the file and never follows a link planted at its name.
    writeFileSync(temporary, `${JSON.stringify(session)}\n`, { mode: 0o600, flag: "wx" });
    chmodSync(temporary, 0o600);
    if (linked(temporary, file)) return true;
    if (isLive(holderOf(file), session.pid, alive)) return false;
    takeStale(file, session.pid, alive);
    return linked(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
};

/**
 * Removes the session file, and its socket when given, while the file still names `pid`; true when
 * it did.
 */
export const removeIfHeld = (file: string, pid: number, socket?: string): boolean => {
  if (holderOf(file) !== pid) return false;
  rmSync(file, { force: true });
  if (socket !== undefined) rmSync(socket, { force: true });
  return true;
};

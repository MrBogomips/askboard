// The configuration files' adapter of the session process entry point (settings-languages design
// decisions 3, 4 and 13): file I/O only, for the `Config` port that ask-core declares (task 3.1).
// ask-core parses, validates, merges and applies every rule. It reads only the environment it is
// given, never `process.env`.

import { randomBytes } from "node:crypto";
import {
  chmod,
  type FileHandle,
  mkdir,
  open,
  readFile,
  readlink,
  realpath,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { ASKBOARD_FOLDER } from "@askboard/contract";
import { errorCode } from "./file-errors.ts";
import type { Environment } from "./notifier/index.ts";
import { ensureProjectFolders, type FolderResult } from "./project-folders.ts";

/** The file's name, in the user's `askboard` folder and in the project's `.askboard/`. */
const CONFIG_FILE = "config.json";
const USER_FOLDER = "askboard";

/** The project file, relative to the session project root, as the panel shows it. */
export const PROJECT_CONFIG_FILE = `${ASKBOARD_FOLDER}/${CONFIG_FILE}`;

export type ConfigPaths = {
  readonly user?: string;
  /** The real path of `CLAUDE_PROJECT_DIR`. */
  readonly projectRoot?: string;
  readonly project?: string;
};

const absolute = (value: string | undefined): string | undefined =>
  value !== undefined && isAbsolute(value) ? normalize(value) : undefined;

const mapDefined = (folder: string | undefined, child: string): string | undefined =>
  folder === undefined ? undefined : join(folder, child);

/**
 * The user file, from the environment alone: under `XDG_CONFIG_HOME` when it is absolute, else
 * under `$HOME/.config` when HOME is absolute, else none. A relative `XDG_CONFIG_HOME` is ignored,
 * as the XDG Base Directory specification says.
 */
export const userConfigPath = (env: Environment): string | undefined => {
  const base = absolute(env.XDG_CONFIG_HOME) ?? mapDefined(absolute(env.HOME), ".config");
  return base === undefined ? undefined : join(base, USER_FOLDER, CONFIG_FILE);
};

/**
 * Both files: the user file, and the project file under the real path of `CLAUDE_PROJECT_DIR`,
 * none without it (AD-12). A project folder that cannot be resolved keeps its absolute path, so its
 * file reads as absent and creating its folders fails.
 */
export const resolveConfigPaths = async (env: Environment): Promise<ConfigPaths> => {
  const user = userConfigPath(env);
  const named = env.CLAUDE_PROJECT_DIR;
  if (named === undefined || named === "") return user === undefined ? {} : { user };
  const projectRoot = await realpath(named).catch(() => resolve(named));
  const project = join(projectRoot, PROJECT_CONFIG_FILE);
  return user === undefined ? { projectRoot, project } : { user, projectRoot, project };
};

/** The paths as the panel shows them: the user file with `~` for HOME, the project file relative. */
export const displayPaths = (env: Environment): { user?: string; project?: string } => {
  const user = userConfigPath(env);
  const home = absolute(env.HOME);
  const below = home === undefined || user === undefined ? undefined : relative(home, user);
  const shown =
    below !== undefined && !below.startsWith("..") && !isAbsolute(below) ? `~${sep}${below}` : user;
  const project = env.CLAUDE_PROJECT_DIR ? PROJECT_CONFIG_FILE : undefined;
  return {
    ...(shown === undefined ? {} : { user: shown }),
    ...(project === undefined ? {} : { project }),
  };
};

/** A file as read now: the shape of ask-core's `FileRead` (design decision 3). */
export type FileRead =
  | { readonly kind: "absent" }
  | { readonly kind: "read"; readonly text: string; readonly othersCanWrite: boolean }
  | { readonly kind: "unreadable"; readonly code: string };

/** What the reads take from a file's status. */
export type FileStatus = {
  readonly mode: number;
  readonly uid: number;
  readonly size: number;
  isFile(): boolean;
  isDirectory(): boolean;
};

/** The file-system calls the adapter makes, injected in tests. */
export type ConfigFileSystem = {
  /** Follows symbolic links. */
  readonly stat: (path: string) => Promise<FileStatus>;
  readonly readFile: (path: string) => Promise<string>;
  readonly realpath: (path: string) => Promise<string>;
  readonly readlink: (path: string) => Promise<string>;
  /** Gives the first folder it created, or undefined when the folder was there. */
  readonly mkdir: (
    path: string,
    options: { readonly recursive: true; readonly mode: number },
  ) => Promise<string | undefined>;
  readonly chmod: (path: string, mode: number) => Promise<void>;
  readonly open: (path: string, flags: string, mode?: number) => Promise<FileHandle>;
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly unlink: (path: string) => Promise<void>;
};

/** The calls to replace, and the user's own ID, which `process.getuid` gives by default. */
export type ConfigIo = Partial<ConfigFileSystem> & { readonly uid?: number };

const NODE_FILE_SYSTEM: ConfigFileSystem = {
  stat,
  readFile: (path) => readFile(path, "utf8"),
  realpath,
  readlink,
  mkdir,
  chmod,
  open,
  rename,
  unlink,
};

/** A configuration file is a few keys: anything larger is refused before it is read. */
const MAX_CONFIG_BYTES = 1_048_576;

/** Group and world write. */
const WRITABLE_BY_OTHERS = 0o022;

const fileSystemOf = (io: ConfigIo): ConfigFileSystem => ({ ...NODE_FILE_SYSTEM, ...io });

/**
 * Whether another user can change the file: it or the folder holding it is group- or
 * world-writable, or another user owns either. For a symbolic link, the link's folder counts too.
 * A status that cannot be read counts as writable, so an `editor` from it is ignored (B4).
 */
const writableByOthers = async (
  path: string,
  fs: ConfigFileSystem,
  uid: number,
): Promise<boolean> => {
  try {
    const real = await fs.realpath(path);
    const checked = [...new Set([real, dirname(real), dirname(path)])];
    const statuses = await Promise.all(checked.map((each) => fs.stat(each)));
    return statuses.some(
      (status) => (status.mode & WRITABLE_BY_OTHERS) !== 0 || status.uid !== uid,
    );
  } catch {
    return true;
  }
};

/**
 * Reads one configuration file, following a symbolic link: absent when nothing is there, the text
 * with whether others can write it, or unreadable with the error's code. A directory or any other
 * non-file is unreadable, and is never opened.
 */
export const readConfigFile = async (
  path: string | undefined,
  io: ConfigIo = {},
): Promise<FileRead> => {
  if (path === undefined) return { kind: "absent" };
  const fs = fileSystemOf(io);
  try {
    const status = await fs.stat(path);
    if (status.isDirectory()) return { kind: "unreadable", code: "EISDIR" };
    if (!status.isFile()) return { kind: "unreadable", code: "ENOTFILE" };
    if (status.size > MAX_CONFIG_BYTES) return { kind: "unreadable", code: "EFBIG" };
    const text = await fs.readFile(path);
    const othersCanWrite = await writableByOthers(path, fs, io.uid ?? process.getuid?.() ?? -1);
    return { kind: "read", text, othersCanWrite };
  } catch (error) {
    const code = errorCode(error);
    return code === "ENOENT" ? { kind: "absent" } : { kind: "unreadable", code };
  }
};

/** What `ask-core`'s transform returns: the new text, or why nothing is written (design decision 3). */
export type Replace =
  | { readonly kind: "write"; readonly text: string }
  | { readonly kind: "refuse"; readonly reason: string };

export type WriteResult =
  | { readonly kind: "written"; readonly path: string }
  | { readonly kind: "refused"; readonly reason: string }
  /** `path` is the file that could not be written; none when there is no user file to write. */
  | { readonly kind: "failed"; readonly path?: string; readonly code: string };

const FOLDER_MODE = 0o700;
const FILE_MODE = 0o600;
/** Temporary names tried before giving up: each is random, so one taken was planted. */
const TEMPORARY_TRIES = 4;

const randomName = (): string => randomBytes(8).toString("hex");

/**
 * The file a write replaces: a symbolic link's target, so a dotfiles link survives, also when the
 * target does not exist yet; else the path itself.
 */
const writeTarget = async (path: string, fs: ConfigFileSystem): Promise<string> => {
  try {
    return await fs.realpath(path);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
    const link = await fs.readlink(path).catch(() => undefined);
    return link === undefined ? path : resolve(dirname(path), link);
  }
};

/** Creates a temporary file beside the target with an exclusive create, which follows no link. */
const createTemporary = async (
  target: string,
  mode: number,
  fs: ConfigFileSystem,
  random: () => string,
): Promise<{ path: string; handle: FileHandle }> => {
  let taken: unknown;
  for (let attempt = 0; attempt < TEMPORARY_TRIES; attempt += 1) {
    const path = `${target}.${random()}.tmp`;
    try {
      return { path, handle: await fs.open(path, "wx", mode) };
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
      taken = error;
    }
  }
  throw taken;
};

const syncFolder = async (folder: string, fs: ConfigFileSystem): Promise<void> => {
  const handle = await fs.open(folder, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
};

/**
 * Replaces `target` with `text`: the folder created `0700` when missing, a temporary file in the
 * same folder with the target's mode or `0600`, synced, renamed over the target, then the folder
 * synced. A failure removes the temporary file.
 */
const replaceAtomically = async (
  target: string,
  text: string,
  fs: ConfigFileSystem,
  random: () => string,
): Promise<WriteResult> => {
  const folder = dirname(target);
  let temporary: string | undefined;
  try {
    if ((await fs.mkdir(folder, { recursive: true, mode: FOLDER_MODE })) !== undefined) {
      await fs.chmod(folder, FOLDER_MODE);
    }
    const mode = await fs.stat(target).then(
      (status) => status.mode & 0o777,
      () => FILE_MODE,
    );
    const created = await createTemporary(target, mode, fs, random);
    temporary = created.path;
    try {
      await created.handle.writeFile(text, "utf8");
      await created.handle.chmod(mode);
      await created.handle.sync();
    } finally {
      await created.handle.close();
    }
    await fs.rename(temporary, target);
    temporary = undefined;
    await syncFolder(folder, fs);
    return { kind: "written", path: target };
  } catch (error) {
    if (temporary !== undefined) await fs.unlink(temporary).catch(() => undefined);
    return { kind: "failed", path: target, code: errorCode(error) };
  }
};

/**
 * Replaces the user file through `change`, which gets the file as it is now and gives the new text
 * or a refusal; a refusal writes nothing and creates no folder.
 */
export const replaceUserFile = async (
  path: string | undefined,
  change: (current: FileRead) => Replace,
  io: ConfigIo = {},
  random: () => string = randomName,
): Promise<WriteResult> => {
  if (path === undefined) return { kind: "failed", code: "no-user-file" };
  const fs = fileSystemOf(io);
  let target: string;
  try {
    target = await writeTarget(path, fs);
  } catch (error) {
    return { kind: "failed", path, code: errorCode(error) };
  }
  const replace = change(await readConfigFile(target, io));
  if (replace.kind === "refuse") return { kind: "refused", reason: replace.reason };
  return replaceAtomically(target, replace.text, fs, random);
};

export type ConfigFilesOptions = {
  readonly env: Environment;
  readonly fs?: ConfigIo;
  /** The random part of a temporary file's name. */
  readonly random?: () => string;
};

/**
 * The adapter: both files' reads, the user file's replacement and the project folders, at paths
 * resolved once.
 */
export type ConfigFiles = {
  userFile(): Promise<FileRead>;
  projectFile(): Promise<FileRead>;
  replaceUserFile(change: (current: FileRead) => Replace): Promise<WriteResult>;
  /** Creates `.askboard/` under the session project root, at the first accepted ask. */
  ensureProjectFolders(): Promise<FolderResult>;
  /** As the panel shows them. */
  readonly paths: { readonly user?: string; readonly project?: string };
};

export const configFiles = ({
  env,
  fs = {},
  random = randomName,
}: ConfigFilesOptions): ConfigFiles => {
  let resolved: Promise<ConfigPaths> | undefined;
  const paths = () => {
    resolved ??= resolveConfigPaths(env);
    return resolved;
  };
  return {
    userFile: async () => readConfigFile((await paths()).user, fs),
    projectFile: async () => readConfigFile((await paths()).project, fs),
    replaceUserFile: async (change) => replaceUserFile((await paths()).user, change, fs, random),
    ensureProjectFolders: async () => ensureProjectFolders((await paths()).projectRoot),
    paths: displayPaths(env),
  };
};

// The configuration files' adapter of the session process entry point (settings-languages design
// decisions 3, 4 and 13): file I/O only, for the `Config` port that ask-core declares (task 3.1).
// ask-core parses, validates, merges and applies every rule. It reads only the environment it is
// given, never `process.env`.

import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { ASKBOARD_FOLDER } from "@askboard/contract";
import type { Environment } from "./notifier/index.ts";

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
};

/** The calls to replace, and the user's own ID, which `process.getuid` gives by default. */
export type ConfigIo = Partial<ConfigFileSystem> & { readonly uid?: number };

const NODE_FILE_SYSTEM: ConfigFileSystem = {
  stat,
  readFile: (path) => readFile(path, "utf8"),
  realpath,
};

/** A configuration file is a few keys: anything larger is refused before it is read. */
const MAX_CONFIG_BYTES = 1_048_576;

/** Group and world write. */
const WRITABLE_BY_OTHERS = 0o022;

const codeOf = (error: unknown): string =>
  typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "EIO";

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
    const code = codeOf(error);
    return code === "ENOENT" ? { kind: "absent" } : { kind: "unreadable", code };
  }
};

export type ConfigFilesOptions = { readonly env: Environment; readonly fs?: ConfigIo };

/** The adapter: both files' reads, at paths resolved once, at the first read. */
export type ConfigFiles = {
  userFile(): Promise<FileRead>;
  projectFile(): Promise<FileRead>;
  /** As the panel shows them. */
  readonly paths: { readonly user?: string; readonly project?: string };
};

export const configFiles = ({ env, fs = {} }: ConfigFilesOptions): ConfigFiles => {
  let resolved: Promise<ConfigPaths> | undefined;
  const paths = () => {
    resolved ??= resolveConfigPaths(env);
    return resolved;
  };
  return {
    userFile: async () => readConfigFile((await paths()).user, fs),
    projectFile: async () => readConfigFile((await paths()).project, fs),
    paths: displayPaths(env),
  };
};

// The configuration files' adapter of the session process entry point (settings-languages design
// decisions 3, 4 and 13): file I/O only, for the `Config` port that ask-core declares (task 3.1).
// ask-core parses, validates, merges and applies every rule. It reads only the environment it is
// given, never `process.env`.

import { realpath } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
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

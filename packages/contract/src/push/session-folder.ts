// The session folder and the paths in it (contract spec, Session folder and paths; open question
// 4). Pure functions of the environment, so the session process, the hooks and the mod compute one
// path from one environment, and no unit computes it itself. Plain ECMAScript: the mod has no Node
// API to join paths with.

import { SOCKET_PATH_MAX_BYTES } from "./constants.ts";

/** The variables the folder depends on; any other is ignored. */
export type SessionEnvironment = Readonly<Record<string, string | undefined>>;

// A directory given by an absolute path, without its trailing slashes; undefined otherwise. The
// root keeps nothing, so that joining a name gives one slash.
const absolute = (directory: string | undefined): string | undefined =>
  directory?.startsWith("/") ? directory.replace(/\/+$/, "") : undefined;

const integerAtLeast = (value: number, what: string, least: number): number => {
  if (!Number.isSafeInteger(value) || value < least) {
    throw new RangeError(`${what} must be an integer of at least ${least}, not ${value}`);
  }
  return value;
};

/**
 * `$XDG_RUNTIME_DIR/askboard` when that variable is an absolute path, else
 * `${TMPDIR:-/tmp}/askboard-<uid>`. A relative `TMPDIR` counts as unset too, since each process
 * would resolve it against its own working directory.
 */
export const sessionFolder = ({ env, uid }: { env: SessionEnvironment; uid: number }): string => {
  const user = integerAtLeast(uid, "a uid", 0);
  const runtime = absolute(env.XDG_RUNTIME_DIR);
  if (runtime !== undefined) return `${runtime}/askboard`;
  return `${absolute(env.TMPDIR) ?? "/tmp"}/askboard-${user}`;
};

/** `<folder>/<key>.json`, where the key is the Claude Code process's PID. */
export const sessionFilePath = (folder: string, key: number): string =>
  `${folder}/${integerAtLeast(key, "a session key", 1)}.json`;

/** `<folder>/<key>.sock`, the local API's socket. */
export const socketPathFor = (folder: string, key: number): string =>
  `${folder}/${integerAtLeast(key, "a session key", 1)}.sock`;

// UTF-8 length, by code point; a lone surrogate is written as U+FFFD, three bytes.
const utf8Bytes = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    if (point < 0x80) bytes += 1;
    else if (point < 0x800) bytes += 2;
    else if (point < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

const PLATFORM_NAMES: Readonly<Record<keyof typeof SOCKET_PATH_MAX_BYTES, string>> = {
  darwin: "macOS",
  linux: "Linux",
};

/**
 * Why a socket path cannot be used on `platform` (a `process.platform` value), naming the limit;
 * undefined when it fits. A platform outside NFR-7 gets the smaller limit, macOS's.
 */
export const socketPathProblem = (path: string, platform: string): string | undefined => {
  const known = Object.hasOwn(SOCKET_PATH_MAX_BYTES, platform)
    ? (platform as keyof typeof SOCKET_PATH_MAX_BYTES)
    : "darwin";
  const limit = SOCKET_PATH_MAX_BYTES[known];
  const bytes = utf8Bytes(path);
  if (bytes <= limit) return undefined;
  return `the socket path is ${bytes} bytes, over the limit of ${limit} bytes on ${PLATFORM_NAMES[known]}`;
};

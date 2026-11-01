// The file system calls `excerpts` makes, narrowed to what it uses, so a test can record them, count
// the handles and race a call against a swap on disk.

import { lstat, open, readlink, realpath } from "node:fs/promises";

/** A file's identity, kind and size, as `lstat` and `fstat` give them with `bigint: true`. */
export type SourceStats = {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly size: bigint;
  isFile(): boolean;
  isSymbolicLink(): boolean;
};

/** An open file. */
export type SourceHandle = {
  stat(): Promise<SourceStats>;
  read(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<{ readonly bytesRead: number }>;
  close(): Promise<void>;
  /**
   * The path the system gives for the open file where it gives one, which is Linux, from
   * `/proc/self/fd`; undefined elsewhere.
   */
  path(): Promise<string | undefined>;
};

export type SourceFs = {
  /** A path's real path: no `.`, `..` or symbolic link left in it. */
  realpath(path: string): Promise<string>;
  /** A path's own stats, a final symbolic link not followed. */
  lstat(path: string): Promise<SourceStats>;
  open(path: string, flags: number): Promise<SourceHandle>;
};

// Linux names an open file's current path in `/proc/self/fd`; macOS gives no such check here, its
// open refusing a link at any level instead (`open.ts`).
const openedPath =
  (platform: string) =>
  (fd: number): Promise<string | undefined> =>
    platform === "linux" ? readlink(`/proc/self/fd/${fd}`) : Promise.resolve(undefined);

/** Node's file system on `platform`. Its promise `realpath` is the native call. */
export const nodeSourceFsOn = (platform: string): SourceFs => {
  const pathOf = openedPath(platform);
  return {
    realpath: (path) => realpath(path),
    lstat: (path) => lstat(path, { bigint: true }),
    open: async (path, flags) => {
      const handle = await open(path, flags);
      return {
        stat: () => handle.stat({ bigint: true }),
        read: (buffer, offset, length, position) => handle.read(buffer, offset, length, position),
        close: () => handle.close(),
        path: () => pathOf(handle.fd),
      };
    },
  };
};

/** Node's file system on this machine. */
export const nodeSourceFs: SourceFs = nodeSourceFsOn(process.platform);

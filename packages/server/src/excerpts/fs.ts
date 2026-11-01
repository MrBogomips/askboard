// The file system calls `excerpts` makes, narrowed to what it uses, so a test can record them, count
// the handles and race a call against a swap on disk.

import { lstat, open, realpath } from "node:fs/promises";

/** A file's identity, kind and size, as `lstat` and `fstat` give them with `bigint: true`. */
export type SourceStats = {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly size: bigint;
  isFile(): boolean;
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
};

export type SourceFs = {
  /** A path's real path: no `.`, `..` or symbolic link left in it. */
  realpath(path: string): Promise<string>;
  /** A path's own stats, a final symbolic link not followed. */
  lstat(path: string): Promise<SourceStats>;
  open(path: string, flags: number): Promise<SourceHandle>;
};

/** Node's file system. Its promise `realpath` is the native call, one system call per path. */
export const nodeSourceFs: SourceFs = {
  realpath: (path) => realpath(path),
  lstat: (path) => lstat(path, { bigint: true }),
  open: async (path, flags) => {
    const handle = await open(path, flags);
    return {
      stat: () => handle.stat({ bigint: true }),
      read: (buffer, offset, length, position) => handle.read(buffer, offset, length, position),
      close: () => handle.close(),
    };
  },
};

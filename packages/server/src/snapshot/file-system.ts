// The file-system calls the `snapshot` unit makes, through `node:fs/promises` only, so it runs the
// same on Bun and Node 24 (snapshot design decision 6). Tests replace any of them.

import { link, open, realpath, unlink } from "node:fs/promises";

/** What the unit does with an open file; Node's `FileHandle` is one. */
export type SnapshotFileHandle = {
  writeFile(data: string, encoding: "utf8"): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
};

export type SnapshotFileSystem = {
  /** Only ever `wx`: an exclusive create, which follows no link and fails on an existing name. */
  readonly open: (path: string, flags: "wx") => Promise<SnapshotFileHandle>;
  /** A hard link, which fails with `EEXIST` when `path` exists. */
  readonly link: (existing: string, path: string) => Promise<void>;
  readonly unlink: (path: string) => Promise<void>;
  /** Follows every symbolic link, and fails when the path does not exist. */
  readonly realpath: (path: string) => Promise<string>;
};

const NODE_FILE_SYSTEM: SnapshotFileSystem = { open, link, unlink, realpath };

/** Node's calls, with the given ones in their place. */
export const fileSystemOf = (replaced: Partial<SnapshotFileSystem> = {}): SnapshotFileSystem => ({
  ...NODE_FILE_SYSTEM,
  ...replaced,
});

// Test helpers for `excerpts`: a real temporary folder per test, holding the root `proj` and its
// sibling `proj-old`, whose names share a prefix; a sentinel file outside the root whose access
// time and content show whether anything read it; and a file system that records every call.

import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { nodeSourceFs, type SourceFs } from "../../src/excerpts/fs.ts";

/** What the sentinel holds: a result that contains it read a file outside the root. */
export const SENTINEL_TEXT = "SENTINEL 7f3a: outside the root, never read";

// An access time older than the sentinel's modification time: reading the file moves it, on the
// default mounts of macOS and Linux (`relatime` updates it whenever it is older than the change).
const PAST = new Date(1_000_000_000);

export type Sandbox = {
  /** The temporary folder, as `mkdtemp` gave it (on macOS under the `/var` symlink). */
  readonly base: string;
  /** The root pointers resolve against: `<base>/proj`. */
  readonly root: string;
  /** The root's real path. */
  readonly realRoot: string;
  /** A sibling folder sharing the root's name as a prefix: `<base>/proj-old`. */
  readonly outside: string;
  /** `<base>/proj-old/x.md`, holding `SENTINEL_TEXT`. */
  readonly sentinel: string;
  /** Writes a file under the root, making its folders. */
  write(path: string, content: string | Uint8Array): string;
  /** Makes a symbolic link at `path` under the root, pointing at `target` as written. */
  link(path: string, target: string): string;
  /** Whether nothing has read the sentinel: its access time is unchanged. */
  sentinelUntouched(): boolean;
  remove(): void;
};

export const makeSandbox = (): Sandbox => {
  const base = mkdtempSync(join(tmpdir(), "askboard-excerpts-"));
  const root = join(base, "proj");
  const outside = join(base, "proj-old");
  mkdirSync(root);
  mkdirSync(outside);
  const sentinel = join(outside, "x.md");
  writeFileSync(sentinel, `# Secret\n${SENTINEL_TEXT}\n`);
  utimesSync(sentinel, PAST, new Date());
  const under = (path: string): string => {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    return full;
  };
  return {
    base,
    root,
    realRoot: realpathSync(root),
    outside,
    sentinel,
    write: (path, content) => {
      const full = under(path);
      writeFileSync(full, content);
      return full;
    },
    link: (path, target) => {
      const full = under(path);
      symlinkSync(target, full);
      return full;
    },
    sentinelUntouched: () => statSync(sentinel).atimeMs === PAST.getTime(),
    remove: () => rmSync(base, { recursive: true, force: true }),
  };
};

export type FsCall = { readonly call: string; readonly path?: string };

export type SpyFs = { readonly fs: SourceFs; readonly calls: FsCall[] };

/** The real file system, recording every call. */
export const spyFs = (real: SourceFs = nodeSourceFs): SpyFs => {
  const calls: FsCall[] = [];
  const fs: SourceFs = {
    realpath: (path) => {
      calls.push({ call: "realpath", path });
      return real.realpath(path);
    },
    lstat: (path) => {
      calls.push({ call: "lstat", path });
      return real.lstat(path);
    },
    open: (path, flags) => {
      calls.push({ call: "open", path });
      return real.open(path, flags);
    },
  };
  return { fs, calls };
};

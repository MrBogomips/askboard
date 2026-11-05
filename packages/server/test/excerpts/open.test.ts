import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { constants, renameSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { locate } from "../../src/excerpts/confine.ts";
import {
  nodeSourceFs,
  type SourceFs,
  type SourceHandle,
  type SourceStats,
} from "../../src/excerpts/fs.ts";
import { O_NOFOLLOW_ANY, openFlags, readAtMost, withRegularFile } from "../../src/excerpts/open.ts";
import { isRefused } from "../../src/excerpts/refused.ts";
import { makeSandbox, type Sandbox, SENTINEL_TEXT, type SpyFs, spyFs } from "./helpers.ts";

// Board-host spec, Only regular files are read (excerpts, task 2.2; design decision 3, steps 4 and
// 5): the file is opened without following a final link and without blocking, read only when it is
// a regular file of the device and inode its real path named, and only up to the limit plus one
// byte. Every handle is closed, whatever happens.

const LIMIT = 1_024;
const HANG = 2_000;
const AT_ONCE = 100;

let box: Sandbox;
let spy: SpyFs;

beforeEach(() => {
  box = makeSandbox();
  spy = spyFs();
});

afterEach(() => {
  const untouched = box.sentinelUntouched();
  const openHandles = spy.openHandles();
  box.remove();
  expect(untouched).toBe(true);
  expect(openHandles).toBe(0);
});

const text = (result: unknown): unknown =>
  result instanceof Uint8Array ? new TextDecoder().decode(result) : result;

/** Steps 1 to 5 for one pointer: the bytes of its file, or why not. */
const reach = async (pointer: string, limit = LIMIT, fs: SourceFs = spy.fs) => {
  const located = await locate(fs, box.root, pointer);
  if (isRefused(located)) return located;
  return text(await withRegularFile(fs, located.realPath, (file) => readAtMost(file, limit)));
};

/** Fails the test when the call does not settle within two seconds. */
const withinHang = async <T>(call: Promise<T>): Promise<{ value: T; ms: number }> => {
  const started = performance.now();
  let timer: Timer | undefined;
  const hang = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${HANG} ms`)), HANG);
  });
  try {
    const value = await Promise.race([call, hang]);
    return { value, ms: performance.now() - started };
  } finally {
    clearTimeout(timer);
  }
};

const mkfifo = (path: string): void => {
  expect(Bun.spawnSync(["mkfifo", path]).exitCode).toBe(0);
};

describe("a regular file", () => {
  test("is read whole when it is within the limit", async () => {
    box.write("docs/a.md", "# A\nbody\n");
    expect(await reach("docs/a.md#A")).toBe("# A\nbody\n");
    expect(spy.calls.map((entry) => entry.call)).toEqual([
      "realpath",
      "realpath",
      "lstat",
      "open",
      "fstat",
      "read",
      "read",
      "close",
    ]);
  });

  test("of exactly the limit is read whole, and an empty one gives no bytes", async () => {
    box.write("full.txt", "x".repeat(LIMIT));
    box.write("empty.txt", "");
    expect(await reach("full.txt#L1-L1")).toBe("x".repeat(LIMIT));
    expect(await reach("empty.txt#L1-L1")).toBe("");
  });

  test("over the limit is too-large, read at most up to the limit plus one byte", async () => {
    box.write("big.txt", "x".repeat(10 * LIMIT));
    expect(await reach("big.txt#L1-L1")).toEqual({ refused: "too-large" });
    expect(spy.bytesRead()).toBeLessThanOrEqual(LIMIT + 1);
  });
});

describe("what is not a regular file (board-host spec, Only regular files are read)", () => {
  test("a FIFO no process writes is not-a-file at once", async () => {
    mkfifo(join(box.root, "pipe.md"));
    const { value, ms } = await withinHang(reach("pipe.md#L1-L1"));
    expect(value).toEqual({ refused: "not-a-file" });
    expect(ms).toBeLessThan(AT_ONCE);
  });

  test("a FIFO swapped in just before the open is opened without blocking and refused", async () => {
    const path = box.write("docs/a.md", "# A\n");
    spy = spyFs({
      beforeOpen: (opened) => {
        if (opened !== join(box.realRoot, "docs/a.md")) return;
        rmSync(path);
        mkfifo(path);
      },
    });
    const { value, ms } = await withinHang(reach("docs/a.md#A"));
    // The swapped FIFO takes the freed inode where the file system reuses it (Linux): then it is
    // the same file by identity, and still refused as no regular file. Either way nothing is read.
    expect(["outside-root", "not-a-file"]).toContain((value as { refused: string }).refused);
    expect(ms).toBeLessThan(AT_ONCE);
    expect(spy.calls.map((entry) => entry.call)).toContain("close");
    expect(spy.calls.map((entry) => entry.call)).not.toContain("read");
  });

  test("a directory is not-a-file", async () => {
    box.write("docs/a.md", "# A\n");
    expect(await reach("docs#L1-L1")).toEqual({ refused: "not-a-file" });
  });

  // Bun's realpath on macOS refuses a socket (EOPNOTSUPP), so the walk of walk.ts resolves its path.
  const listening = (path: string) => Bun.listen({ unix: path, socket: { data: () => undefined } });

  test("a Unix socket, in the root or a folder of it, is not-a-file at once", async () => {
    box.write("docs/a.md", "# A\n");
    const listeners = [listening(join(box.root, "s.sock")), listening(join(box.root, "docs/s"))];
    try {
      for (const pointer of ["s.sock#L1-L1", "docs/s#L1-L1"]) {
        const { value, ms } = await withinHang(reach(pointer));
        expect(value).toEqual({ refused: "not-a-file" });
        expect(ms).toBeLessThan(AT_ONCE);
      }
    } finally {
      for (const listener of listeners) listener.stop(true);
    }
  });

  test("a Unix socket outside the root, through a final or a folder link, is outside-root", async () => {
    const outsideSocket = join(box.outside, "s.sock");
    const listener = listening(outsideSocket);
    box.link("docs/s.md", outsideSocket);
    box.link("vendor", box.outside);
    try {
      expect(await reach("docs/s.md#L1-L1")).toEqual({ refused: "outside-root" });
      expect(await reach("vendor/s.sock#L1-L1")).toEqual({ refused: "outside-root" });
    } finally {
      listener.stop(true);
    }
  });

  test("a path the real path call refuses is resolved by the walk, on any platform", async () => {
    // A file system whose realpath refuses the final name as macOS's refuses a socket.
    const unsupported = Object.assign(new Error("EOPNOTSUPP"), { code: "EOPNOTSUPP" });
    const refusing = (names: readonly string[]): SourceFs => ({
      ...nodeSourceFs,
      realpath: (path) =>
        names.some((name) => path.endsWith(name))
          ? Promise.reject(unsupported)
          : nodeSourceFs.realpath(path),
    });
    box.write("docs/a.md", "# A\n");
    box.write("top.md", "# T\n");
    box.link("docs/out.md", box.sentinel);
    box.link("vendor", box.outside);
    const fs = refusing(["/a.md", "/top.md", "/out.md", "/x.md", "/gone.md"]);
    expect(await reach("docs/a.md#A", LIMIT, fs)).toBe("# A\n");
    expect(await reach("top.md#T", LIMIT, fs)).toBe("# T\n");
    expect(await reach("docs/out.md#Secret", LIMIT, fs)).toEqual({ refused: "outside-root" });
    expect(await reach("vendor/x.md#Secret", LIMIT, fs)).toEqual({ refused: "outside-root" });
    expect(await reach("docs/gone.md#A", LIMIT, fs)).toEqual({ refused: "not-found" });
    expect(await reach("nope/gone.md#A", LIMIT, fs)).toEqual({ refused: "not-found" });
  });

  test("/dev/null reached through an in-root link is outside-root", async () => {
    box.link("null.md", "/dev/null");
    expect(await reach("null.md#L1-L1")).toEqual({ refused: "outside-root" });
  });
});

describe("a file swapped between the real path and the open (design decision 3, step 4)", () => {
  const swapAt = (hook: "beforeLstat" | "beforeOpen", swap: (path: string) => void) => {
    const path = box.write("docs/a.md", "# A\n");
    spy = spyFs({
      [hook]: (called: string) => {
        if (called === join(box.realRoot, "docs/a.md")) swap(path);
      },
    });
  };

  test("for a symlink out, before the identity is taken: not-a-file, nothing read", async () => {
    swapAt("beforeLstat", (path) => {
      rmSync(path);
      symlinkSync(box.sentinel, path);
    });
    expect(await reach("docs/a.md#Secret")).toEqual({ refused: "not-a-file" });
    expect(spy.calls.map((entry) => entry.call)).not.toContain("open");
  });

  test("for a symlink out, after the identity is taken: the open refuses it, outside-root", async () => {
    swapAt("beforeOpen", (path) => {
      rmSync(path);
      symlinkSync(box.sentinel, path);
    });
    expect(await reach("docs/a.md#Secret")).toEqual({ refused: "outside-root" });
    expect(spy.bytesRead()).toBe(0);
  });

  test("for another file, after the identity is taken: its device and inode differ, outside-root", async () => {
    box.write("other.md", `${SENTINEL_TEXT}\n`);
    swapAt("beforeOpen", (path) => renameSync(join(box.root, "other.md"), path));
    expect(await reach("docs/a.md#A")).toEqual({ refused: "outside-root" });
    expect(spy.bytesRead()).toBe(0);
  });

  test("for nothing, after the identity is taken: not-found", async () => {
    swapAt("beforeOpen", (path) => rmSync(path));
    expect(await reach("docs/a.md#A")).toEqual({ refused: "not-found" });
  });

  test("for nothing, before the identity is taken: not-found", async () => {
    swapAt("beforeLstat", (path) => rmSync(path));
    expect(await reach("docs/a.md#A")).toEqual({ refused: "not-found" });
  });
});

describe("a folder swapped for a symlink out of the root (security review, finding R2)", () => {
  // `docs` holds a decoy `x.md`; just after the real path is taken, `docs` becomes a symlink to
  // the sibling folder holding the sentinel `x.md`. The real path is still `<root>/docs/x.md`,
  // and a later lookup of it follows the folder link: only an open that refuses a link at any
  // level (macOS) or a check of the open file's own path (Linux) tells.
  const swapFolderAt = (hook: "beforeLstat" | "beforeOpen") => {
    box.write("docs/x.md", "# Secret\ndecoy\n");
    spy = spyFs({
      [hook]: (called: string) => {
        if (called !== join(box.realRoot, "docs/x.md")) return;
        renameSync(join(box.root, "docs"), join(box.root, "docs-kept"));
        symlinkSync(box.outside, join(box.root, "docs"));
      },
    });
  };

  test("swapped before the identity is taken, the open refuses it: outside-root, nothing read", async () => {
    swapFolderAt("beforeLstat");
    expect(await reach("docs/x.md#Secret")).toEqual({ refused: "outside-root" });
    expect(spy.bytesRead()).toBe(0);
  });

  test("swapped after the identity is taken: outside-root, nothing read", async () => {
    swapFolderAt("beforeOpen");
    expect(await reach("docs/x.md#Secret")).toEqual({ refused: "outside-root" });
    expect(spy.bytesRead()).toBe(0);
  });

  test("the open follows no link at any level on macOS, and none at the last elsewhere", () => {
    expect(openFlags("darwin") & O_NOFOLLOW_ANY).toBe(O_NOFOLLOW_ANY);
    expect(openFlags("darwin") & constants.O_NOFOLLOW).toBe(0);
    expect(openFlags("linux") & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW);
    expect(openFlags("linux") & O_NOFOLLOW_ANY).toBe(0);
    for (const platform of ["darwin", "linux"]) {
      expect(openFlags(platform) & constants.O_NONBLOCK).toBe(constants.O_NONBLOCK);
      expect(openFlags(platform) & (constants.O_WRONLY | constants.O_RDWR)).toBe(0);
    }
  });
});

describe("faults past the open", () => {
  const stats = (overrides: Partial<SourceStats> = {}): SourceStats => ({
    dev: 1n,
    ino: 2n,
    size: 4n,
    isFile: () => true,
    isDirectory: () => false,
    isSymbolicLink: () => false,
    ...overrides,
  });

  /** A file system whose one file is `handle`, with `lstat` giving `expected`. */
  const faking = (handle: SourceHandle, expected = stats()) => {
    let closed = 0;
    const fs: SourceFs = {
      realpath: async (path) => path,
      lstat: async () => expected,
      readlink: async (path) => path,
      open: async () => ({
        ...handle,
        close: async () => {
          closed += 1;
        },
      }),
    };
    return { fs, closed: () => closed };
  };

  const handleOf = (overrides: Partial<SourceHandle> = {}): SourceHandle => ({
    stat: async () => stats(),
    read: async () => ({ bytesRead: 0 }),
    close: async () => undefined,
    path: async () => undefined,
    ...overrides,
  });

  test("a handle that is not a regular file, of the same identity, is not-a-file", async () => {
    const { fs, closed } = faking(handleOf({ stat: async () => stats({ isFile: () => false }) }));
    expect(await reach("a.md#A", LIMIT, fs)).toEqual({ refused: "not-a-file" });
    expect(closed()).toBe(1);
  });

  test("a failing fstat and a failing read are not-found, and the handle closes", async () => {
    const failure = Object.assign(new Error("EIO: i/o error"), { code: "EIO" });
    for (const handle of [
      handleOf({ stat: () => Promise.reject(failure) }),
      handleOf({ read: () => Promise.reject(failure) }),
    ]) {
      const { fs, closed } = faking(handle);
      expect(await reach("a.md#A", LIMIT, fs)).toEqual({ refused: "not-found" });
      expect(closed()).toBe(1);
    }
  });

  test("where the system names the open file, it must be the real path (Linux, finding R2)", async () => {
    const elsewhere = faking(handleOf({ path: async () => "/elsewhere/x.md" }));
    expect(await reach("a.md#A", LIMIT, elsewhere.fs)).toEqual({ refused: "outside-root" });
    expect(elsewhere.closed()).toBe(1);
    const unknown = Object.assign(new Error("ENOENT: no /proc"), { code: "ENOENT" });
    const unnamed = faking(handleOf({ path: () => Promise.reject(unknown) }));
    expect(await reach("a.md#A", LIMIT, unnamed.fs)).toEqual({ refused: "outside-root" });
    expect(unnamed.closed()).toBe(1);
    const same = faking(handleOf({ path: async (): Promise<string> => join(box.root, "a.md") }));
    expect(await reach("a.md#A", LIMIT, same.fs)).toBe("");
  });

  test("a fault of AskBoard's own is thrown again, and the handle still closes", async () => {
    const fault = new TypeError("a fault of AskBoard's own");
    const { fs, closed } = faking(handleOf({ read: () => Promise.reject(fault) }));
    await expect(reach("a.md#A", LIMIT, fs)).rejects.toBe(fault);
    expect(closed()).toBe(1);
  });

  test("a file that grows past its stat while read stops at the limit plus one byte", async () => {
    let read = 0;
    const growing = handleOf({
      read: async (buffer, offset, length) => {
        buffer.fill(120, offset, offset + length);
        read += length;
        return { bytesRead: length };
      },
    });
    const { fs } = faking(growing);
    expect(await reach("a.md#A", LIMIT, fs)).toEqual({ refused: "too-large" });
    expect(read).toBe(LIMIT + 1);
  });

  test("a file whose stat gives no size, as on /proc, is read in pieces up to its end", async () => {
    const content = "y".repeat(3 * 64 * 1024 + 7);
    const bytes = new TextEncoder().encode(content);
    const unsized = handleOf({
      stat: async () => stats({ size: 0n }),
      read: async (buffer, offset, length, position) => {
        const piece = bytes.subarray(position, position + length);
        buffer.set(piece, offset);
        return { bytesRead: piece.length };
      },
    });
    const { fs } = faking(unsized);
    expect(await reach("a.md#A", 4 * 64 * 1024, fs)).toBe(content);
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, realpathSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { POINTER_MAX_CHARS } from "@askboard/contract";
import { locate } from "../../src/excerpts/confine.ts";
import { makeSandbox, type Sandbox, SENTINEL_TEXT, spyFs } from "./helpers.ts";

// Board-host spec, Pointers resolve only inside the root (excerpts, task 2.1; design decision 3,
// steps 1 to 3): the grammar first, touching nothing; then the root's real path, then the
// candidate's, which must start with the real root plus `/`, compared exactly. Every case runs on
// a real temporary folder, and no case reads the sentinel outside the root.

let box: Sandbox;

beforeEach(() => {
  box = makeSandbox();
});

afterEach(() => {
  const untouched = box.sentinelUntouched();
  box.remove();
  expect(untouched).toBe(true);
});

const INVALID = [
  "../secret.md#A",
  "docs/../../x.md#A",
  "/etc/passwd#L1-L2",
  "docs//x.md#A",
  "./docs/x.md#A",
  "docs\\x.md#A",
  "",
  "#A",
  "docs/a\u0000.md#A",
  "docs/a\t.md#A",
  "docs/a\u007F.md#A",
  "a.md#",
  `${"x".repeat(POINTER_MAX_CHARS)}#A`,
];

describe("the grammar and the root, before any file system call", () => {
  test.each(INVALID)("%p is invalid-pointer with no call", async (pointer) => {
    const { fs, calls } = spyFs();
    expect(await locate(fs, box.root, pointer)).toEqual({ refused: "invalid-pointer" });
    expect(calls).toEqual([]);
  });

  test("with no project root, every pointer is no-root with no call, an invalid one too", async () => {
    box.write("docs/a.md", "# A\n");
    const { fs, calls } = spyFs();
    for (const pointer of ["docs/a.md#A", "docs/a.md", "../secret.md#A", ""]) {
      expect(await locate(fs, undefined, pointer)).toEqual({ refused: "no-root" });
    }
    expect(calls).toEqual([]);
  });

  test("a root that is not an absolute path is no root at all", async () => {
    const { fs, calls } = spyFs();
    for (const root of ["", "proj", "./proj", "~/proj"]) {
      expect(await locate(fs, root, "docs/a.md#A")).toEqual({ refused: "no-root" });
    }
    expect(calls).toEqual([]);
  });
});

describe("files that are not there", () => {
  test("a missing file, a missing folder and a path through a file are not-found", async () => {
    box.write("docs/a.md", "# A\n");
    const { fs } = spyFs();
    for (const pointer of ["docs/b.md#A", "nope/a.md#A", "docs/a.md/x.md#A"]) {
      expect(await locate(fs, box.root, pointer)).toEqual({ refused: "not-found" });
    }
  });

  test("a dangling link and a link loop are not-found", async () => {
    box.link("dangling.md", "nowhere.md");
    box.link("loop-a.md", "loop-b.md");
    box.link("loop-b.md", "loop-a.md");
    const { fs } = spyFs();
    expect(await locate(fs, box.root, "dangling.md#A")).toEqual({ refused: "not-found" });
    expect(await locate(fs, box.root, "loop-a.md#A")).toEqual({ refused: "not-found" });
  });

  test("an error that is no system error is thrown again, never taken for a missing file", async () => {
    const fault = new TypeError("a fault of AskBoard's own");
    const fs = {
      realpath: () => Promise.reject(fault),
      lstat: () => Promise.reject(fault),
      open: () => Promise.reject(fault),
    };
    await expect(locate(fs, box.root, "docs/a.md#A")).rejects.toBe(fault);
  });

  test("a root that has vanished is not-found, and its real path is taken at each call", async () => {
    box.write("docs/a.md", "# A\n");
    const { fs } = spyFs();
    expect(await locate(fs, box.root, "docs/a.md#A")).toEqual({
      realPath: join(box.realRoot, "docs/a.md"),
      pointer: { path: "docs/a.md", anchor: { kind: "name", text: "A" } },
    });
    renameSync(box.root, join(box.base, "moved"));
    expect(await locate(fs, box.root, "docs/a.md#A")).toEqual({ refused: "not-found" });
  });
});

describe("symlinks (board-host spec, Pointers resolve only inside the root)", () => {
  test("a file symlink out of the root is outside-root", async () => {
    box.link("docs/link.md", box.sentinel);
    const { fs } = spyFs();
    expect(await locate(fs, box.root, "docs/link.md#L1-L3")).toEqual({ refused: "outside-root" });
  });

  test("a folder symlink out of the root is outside-root", async () => {
    box.link("vendor", box.outside);
    const { fs } = spyFs();
    expect(await locate(fs, box.root, "vendor/x.md#L1-L2")).toEqual({ refused: "outside-root" });
  });

  test("a chain whose last link leaves is outside-root", async () => {
    box.link("docs/a.md", "b.md");
    box.link("docs/b.md", "../c.md");
    box.link("c.md", "../proj-old/x.md");
    const { fs } = spyFs();
    expect(await locate(fs, box.root, "docs/a.md#Secret")).toEqual({ refused: "outside-root" });
  });

  test("an absolute symlink to /etc/hosts is outside-root", async () => {
    box.link("hosts.md", "/etc/hosts");
    const { fs } = spyFs();
    expect(await locate(fs, box.root, "hosts.md#L1-L1")).toEqual({ refused: "outside-root" });
  });

  test.skipIf(process.platform !== "linux")(
    "a link through /proc/self/root is outside-root (Linux only: a Linux magic link)",
    async () => {
      box.link("proc.md", "/proc/self/root/etc/hosts");
      box.link("proc-root", "/proc/self/root");
      const { fs } = spyFs();
      expect(await locate(fs, box.root, "proc.md#L1-L1")).toEqual({ refused: "outside-root" });
      expect(await locate(fs, box.root, `proc-root${box.sentinel}#L1-L1`)).toEqual({
        refused: "outside-root",
      });
    },
  );

  test("a sibling folder sharing the root's name as a prefix is outside-root", async () => {
    // The root is <base>/proj and the target <base>/proj-old/x.md: its real path starts with the
    // root's real path, though not with the root's real path plus `/`.
    expect(realpathSync(box.sentinel).startsWith(box.realRoot)).toBe(true);
    box.link("docs/x.md", box.sentinel);
    box.link("docs/rel.md", "../../proj-old/x.md");
    const { fs } = spyFs();
    expect(await locate(fs, box.root, "docs/x.md#Secret")).toEqual({ refused: "outside-root" });
    expect(await locate(fs, box.root, "docs/rel.md#Secret")).toEqual({ refused: "outside-root" });
  });

  test("a link to the root itself is not inside the root", async () => {
    box.link("self", ".");
    const { fs } = spyFs();
    expect(await locate(fs, box.root, "self#L1-L2")).toEqual({ refused: "outside-root" });
  });

  test("a link that stays inside is followed to its real path", async () => {
    box.write("docs/v2.md", "# V2\n");
    box.link("latest.md", "docs/v2.md");
    box.link("sub/back.md", "../docs/v2.md");
    box.link("abs.md", join(box.root, "docs/v2.md"));
    mkdirSync(join(box.root, "real"));
    box.link("folder", "real");
    box.write("real/r.md", "# R\n");
    const { fs } = spyFs();
    for (const pointer of ["latest.md#L1-L2", "sub/back.md#L1-L2", "abs.md#L1-L2"]) {
      expect(await locate(fs, box.root, pointer)).toMatchObject({
        realPath: join(box.realRoot, "docs/v2.md"),
      });
    }
    expect(await locate(fs, box.root, "folder/r.md#R")).toMatchObject({
      realPath: join(box.realRoot, "real/r.md"),
    });
  });

  test("a root that is itself a symlink is made real first", async () => {
    box.write("docs/a.md", "# A\n");
    const linkedRoot = join(box.base, "linked-root");
    symlinkSync(box.root, linkedRoot);
    const { fs, calls } = spyFs();
    expect(await locate(fs, linkedRoot, "docs/a.md#A")).toMatchObject({
      realPath: join(box.realRoot, "docs/a.md"),
    });
    expect(calls[0]).toEqual({ call: "realpath", path: linkedRoot });
    rmSync(linkedRoot);
  });

  test("a symlink out of a root that is itself a symlink is still outside-root", async () => {
    box.link("docs/x.md", box.sentinel);
    const linkedRoot = join(box.base, "linked-root");
    symlinkSync(box.root, linkedRoot);
    const { fs } = spyFs();
    expect(await locate(fs, linkedRoot, "docs/x.md#Secret")).toEqual({ refused: "outside-root" });
  });

  test("nothing of the outside file reaches a result", async () => {
    box.link("docs/link.md", box.sentinel);
    box.link("vendor", box.outside);
    const { fs } = spyFs();
    const results = await Promise.all(
      ["docs/link.md#Secret", "vendor/x.md#Secret"].map((pointer) => locate(fs, box.root, pointer)),
    );
    expect(JSON.stringify(results)).not.toContain(SENTINEL_TEXT);
    expect(JSON.stringify(results)).not.toContain("proj-old");
  });
});

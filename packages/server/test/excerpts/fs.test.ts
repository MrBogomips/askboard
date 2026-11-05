import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { constants } from "node:fs";
import { join } from "node:path";
import { nodeSourceFsOn } from "../../src/excerpts/fs.ts";
import { makeSandbox, type Sandbox, spyFs } from "./helpers.ts";

// The file system calls `excerpts` makes (excerpts, task 2.1): Node's, with stats as big integers
// so a device and an inode compare exactly, whatever their size.

let box: Sandbox;

beforeEach(() => {
  box = makeSandbox();
});

afterEach(() => {
  box.remove();
});

describe("Node's file system, narrowed", () => {
  test("realpath gives the real path; lstat does not follow a final link", async () => {
    const file = box.write("docs/a.md", "# A\n");
    box.link("link.md", file);
    const { fs, calls } = spyFs();
    expect(await fs.realpath(join(box.root, "link.md"))).toBe(join(box.realRoot, "docs/a.md"));
    const own = await fs.lstat(join(box.root, "link.md"));
    const target = await fs.lstat(file);
    expect(own.isFile()).toBe(false);
    expect(target.isFile()).toBe(true);
    expect(typeof target.ino).toBe("bigint");
    expect(own.ino).not.toBe(target.ino);
    expect(calls.map((entry) => entry.call)).toEqual(["realpath", "lstat", "lstat"]);
  });

  test("an open handle gives the file's identity and bytes, and closes", async () => {
    const file = box.write("docs/a.md", "# A\n");
    const { fs } = spyFs();
    const handle = await fs.open(file, constants.O_RDONLY);
    const stats = await handle.stat();
    const expected = await fs.lstat(file);
    expect([stats.dev, stats.ino, stats.size]).toEqual([expected.dev, expected.ino, 4n]);
    const buffer = new Uint8Array(8);
    expect(await handle.read(buffer, 0, 8, 2)).toMatchObject({ bytesRead: 2 });
    expect(new TextDecoder().decode(buffer.subarray(0, 2))).toBe("A\n");
    await handle.close();
    await expect(handle.stat()).rejects.toThrow();
  });

  test("the open file's path: from /proc/self/fd on Linux, none elsewhere", async () => {
    const file = box.write("docs/a.md", "# A\n");
    const onMac = await nodeSourceFsOn("darwin").open(file, constants.O_RDONLY);
    const onLinux = await nodeSourceFsOn("linux").open(file, constants.O_RDONLY);
    try {
      expect(await onMac.path()).toBeUndefined();
      if (process.platform === "linux") {
        expect(await onLinux.path()).toBe(join(box.realRoot, "docs/a.md"));
      } else {
        await expect(onLinux.path()).rejects.toMatchObject({ code: "ENOENT" });
      }
    } finally {
      await onMac.close();
      await onLinux.close();
    }
  });
});

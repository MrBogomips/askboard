import { describe, expect, test } from "bun:test";
import type { SourceFs, SourceStats } from "../../src/excerpts/fs.ts";
import { walkWithin } from "../../src/excerpts/walk.ts";

// The walk that answers when `realpath` cannot (excerpts, design decision 3, step 3; design
// decision 4), over a fake file system: what it resolves, where it stops, and which paths it
// looks at.

type Entry = "dir" | "file" | { readonly link: string } | "unreadable-link";

const kind = (entry: Entry, of: "file" | "dir" | "link"): boolean =>
  of === "link" ? typeof entry === "object" || entry === "unreadable-link" : entry === of;

const fakeFs = (entries: Readonly<Record<string, Entry>>) => {
  const looked: string[] = [];
  const missing = () => Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
  const fs: SourceFs = {
    realpath: missing,
    lstat: (path) => {
      looked.push(path);
      const entry = entries[path];
      if (entry === undefined) return missing();
      const stats: SourceStats = {
        dev: 1n,
        ino: 1n,
        size: 0n,
        isFile: () => kind(entry, "file"),
        isDirectory: () => kind(entry, "dir"),
        isSymbolicLink: () => kind(entry, "link"),
      };
      return Promise.resolve(stats);
    },
    readlink: (path) => {
      looked.push(`readlink ${path}`);
      const entry = entries[path];
      return typeof entry === "object" ? Promise.resolve(entry.link) : missing();
    },
    open: missing,
  };
  return { fs, looked };
};

const ROOT = "/w/proj";

describe("walkWithin", () => {
  test.each([
    ["a file inside", { "/w/proj/a.md": "file" }, "a.md", "/w/proj/a.md"],
    [
      "a link inside, relative",
      { "/w/proj/l": { link: "a.md" }, "/w/proj/a.md": "file" },
      "l",
      "/w/proj/a.md",
    ],
    [
      "out to an ancestor and back in",
      { "/w/proj/l": { link: "../proj/a.md" }, "/w/proj": "dir", "/w/proj/a.md": "file" },
      "l",
      "/w/proj/a.md",
    ],
    ["a missing file inside", {}, "a.md", { refused: "not-found" }],
    ["a missing folder inside", {}, "d/a.md", { refused: "not-found" }],
    ["a path through a file", { "/w/proj/a.md": "file" }, "a.md/x", { refused: "not-found" }],
    [
      "a link to a file with a trailing slash",
      { "/w/proj/l": { link: "a.md/" }, "/w/proj/a.md": "file" },
      "l",
      { refused: "not-found" },
    ],
    [
      "a link that cannot be read",
      { "/w/proj/l": "unreadable-link" },
      "l",
      { refused: "not-found" },
    ],
    [
      "a link to the sibling",
      { "/w/proj/l": { link: "../proj-old/x.md" } },
      "l",
      { refused: "outside-root" },
    ],
    [
      "an absolute link out",
      { "/w/proj/l": { link: "/etc/hosts" } },
      "l",
      { refused: "outside-root" },
    ],
    [
      "a link ending at an ancestor",
      { "/w/proj/up": { link: ".." } },
      "up",
      { refused: "outside-root" },
    ],
    [
      "a link to the root itself",
      { "/w/proj/self": { link: "." } },
      "self",
      { refused: "outside-root" },
    ],
  ] as const)("%s", async (_, entries, path, expected) => {
    const { fs, looked } = fakeFs(entries);
    expect(await walkWithin(fs, ROOT, path)).toEqual(expected);
    // Only the root, what lies under it and its ancestors are ever looked at.
    for (const seen of looked) {
      const at = seen.replace(/^readlink /, "");
      expect(at === "/" || at === "/w" || at === ROOT || at.startsWith(`${ROOT}/`)).toBe(true);
    }
  });

  test("an absolute link back into the root, through its ancestors, resolves", async () => {
    const { fs, looked } = fakeFs({
      "/w/proj/l": { link: "/w/proj/a.md" },
      "/w": "dir",
      "/w/proj": "dir",
      "/w/proj/a.md": "file",
    });
    expect(await walkWithin(fs, ROOT, "l")).toBe("/w/proj/a.md");
    expect(looked).toEqual(["/w/proj/l", "readlink /w/proj/l", "/w", "/w/proj", "/w/proj/a.md"]);
  });

  test("a link loop stops after the systems' limit of links", async () => {
    const { fs, looked } = fakeFs({ "/w/proj/a": { link: "b" }, "/w/proj/b": { link: "a" } });
    expect(await walkWithin(fs, ROOT, "a")).toEqual({ refused: "not-found" });
    expect(looked.filter((seen) => seen.startsWith("readlink")).length).toBe(40);
  });

  test("with the file system's root as the root, every path lies inside", async () => {
    const { fs } = fakeFs({ "/a": "dir", "/a/b.md": "file", "/l": { link: "/a/b.md" } });
    expect(await walkWithin(fs, "/", "a/b.md")).toBe("/a/b.md");
    expect(await walkWithin(fs, "/", "l")).toBe("/a/b.md");
    expect(await walkWithin(fs, "/", "a/../../a/b.md")).toBe("/a/b.md");
  });
});

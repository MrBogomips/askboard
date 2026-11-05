import { afterAll, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SNAPSHOT_RANDOM } from "@askboard/contract";
import { type Randomness, SnapshotWriteError } from "@askboard/core";
import type { SnapshotFileSystem } from "../../src/snapshot/file-system.ts";
import {
  type FolderResult,
  type SnapshotFilesOptions,
  snapshotFiles,
} from "../../src/snapshot/files.ts";

// The Snapshot folder (snapshot spec: The Snapshot folder, No Snapshot without a project root, Never
// outside the project; design decision 6, XC-A1), on real temporary projects. Creating `.askboard/`
// is E8's `ensureProjectFolders`, which group 0 wires: here a fake preparer stands in for it.

const root = realpathSync(mkdtempSync(join(tmpdir(), "askboard-snapshot-folder-")));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const SNAPSHOT_FOLDER = ".askboard/snapshots";
const FILE = { askId: "offer-k3x9", takenAt: "2026-10-31T16:12:05Z", html: "<p>Agent text</p>" };
const NAME = "offer-k3x9-20261031T161205Z-a1b2c3.html";

let count = 0;
const fresh = (what: string): string => {
  count += 1;
  const folder = join(root, `${what}-${count}`);
  mkdirSync(folder);
  return folder;
};

const always: Randomness = {
  bytes: (n) =>
    Uint8Array.from({ length: n }, (_, index) =>
      SNAPSHOT_RANDOM.alphabet.indexOf("a1b2c3"[index % 6] ?? "a"),
    ),
};

/** A preparer that creates `.askboard/snapshots` when missing, as E8's does, and records its calls. */
const creating =
  (calls: string[]) =>
  async (projectRoot: string): Promise<FolderResult> => {
    calls.push(projectRoot);
    mkdirSync(join(projectRoot, SNAPSHOT_FOLDER), { recursive: true });
    return { kind: "ready", created: [] };
  };

type Setup = { lines: string[]; calls: string[]; options: SnapshotFilesOptions };

const setup = (
  projectRoot: string | undefined,
  more: Partial<SnapshotFilesOptions> = {},
): Setup => {
  const lines: string[] = [];
  const calls: string[] = [];
  return {
    lines,
    calls,
    options: {
      projectRoot,
      folder: SNAPSHOT_FOLDER,
      prepareFolders: creating(calls),
      randomness: always,
      report: (line) => lines.push(line),
      ...more,
    },
  };
};

const failure = async (promise: Promise<unknown>): Promise<SnapshotWriteError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SnapshotWriteError) return error;
    throw error;
  }
  throw new Error("the Snapshot was written");
};

/** A file system whose every call is recorded and refused. */
const recording = (calls: string[]): SnapshotFileSystem => {
  const refuse = (name: string) => async (path: string) => {
    calls.push(`${name} ${path}`);
    throw Object.assign(new Error("no call expected"), { code: "EIO" });
  };
  return {
    open: refuse("open"),
    link: refuse("link"),
    unlink: refuse("unlink"),
    realpath: refuse("realpath"),
    readFile: refuse("readFile"),
  };
};

describe("no Snapshot without a project root (XC-A1)", () => {
  test("is refused with no-project-root naming CLAUDE_PROJECT_DIR, before any file-system call", async () => {
    const fsCalls: string[] = [];
    const { options, lines, calls } = setup(undefined, { fs: recording(fsCalls) });
    const error = await failure(snapshotFiles(options).save(FILE));
    expect(error).toMatchObject({
      code: "no-project-root",
      variable: "CLAUDE_PROJECT_DIR",
      folder: undefined,
    });
    expect(fsCalls).toEqual([]);
    expect(calls).toEqual([]);
    expect(lines).toEqual([
      "askboard: no Snapshot without a session project root: CLAUDE_PROJECT_DIR is not set",
    ]);
  });

  test("a preparer that finds no project is the same refusal", async () => {
    const project = fresh("project");
    const { options, lines } = setup(project, {
      prepareFolders: async () => ({ kind: "no-project" }),
    });
    const error = await failure(snapshotFiles(options).save(FILE));
    expect(error.code).toBe("no-project-root");
    expect(lines).toHaveLength(1);
    expect(readdirSync(project)).toEqual([]);
  });
});

describe("the Snapshot folder", () => {
  test("is .askboard/snapshots under the project root, prepared before the write", async () => {
    const project = fresh("project");
    const { options, lines, calls } = setup(project);
    const { path } = await snapshotFiles(options).save(FILE);
    expect(path).toBe(join(project, SNAPSHOT_FOLDER, NAME));
    expect(readFileSync(path, "utf8")).toBe(FILE.html);
    expect(calls).toEqual([project]);
    expect(lines).toEqual([]);
  });

  test("is prepared again for each Snapshot", async () => {
    const project = fresh("project");
    const { options, calls } = setup(project, {
      randomness: { bytes: (n) => crypto.getRandomValues(new Uint8Array(n)) },
    });
    const files = snapshotFiles(options);
    await files.save(FILE);
    await files.save(FILE);
    expect(calls).toEqual([project, project]);
    expect(readdirSync(join(project, SNAPSHOT_FOLDER))).toHaveLength(2);
  });

  test("gives the real path of a project reached through a symbolic link", async () => {
    const project = fresh("project");
    const linked = join(root, `linked-${count}`);
    symlinkSync(project, linked);
    const { options } = setup(linked);
    const { path } = await snapshotFiles(options).save(FILE);
    expect(path).toBe(join(project, SNAPSHOT_FOLDER, NAME));
  });

  test("may be a link to another folder inside the project; the path is the real one", async () => {
    const project = fresh("project");
    mkdirSync(join(project, ".askboard"));
    mkdirSync(join(project, "docs", "snapshots"), { recursive: true });
    symlinkSync(join(project, "docs", "snapshots"), join(project, SNAPSHOT_FOLDER));
    const { options } = setup(project, {
      prepareFolders: async () => ({ kind: "ready", created: [] }),
    });
    const { path } = await snapshotFiles(options).save(FILE);
    expect(path).toBe(join(project, "docs", "snapshots", NAME));
  });

  test("a preparer's failure fails naming the Snapshot folder and its code, writing nothing", async () => {
    const project = fresh("project");
    const { options, lines } = setup(project, {
      prepareFolders: async (projectRoot) => ({
        kind: "failed",
        path: join(projectRoot, ".askboard"),
        code: "EACCES",
      }),
    });
    const error = await failure(snapshotFiles(options).save(FILE));
    expect(error).toMatchObject({ code: "EACCES", folder: join(project, SNAPSHOT_FOLDER) });
    expect(lines).toEqual([
      `askboard: no Snapshot written to ${join(project, SNAPSHOT_FOLDER)}: EACCES`,
    ]);
    expect(readdirSync(project)).toEqual([]);
  });

  test("a preparer that rejects fails naming the Snapshot folder and the rejection's code", async () => {
    const project = fresh("project");
    const { options, lines } = setup(project, {
      prepareFolders: async () => {
        throw Object.assign(new Error("read-only file system"), { code: "EROFS" });
      },
    });
    const error = await failure(snapshotFiles(options).save(FILE));
    expect(error).toMatchObject({ code: "EROFS", folder: join(project, SNAPSHOT_FOLDER) });
    expect(lines).toHaveLength(1);
  });

  test("a folder still missing after preparation fails with ENOENT, naming it", async () => {
    const project = fresh("project");
    const { options } = setup(project, {
      prepareFolders: async () => ({ kind: "ready", created: [] }),
    });
    const error = await failure(snapshotFiles(options).save(FILE));
    expect(error).toMatchObject({ code: "ENOENT", folder: join(project, SNAPSHOT_FOLDER) });
    expect(readdirSync(project)).toEqual([]);
  });

  test("a project root that no longer exists fails with ENOENT", async () => {
    const project = join(root, "gone");
    const { options } = setup(project, {
      prepareFolders: async () => ({ kind: "ready", created: [] }),
    });
    const error = await failure(snapshotFiles(options).save(FILE));
    expect(error).toMatchObject({ code: "ENOENT", folder: join(project, SNAPSHOT_FOLDER) });
  });

  test.skipIf(process.getuid?.() === 0)(
    "a write failure inside the folder is reported once",
    async () => {
      const project = fresh("project");
      mkdirSync(join(project, SNAPSHOT_FOLDER), { recursive: true });
      chmodSync(join(project, SNAPSHOT_FOLDER), 0o500);
      const { options, lines } = setup(project);
      const error = await failure(snapshotFiles(options).save(FILE));
      chmodSync(join(project, SNAPSHOT_FOLDER), 0o700);
      expect(error).toMatchObject({ code: "EACCES", folder: join(project, SNAPSHOT_FOLDER) });
      expect(lines).toHaveLength(1);
    },
  );
});

describe("the folder in effect (settings-languages, design decision 5)", () => {
  test("a folder given as a function is read at each Snapshot, so a change takes effect at once", async () => {
    const project = fresh("project");
    mkdirSync(join(project, "docs/one"), { recursive: true });
    mkdirSync(join(project, "docs/two"), { recursive: true });
    let folder = "docs/one";
    const { options } = setup(project, { folder: () => folder });
    const files = snapshotFiles(options);
    const first = await files.save(FILE);
    folder = "docs/two";
    const second = await files.save(FILE);
    expect(first.path).toBe(join(project, "docs/one", NAME));
    expect(second.path).toBe(join(project, "docs/two", NAME));
  });
});

describe("never outside the project", () => {
  test.each([
    ["snapshots", SNAPSHOT_FOLDER],
    [".askboard", ".askboard"],
  ])(
    "a link from %s to a folder outside the project is refused, writing nothing outside",
    async (_, linked) => {
      const project = fresh("project");
      const outside = fresh("outside");
      mkdirSync(join(outside, "snapshots"));
      if (linked === ".askboard") symlinkSync(outside, join(project, ".askboard"));
      else {
        mkdirSync(join(project, ".askboard"));
        symlinkSync(join(outside, "snapshots"), join(project, SNAPSHOT_FOLDER));
      }
      const { options, lines } = setup(project, {
        prepareFolders: async () => ({ kind: "ready", created: [] }),
      });
      const error = await failure(snapshotFiles(options).save(FILE));
      expect(error).toMatchObject({
        code: "outside-project",
        folder: join(project, SNAPSHOT_FOLDER),
      });
      expect(lines).toEqual([
        `askboard: no Snapshot written to ${join(project, SNAPSHOT_FOLDER)}: outside-project`,
      ]);
      expect(readdirSync(join(outside, "snapshots"))).toEqual([]);
    },
  );

  test("a sibling folder whose name starts with the project's is outside it", async () => {
    const project = fresh("project");
    const sibling = `${project}-sibling`;
    mkdirSync(sibling);
    mkdirSync(join(project, ".askboard"));
    symlinkSync(sibling, join(project, SNAPSHOT_FOLDER));
    const { options } = setup(project, {
      prepareFolders: async () => ({ kind: "ready", created: [] }),
    });
    const error = await failure(snapshotFiles(options).save(FILE));
    expect(error.code).toBe("outside-project");
    expect(readdirSync(sibling)).toEqual([]);
  });

  test.each([
    ["a relative folder that climbs out", "../elsewhere"],
    ["an absolute folder elsewhere", "/"],
  ])("%s is refused", async (_, folder) => {
    const project = fresh("project");
    mkdirSync(join(project, "..", "elsewhere"), { recursive: true });
    const { options } = setup(project, {
      folder,
      prepareFolders: async () => ({ kind: "ready", created: [] }),
    });
    const error = await failure(snapshotFiles(options).save(FILE));
    expect(error.code).toBe("outside-project");
  });

  test("the project root itself is inside the project", async () => {
    const project = fresh("project");
    mkdirSync(join(project, ".askboard"));
    symlinkSync(project, join(project, SNAPSHOT_FOLDER));
    const { options } = setup(project, {
      prepareFolders: async () => ({ kind: "ready", created: [] }),
    });
    const { path } = await snapshotFiles(options).save(FILE);
    expect(path).toBe(join(project, NAME));
    expect(existsSync(path)).toBe(true);
  });
});

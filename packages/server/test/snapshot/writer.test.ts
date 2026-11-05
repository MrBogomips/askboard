import { afterAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { link, open, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  type ManifestChunk,
  SNAPSHOT_NAME_PATTERN,
  type SnapshotData,
  VIEW_MANIFEST_VERSION,
  type ViewManifest,
} from "@askboard/contract";
import {
  fixtureViewFiles,
  fixtureViewManifest,
  lifecycleSnapshotData,
} from "@askboard/contract/fixtures";
import { BoardSetupError, type Randomness, SnapshotWriteError } from "@askboard/core";
import { assemble, type ChunkSources } from "@askboard/view/assemble";
import type { SnapshotFileSystem } from "../../src/snapshot/file-system.ts";
import type { FolderResult } from "../../src/snapshot/files.ts";
import {
  createSnapshotWriter,
  type LoadedViewBuild,
  type SnapshotWriterOptions,
} from "../../src/snapshot/index.ts";

// The Snapshot's file (snapshot spec: One self-contained file; design decision 6, Factory): the
// page `assemble` builds from the Snapshot data, the view build the entry point loaded and the
// notice texts the unit reads from the build's folder, written by the file side. On real temporary
// projects and view build folders, with a fake preparer; the entry point's wiring, with E8's
// `ensureProjectFolders`, is tested in `snapshot-composition.test.ts`.

const root = realpathSync(mkdtempSync(join(tmpdir(), "askboard-snapshot-writer-")));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const SNAPSHOT_FOLDER = ".askboard/snapshots";
const data = lifecycleSnapshotData;
const NAME = new RegExp(SNAPSHOT_NAME_PATTERN);

let count = 0;
const fresh = (what: string): string => {
  count += 1;
  const folder = join(root, `${what}-${count}`);
  mkdirSync(folder);
  return folder;
};

const chunk = (name: string): ManifestChunk => {
  const found = fixtureViewManifest.chunks[name];
  if (found === undefined) throw new Error(`no fixture chunk ${name}`);
  return found;
};

/** The fixture as the view build writes it since manifest 1.1: ext-apps host-only, the shell lazy. */
const hostOnly: ViewManifest = {
  ...fixtureViewManifest,
  version: VIEW_MANIFEST_VERSION,
  chunks: {
    ...fixtureViewManifest.chunks,
    shell: { ...chunk("shell"), needs: ["react"] },
    "ext-apps": { ...chunk("ext-apps"), hostOnly: true },
  },
};

const chunkSources: ChunkSources = Object.fromEntries(
  Object.values(fixtureViewManifest.chunks).flatMap((entry) =>
    [entry.script, ...entry.styles].map((file) => [file.sha256, fixtureViewFiles[file.path] ?? ""]),
  ),
);

/** A view build folder holding the fixture's files, and the build the entry point would load. */
const viewBuildIn = (manifest: ViewManifest = hostOnly): LoadedViewBuild => {
  const folder = fresh("view");
  for (const [path, text] of Object.entries(fixtureViewFiles)) {
    mkdirSync(dirname(join(folder, path)), { recursive: true });
    writeFileSync(join(folder, path), text);
  }
  return { manifest, sources: chunkSources, folder };
};

const random: Randomness = { bytes: (n) => crypto.getRandomValues(new Uint8Array(n)) };

/** A preparer that creates `.askboard/snapshots` when missing, as E8's does, and records its calls. */
const creating =
  (calls: string[]) =>
  async (projectRoot: string): Promise<FolderResult> => {
    calls.push(projectRoot);
    mkdirSync(join(projectRoot, SNAPSHOT_FOLDER), { recursive: true });
    return { kind: "ready", created: [] };
  };

type Setup = {
  readonly lines: string[];
  readonly prepared: string[];
  readonly loads: number[];
  readonly options: SnapshotWriterOptions;
};

const setup = (
  projectRoot: string | undefined,
  build: LoadedViewBuild | (() => Promise<LoadedViewBuild>) = viewBuildIn(),
  more: Partial<SnapshotWriterOptions> = {},
): Setup => {
  const lines: string[] = [];
  const prepared: string[] = [];
  const loads: number[] = [];
  const load = typeof build === "function" ? build : async () => build;
  return {
    lines,
    prepared,
    loads,
    options: {
      projectRoot,
      folder: SNAPSHOT_FOLDER,
      prepareFolders: creating(prepared),
      viewBuild: {
        load: () => {
          loads.push(loads.length + 1);
          return load();
        },
      },
      randomness: random,
      report: (line) => lines.push(line),
      ...more,
    },
  };
};

const rejection = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("the Snapshot was written");
};

/** The page the unit must write: `assemble`'s, with the build's notice texts. */
const expected = (manifest: ViewManifest = hostOnly, snapshot: SnapshotData = data): string =>
  assemble(snapshot, manifest, { chunks: chunkSources, licences: fixtureViewFiles }).srcdoc;

describe("the Snapshot's file (One self-contained file)", () => {
  test("is the page assemble builds from the data, the build's chunks and their notices", async () => {
    const project = fresh("project");
    const { options, lines, prepared } = setup(project);
    const { path } = await createSnapshotWriter(options).write(data);
    expect(dirname(path)).toBe(join(project, SNAPSHOT_FOLDER));
    const name = path.slice(dirname(path).length + 1);
    expect(name).toMatch(NAME);
    expect(name.startsWith(`${data.askId}-`)).toBe(true);
    expect(readFileSync(path, "utf8")).toBe(expected());
    expect(prepared).toEqual([project]);
    expect(lines).toEqual([]);
  });

  test("leaves out what only a host loads: no ext-apps code and none of its notices", async () => {
    const project = fresh("project");
    const { options } = setup(project);
    const { path } = await createSnapshotWriter(options).write(data);
    const page = readFileSync(path, "utf8");
    expect(page).not.toContain(fixtureViewFiles["chunks/ext-apps.js"] ?? "missing");
    expect(page).not.toContain("@modelcontextprotocol/ext-apps");
    expect(page).toContain(JSON.stringify(fixtureViewFiles["licences/react-19.3.1.txt"]));
  });

  test("reads each notice text of the chunks it inlines once, from the build's folder", async () => {
    const project = fresh("project");
    const build = viewBuildIn();
    const read: string[] = [];
    const fs: Partial<SnapshotFileSystem> = {
      readFile: async (path, encoding) => {
        read.push(path);
        return readFileSync(path, encoding);
      },
    };
    const { options } = setup(project, build, { fs });
    await createSnapshotWriter(options).write(data);
    expect(read.sort()).toEqual(
      [
        "licences/radix-ui-1.8.1.txt",
        "licences/react-19.3.1.txt",
        "licences/react-dom-19.3.1.txt",
        "licences/scheduler-0.28.0.txt",
      ].map((path) => join(build.folder, path)),
    );
  });

  test("loads the view build through the port at each Snapshot", async () => {
    const project = fresh("project");
    const { options, loads } = setup(project);
    const writer = createSnapshotWriter(options);
    await writer.write(data);
    await writer.write(data);
    expect(loads).toEqual([1, 2]);
    expect(readdirSync(join(project, SNAPSHOT_FOLDER))).toHaveLength(2);
  });

  test("the same data and build give the same bytes under another name", async () => {
    const project = fresh("project");
    const { options } = setup(project, viewBuildIn(fixtureViewManifest));
    const writer = createSnapshotWriter(options);
    const first = await writer.write(data);
    const second = await writer.write(data);
    expect(second.path).not.toBe(first.path);
    expect(readFileSync(second.path, "utf8")).toBe(readFileSync(first.path, "utf8"));
    expect(readFileSync(first.path, "utf8")).toBe(expected(fixtureViewManifest));
  });
});

describe("no Snapshot without a project root (XC-A1)", () => {
  test("is refused at once: nothing is loaded, read, prepared or written, in the working folder neither", async () => {
    const working = fresh("working");
    const calls: string[] = [];
    const refused = (name: string) => async (path: string) => {
      calls.push(`${name} ${path}`);
      throw Object.assign(new Error("no call expected"), { code: "EIO" });
    };
    const fs: SnapshotFileSystem = {
      open: refused("open"),
      link: refused("link"),
      unlink: refused("unlink"),
      realpath: refused("realpath"),
      readFile: refused("readFile"),
    };
    const { options, lines, prepared, loads } = setup(undefined, viewBuildIn(), { fs });
    const before = process.cwd();
    let error: unknown;
    try {
      process.chdir(working);
      error = await rejection(createSnapshotWriter(options).write(data));
    } finally {
      process.chdir(before);
    }
    expect(error).toBeInstanceOf(SnapshotWriteError);
    expect(error).toMatchObject({
      code: "no-project-root",
      variable: "CLAUDE_PROJECT_DIR",
      folder: undefined,
    });
    expect({ calls, prepared, loads }).toEqual({ calls: [], prepared: [], loads: [] });
    expect(lines).toEqual([
      "askboard: no Snapshot without a session project root: CLAUDE_PROJECT_DIR is not set",
    ]);
    expect(readdirSync(working)).toEqual([]);
  });
});

describe("a view build the Snapshot cannot be built from", () => {
  test("a build that does not load fails with the port's error, preparing and writing nothing", async () => {
    const project = fresh("project");
    const failure = new BoardSetupError("VIEW_MANIFEST_UNREADABLE", "cannot read the manifest");
    const { options, prepared, lines } = setup(project, async () => {
      throw failure;
    });
    expect(await rejection(createSnapshotWriter(options).write(data))).toBe(failure);
    expect(prepared).toEqual([]);
    expect(lines).toEqual([]);
    expect(readdirSync(project)).toEqual([]);
  });

  test("a notice text that cannot be read fails as a setup error naming its path, writing nothing", async () => {
    const project = fresh("project");
    const build = viewBuildIn();
    rmSync(join(build.folder, "licences/radix-ui-1.8.1.txt"));
    const { options, prepared } = setup(project, build);
    const error = await rejection(createSnapshotWriter(options).write(data));
    expect(error).toBeInstanceOf(BoardSetupError);
    expect(error).toMatchObject({
      name: "SnapshotBuildError",
      code: "VIEW_FILE_INVALID",
      message: "cannot read licences/radix-ui-1.8.1.txt",
    });
    expect(prepared).toEqual([]);
    expect(existsSync(join(project, ".askboard"))).toBe(false);
  });
});

describe("what .askboard/ holds is never deleted by the unit", () => {
  const KEPT: Readonly<Record<string, string>> = {
    ".askboard/.gitignore": "snapshots/\n",
    ".askboard/media/shot.png": "png",
    ".askboard/snapshots/offer-k3x9-20261031T161205Z-a1b2c3.html": "<p>An earlier Snapshot</p>",
  };
  const full = (code: string) => Object.assign(new Error("refused"), { code });

  test("Snapshots written and failed keep every file there, removing only their own", async () => {
    const project = fresh("project");
    for (const [path, text] of Object.entries(KEPT)) {
      mkdirSync(dirname(join(project, path)), { recursive: true });
      writeFileSync(join(project, path), text);
    }
    // How the next write goes: through `link`, in place, or failing in the partial or final file.
    let mode: "link" | "in-place" | "partial-fails" | "in-place-fails" = "link";
    const unlinked: string[] = [];
    const fs: Partial<SnapshotFileSystem> = {
      unlink: async (path) => {
        unlinked.push(path);
        await unlink(path);
      },
      link: async (existing, path) => {
        if (mode === "in-place" || mode === "in-place-fails") throw full("EXDEV");
        await link(existing, path);
      },
      open: async (path, flags) => {
        const handle = await open(path, flags);
        const partial = path.endsWith(".partial");
        const fails = mode === (partial ? "partial-fails" : "in-place-fails");
        if (!fails) return handle;
        return {
          writeFile: async () => {
            throw full("ENOSPC");
          },
          sync: () => handle.sync(),
          close: () => handle.close(),
        };
      },
    };
    const { options } = setup(project, viewBuildIn(), { fs });
    const writer = createSnapshotWriter(options);
    const outcomes: string[] = [];
    for (const next of ["link", "in-place", "partial-fails", "in-place-fails"] as const) {
      mode = next;
      outcomes.push(
        await writer.write(data).then(
          () => "saved",
          (error: SnapshotWriteError) => error.code,
        ),
      );
    }
    expect(outcomes).toEqual(["saved", "saved", "ENOSPC", "ENOSPC"]);
    for (const [path, text] of Object.entries(KEPT)) {
      expect(readFileSync(join(project, path), "utf8")).toBe(text);
    }
    const own = (path: string) => {
      const name = path.slice(join(project, SNAPSHOT_FOLDER).length + 1);
      const final = name.replace(/^\.(.*)\.partial$/, "$1");
      return final.startsWith(`${data.askId}-`) && NAME.test(final);
    };
    expect(unlinked.length).toBeGreaterThan(0);
    expect(unlinked.filter((path) => !own(path))).toEqual([]);
    expect(readdirSync(join(project, SNAPSHOT_FOLDER))).toHaveLength(3);
  });

  test("the unit's only removal is `unlink`, and only its file system calls it", () => {
    const folder = join(import.meta.dir, "..", "..", "src", "snapshot");
    const sources = readdirSync(folder).map((name) => ({
      name,
      text: readFileSync(join(folder, name), "utf8"),
    }));
    const importing = sources.filter(({ text }) => /from "node:fs/.test(text));
    expect(importing.map(({ name }) => name)).toEqual(["file-system.ts"]);
    expect(importing[0]?.text).toContain(
      'import { link, open, readFile, realpath, unlink } from "node:fs/promises";',
    );
    for (const { text } of sources) expect(text).not.toMatch(/\b(rm|rmdir|rmSync|rename)\(/);
  });
});

import { afterAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { ASKBOARD_GITIGNORE, type SnapshotData } from "@askboard/contract";
import { fixtureViewFiles, lifecycleSnapshotData } from "@askboard/contract/fixtures";
import { BoardSetupError, SnapshotWriteError } from "@askboard/core";
import { ViewBuildError } from "../src/board-host/view.ts";
import { composeSnapshots, servedViewBuild } from "../src/snapshot-composition.ts";
import { removeViews, writeView } from "./board-host/helpers.ts";

// Snapshots as the session process composes them (snapshot design decision 6; snapshot spec: The
// Snapshot folder, No Snapshot without a project root, Ignored by git by default, Never outside the
// project): the unit's writer over the real path of CLAUDE_PROJECT_DIR, E8's ensureProjectFolders
// as its preparer and the view build board-host serves, on real temporary projects.

const root = realpathSync(mkdtempSync(join(tmpdir(), "askboard-snapshot-composition-")));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  removeViews();
});

const data = lifecycleSnapshotData;
const GITIGNORE = `${ASKBOARD_GITIGNORE.join("\n")}\n`;

let count = 0;
const fresh = (what: string): string => {
  count += 1;
  const folder = join(root, `${what}-${count}`);
  mkdirSync(folder);
  return folder;
};

const git = (project: string, ...args: string[]): string => {
  const run = Bun.spawnSync(["git", "-C", project, ...args], { env: { PATH: process.env.PATH } });
  if (run.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr.toString()}`);
  return run.stdout.toString();
};

/** A fresh git repository with one commit, so that `git status` reads it as a project. */
const repository = (): string => {
  const project = fresh("project");
  git(project, "init", "--quiet");
  writeFileSync(join(project, "README.md"), "A project.\n");
  git(project, "add", "README.md");
  git(
    project,
    "-c",
    "user.name=Paola Greco",
    "-c",
    "user.email=p@example.com",
    "commit",
    "-qm",
    "init",
  );
  return project;
};

/** Untracked files as `git status` lists them, one by one. */
const untracked = (project: string): string[] =>
  git(project, "status", "--porcelain", "--untracked-files=all").split("\n").filter(Boolean);

const composed = (env: Readonly<Record<string, string>>, projectDir = env.CLAUDE_PROJECT_DIR) => {
  const lines: string[] = [];
  const { ports } = composeSnapshots(
    { env, view: writeView(), stderr: (line) => lines.push(line) },
    { projectDir: projectDir ?? root },
  );
  if (ports.snapshots === undefined) throw new Error("no Snapshot ports");
  return { lines, snapshots: ports.snapshots, writer: ports.snapshots.writer };
};

const rejection = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("the Snapshot was written");
};

describe("the Snapshot folder, prepared by E8's project folders", () => {
  test("the first Snapshot of a project creates .askboard/, its folders and the four-line .gitignore", async () => {
    const project = fresh("project");
    const { writer, lines } = composed({ CLAUDE_PROJECT_DIR: project });
    const { path } = await writer.write(data);
    expect(dirname(path)).toBe(join(project, ".askboard", "snapshots"));
    expect(readdirSync(join(project, ".askboard")).sort()).toEqual([
      ".gitignore",
      "media",
      "patches",
      "snapshots",
    ]);
    expect(readFileSync(join(project, ".askboard", ".gitignore"), "utf8")).toBe(GITIGNORE);
    expect(readFileSync(path, "utf8")).toContain(`"askId":"${data.askId}"`);
    expect(lines).toEqual([]);
  });

  test("git status does not show the Snapshot under the .gitignore it created", async () => {
    const project = repository();
    const { writer } = composed({ CLAUDE_PROJECT_DIR: project });
    const { path } = await writer.write(data);
    expect(existsSync(path)).toBe(true);
    expect(untracked(project)).toEqual(["?? .askboard/.gitignore"]);
  });

  test("an existing .gitignore without snapshots/ is unchanged, and git status shows the Snapshot", async () => {
    const project = repository();
    mkdirSync(join(project, ".askboard"));
    writeFileSync(join(project, ".askboard", ".gitignore"), "media/\n");
    const { writer } = composed({ CLAUDE_PROJECT_DIR: project });
    const { path } = await writer.write(data);
    expect(readFileSync(join(project, ".askboard", ".gitignore"), "utf8")).toBe("media/\n");
    expect(untracked(project)).toEqual([
      "?? .askboard/.gitignore",
      `?? .askboard/snapshots/${basename(path)}`,
    ]);
  });

  test("snapshots linked out of the project is refused naming the folder, writing nothing outside", async () => {
    const project = fresh("project");
    const outside = fresh("outside");
    mkdirSync(join(project, ".askboard"));
    symlinkSync(outside, join(project, ".askboard", "snapshots"));
    const { writer, lines } = composed({ CLAUDE_PROJECT_DIR: project });
    const folder = join(project, ".askboard", "snapshots");
    expect(await rejection(writer.write(data))).toMatchObject({ code: "outside-project", folder });
    expect(readdirSync(outside)).toEqual([]);
    expect(lines).toEqual([`askboard: no Snapshot written to ${folder}: outside-project`]);
  });

  test(".askboard linked out of the project is refused by the preparation, naming the Snapshot folder", async () => {
    const project = fresh("project");
    const outside = fresh("outside");
    symlinkSync(outside, join(project, ".askboard"));
    const { writer } = composed({ CLAUDE_PROJECT_DIR: project });
    expect(await rejection(writer.write(data))).toMatchObject({
      code: "ENOTDIR",
      folder: join(project, ".askboard", "snapshots"),
    });
    expect(readdirSync(outside)).toEqual([]);
  });

  test("a subagent's ask whose root is a worktree still writes under the session project root", async () => {
    const project = fresh("project");
    const worktree = fresh("worktree");
    const subagent: SnapshotData = {
      ...data,
      origin: {
        version: data.origin?.version ?? "1.2",
        type: "origin",
        who: { label: "Subagent Explore" },
        project: basename(project),
        directory: worktree,
        branch: "explore-checkout",
        worktree: basename(worktree),
      },
    };
    const { writer } = composed({ CLAUDE_PROJECT_DIR: project });
    const { path } = await writer.write(subagent);
    expect(dirname(path)).toBe(join(project, ".askboard", "snapshots"));
    expect(readdirSync(worktree)).toEqual([]);
  });
});

describe("the two project values (design decision 6)", () => {
  test("the files take the real path of CLAUDE_PROJECT_DIR, the origin row the display folder", async () => {
    const project = fresh("project");
    const linked = join(root, `linked-${count}`);
    symlinkSync(project, linked);
    const { writer, snapshots } = composed({ CLAUDE_PROJECT_DIR: linked });
    expect(snapshots.projectDir).toBe(linked);
    const { path } = await writer.write(data);
    expect(dirname(path)).toBe(join(project, ".askboard", "snapshots"));
  });

  test("without CLAUDE_PROJECT_DIR a Snapshot is refused, and the working folder stays as it is", async () => {
    const working = fresh("working");
    const { writer, snapshots, lines } = composed({}, working);
    expect(snapshots.projectDir).toBe(working);
    const error = await rejection(writer.write(data));
    expect(error).toBeInstanceOf(SnapshotWriteError);
    expect(error).toMatchObject({ code: "no-project-root", variable: "CLAUDE_PROJECT_DIR" });
    expect(readdirSync(working)).toEqual([]);
    expect(lines).toEqual([
      "askboard: no Snapshot without a session project root: CLAUDE_PROJECT_DIR is not set",
    ]);
  });

  test("a relative CLAUDE_PROJECT_DIR is no project root either", async () => {
    const { writer } = composed({ CLAUDE_PROJECT_DIR: "." }, root);
    expect(await rejection(writer.write(data))).toMatchObject({ code: "no-project-root" });
  });
});

describe("the view build board-host serves (open question B12)", () => {
  test("is loaded by board-host's loader at the first Snapshot, and kept", async () => {
    const view = writeView();
    const build = servedViewBuild(view);
    const first = await build.load();
    expect(await build.load()).toBe(first);
    expect(first.folder).toBe(resolve(view));
    const shell = first.manifest.chunks.shell;
    expect(shell?.script.path).toBe("chunks/shell.js");
    expect(first.sources[shell?.script.sha256 ?? ""]).toBe(fixtureViewFiles["chunks/shell.js"]);
  });

  test("a build that does not load fails the Snapshot as a setup error, creating nothing, and is tried again", async () => {
    const project = fresh("project");
    const view = fresh("view");
    const build = servedViewBuild(view);
    const failure = await rejection(build.load());
    expect(failure).toBeInstanceOf(ViewBuildError);
    expect(failure).toBeInstanceOf(BoardSetupError);
    const lines: string[] = [];
    const { ports } = composeSnapshots(
      { env: { CLAUDE_PROJECT_DIR: project }, view, stderr: (line) => lines.push(line) },
      { projectDir: project },
    );
    const writer = ports.snapshots?.writer;
    expect(await rejection(writer?.write(data) ?? Promise.resolve())).toMatchObject({
      code: "VIEW_MANIFEST_UNREADABLE",
    });
    expect(readdirSync(project)).toEqual([]);
    for (const [path, text] of Object.entries(fixtureViewFiles)) {
      mkdirSync(dirname(join(view, path)), { recursive: true });
      writeFileSync(join(view, path), text);
    }
    expect((await build.load()).folder).toBe(view);
    expect(await writer?.write(data)).toMatchObject({ path: expect.any(String) });
    expect(lines).toEqual([]);
  });
});

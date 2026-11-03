import { afterAll, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  lstatSync,
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
import { join } from "node:path";
import { ensureProjectFolders } from "../src/project-folders.ts";

// The project folders at a session's first ask (settings-languages design decision 13, open
// question A4; core spec, "The project folders at the first ask"), on real temporary folders.

const root = realpathSync(mkdtempSync(join(tmpdir(), "askboard-project-folders-")));
afterAll(() => {
  for (const name of readdirSync(root)) chmodSync(join(root, name), 0o700);
  rmSync(root, { recursive: true, force: true });
});

let count = 0;
const freshProject = (): string => {
  count += 1;
  const project = join(root, `project-${count}`);
  mkdirSync(project, { mode: 0o700 });
  return project;
};

const GITIGNORE = "snapshots/\nmedia/\npatches/\nbench/\n";
const asRoot = process.getuid?.() === 0;

describe("the project folders", () => {
  test("a fresh project gets .askboard with its three folders and the four-line .gitignore", async () => {
    const project = freshProject();
    expect(await ensureProjectFolders(project)).toEqual({
      kind: "ready",
      created: [
        ".askboard",
        ".askboard/snapshots",
        ".askboard/media",
        ".askboard/patches",
        ".askboard/.gitignore",
      ],
    });
    expect(readdirSync(join(project, ".askboard")).sort()).toEqual([
      ".gitignore",
      "media",
      "patches",
      "snapshots",
    ]);
    expect(readFileSync(join(project, ".askboard/.gitignore"), "utf8")).toBe(GITIGNORE);
    expect(existsSync(join(project, ".askboard/bench"))).toBe(false);
  });

  test.each([
    ["one without snapshots/", "media/\n"],
    ["an empty one", ""],
    ["one with other lines", "*\n!snapshots/\n"],
  ])("an existing .gitignore is untouched: %s", async (_, text) => {
    const project = freshProject();
    mkdirSync(join(project, ".askboard"));
    writeFileSync(join(project, ".askboard/.gitignore"), text);
    const result = await ensureProjectFolders(project);
    expect(result).toEqual({
      kind: "ready",
      created: [".askboard/snapshots", ".askboard/media", ".askboard/patches"],
    });
    expect(readFileSync(join(project, ".askboard/.gitignore"), "utf8")).toBe(text);
  });

  test("existing folders and what they hold are kept, and a second call creates nothing", async () => {
    const project = freshProject();
    mkdirSync(join(project, ".askboard/media"), { recursive: true });
    writeFileSync(join(project, ".askboard/media/shot.png"), "png");
    await ensureProjectFolders(project);
    expect(readFileSync(join(project, ".askboard/media/shot.png"), "utf8")).toBe("png");
    expect(await ensureProjectFolders(project)).toEqual({ kind: "ready", created: [] });
  });

  test("a .gitignore planted as a symlink is not followed", async () => {
    const project = freshProject();
    const victim = join(root, `victim-${count}.txt`);
    writeFileSync(victim, "untouched");
    mkdirSync(join(project, ".askboard"));
    symlinkSync(victim, join(project, ".askboard/.gitignore"));
    await ensureProjectFolders(project);
    expect(readFileSync(victim, "utf8")).toBe("untouched");
    expect(lstatSync(join(project, ".askboard/.gitignore")).isSymbolicLink()).toBe(true);
  });

  test("a .askboard that is a symlink out of the project is refused, creating nothing", async () => {
    const project = freshProject();
    const outside = join(root, `outside-${count}`);
    mkdirSync(outside);
    symlinkSync(outside, join(project, ".askboard"));
    expect(await ensureProjectFolders(project)).toEqual({
      kind: "failed",
      path: join(project, ".askboard"),
      code: "ENOTDIR",
    });
    expect(readdirSync(outside)).toEqual([]);
  });

  test.skipIf(asRoot)("a read-only project root reports a failure, naming the path", async () => {
    const project = freshProject();
    chmodSync(project, 0o500);
    const result = await ensureProjectFolders(project);
    chmodSync(project, 0o700);
    expect(result).toEqual({ kind: "failed", path: join(project, ".askboard"), code: "EACCES" });
    expect(readdirSync(project)).toEqual([]);
  });

  test.skipIf(asRoot)(
    "a read-only .askboard reports the .gitignore it could not write",
    async () => {
      const project = freshProject();
      for (const folder of ["snapshots", "media", "patches"]) {
        mkdirSync(join(project, ".askboard", folder), { recursive: true });
      }
      chmodSync(join(project, ".askboard"), 0o500);
      const result = await ensureProjectFolders(project);
      chmodSync(join(project, ".askboard"), 0o700);
      expect(result).toEqual({
        kind: "failed",
        path: join(project, ".askboard/.gitignore"),
        code: "EACCES",
      });
    },
  );

  test("a project root that does not exist is not created", async () => {
    const missing = join(root, "missing-project");
    expect(await ensureProjectFolders(missing)).toEqual({
      kind: "failed",
      path: join(missing, ".askboard"),
      code: "ENOENT",
    });
    expect(existsSync(missing)).toBe(false);
  });

  test("nothing is created without a project root", async () => {
    expect(await ensureProjectFolders(undefined)).toEqual({ kind: "no-project" });
  });
});

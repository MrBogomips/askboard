import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sessionFolder, socketPathFor, socketPathProblem } from "@askboard/contract";
import { createRuntimeDir, LONGEST_SESSION_KEY, workerRuntimeDir } from "./runtime-dir.ts";

const MODULE = join(import.meta.dir, "runtime-dir.ts");
const uid = process.getuid?.() ?? 0;

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// The longest socket path a session process can hold in the folder, as the design states it.
const longestSocket = (folder: string) =>
  socketPathFor(sessionFolder({ env: { XDG_RUNTIME_DIR: folder }, uid }), LONGEST_SESSION_KEY);

// A second process that imports the module and prints the folder it was given, then exits.
const child = (env: Record<string, string> = {}) => {
  const script = `import { workerRuntimeDir } from ${JSON.stringify(MODULE)}; console.log(workerRuntimeDir());`;
  const ran = Bun.spawnSync([process.execPath, "-e", script], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: ran.exitCode,
    folder: ran.stdout.toString().trim(),
    stderr: ran.stderr.toString(),
  };
};

describe("workerRuntimeDir", () => {
  test("returns the same folder on every call in one process, under the temporary folder, mode 0700", () => {
    const folder = workerRuntimeDir();
    expect(workerRuntimeDir()).toBe(folder);
    expect(folder.startsWith(`${tmpdir()}/`)).toBe(true);
    expect(statSync(folder).isDirectory()).toBe(true);
    expect(statSync(folder).mode & 0o777).toBe(0o700);
    expect(statSync(folder).uid).toBe(uid);
  });

  test("gives a second process a folder of its own, and removes it when that process exits", () => {
    const here = workerRuntimeDir();
    const first = child();
    const second = child();
    expect([first.code, second.code]).toEqual([0, 0]);
    expect(new Set([here, first.folder, second.folder])).toHaveProperty("size", 3);
    expect(first.folder.startsWith(`${tmpdir()}/`)).toBe(true);
    expect(existsSync(first.folder)).toBe(false);
    expect(existsSync(second.folder)).toBe(false);
    expect(existsSync(here)).toBe(true);
  });

  // `bun test` runs no `exit` handler, neither serially nor in its workers: the folder goes with the file.
  test("under bun test, removes each file's folder when the file ends, serially and in parallel workers", () => {
    const dir = mkdtempSync(join(tmpdir(), "rd-run-"));
    scratch.push(dir);
    const body = `import { test } from "bun:test"; import { workerRuntimeDir } from ${JSON.stringify(MODULE)}; test("x", () => { console.log("FOLDER=" + workerRuntimeDir()); });`;
    for (const name of ["one.test.ts", "two.test.ts"]) writeFileSync(join(dir, name), body);
    for (const mode of [[], ["--parallel=2"]]) {
      const ran = Bun.spawnSync(
        [process.execPath, "test", ...mode, "./one.test.ts", "./two.test.ts"],
        {
          cwd: dir,
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      expect(ran.exitCode).toBe(0);
      const folders = [...`${ran.stdout}${ran.stderr}`.matchAll(/FOLDER=(\S+)/g)].map(
        (m) => m[1] ?? "",
      );
      expect(folders.length).toBeGreaterThanOrEqual(2);
      for (const folder of folders) {
        expect(folder.startsWith(`${tmpdir()}/ab-`)).toBe(true);
        expect(existsSync(folder)).toBe(false);
      }
    }
  });

  test("holds the longest socket path the session folder can have, on macOS and on Linux", () => {
    const path = longestSocket(workerRuntimeDir());
    expect(path).toEndWith(`/askboard/${LONGEST_SESSION_KEY}.sock`);
    expect(socketPathProblem(path, "darwin")).toBeUndefined();
    expect(socketPathProblem(path, "linux")).toBeUndefined();
  });

  test("a process whose temporary folder is too long for a socket fails with the limit's text, using no shared folder", () => {
    const long = join(tmpdir(), "x".repeat(120));
    const ran = child({ TMPDIR: long });
    expect(ran.code).not.toBe(0);
    expect(ran.folder).toBe("");
    expect(ran.stderr).toMatch(/socket path is \d+ bytes, over the limit of \d+ bytes/);
  });
});

describe("createRuntimeDir", () => {
  test("makes a folder named ab-<random> under the base, mode 0700, and none a second time", () => {
    const base = mkdtempSync(join(tmpdir(), "rd-"));
    scratch.push(base);
    const one = createRuntimeDir(base);
    const two = createRuntimeDir(base);
    expect(one).not.toBe(two);
    for (const folder of [one, two]) {
      expect(folder).toMatch(new RegExp(`^${base}/ab-[A-Za-z0-9]{6}$`));
      expect(statSync(folder).mode & 0o777).toBe(0o700);
    }
  });

  test("throws the socket path problem when the base leaves no room, and creates nothing", () => {
    const base = join(tmpdir(), "rd-missing-", "y".repeat(100));
    const worst = join(base, "ab-XXXXXX");
    const expected = socketPathProblem(longestSocket(worst), process.platform);
    expect(expected).toBeString();
    expect(() => createRuntimeDir(base)).toThrow(String(expected));
    expect(existsSync(base)).toBe(false);
  });

  test("applies the limit of the platform it is given: Linux admits what macOS refuses", () => {
    const root = mkdtempSync(join(tmpdir(), "rd-"));
    scratch.push(root);
    // A base whose longest socket path is 105 bytes: over macOS's 103, within Linux's 107.
    const bare = longestSocket(join(root, "ab-XXXXXX")).length;
    const base = join(root, "z".repeat(105 - bare - 1));
    mkdirSync(base);
    expect(longestSocket(join(base, "ab-XXXXXX")).length).toBe(105);
    expect(() => createRuntimeDir(base, { platform: "darwin", uid })).toThrow(
      /over the limit of 103 bytes on macOS/,
    );
    expect(statSync(createRuntimeDir(base, { platform: "linux", uid })).isDirectory()).toBe(true);
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
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
  // Without `--parallel` or `--isolate` Bun loads this module once for every file (review X-1), so the
  // second and third file must still find a folder that exists, and none may outlive the run.
  test.each([
    ["serially", []],
    ["serially with --no-isolate", ["--no-isolate"]],
    ["in parallel workers", ["--parallel=2"]],
  ])(
    "under bun test, gives each of three files a folder that exists while it runs and removes it after, %s",
    (_how, mode) => {
      const dir = mkdtempSync(join(tmpdir(), "rd-run-"));
      const temp = mkdtempSync(join(tmpdir(), "rd-tmp-"));
      scratch.push(dir, temp);
      // A test at the top of the file, then two describe blocks that each start their own "process".
      const body = [
        `import { describe, test } from "bun:test";`,
        `import { existsSync } from "node:fs";`,
        `import { workerRuntimeDir } from ${JSON.stringify(MODULE)};`,
        `const see = (where: string) => { const folder = workerRuntimeDir(); console.log("FOLDER=" + folder + " EXISTS=" + existsSync(folder) + " " + where); };`,
        `test("top", () => see("top"));`,
        `describe("a", () => { test("one", () => see("a")); });`,
        `describe("b", () => { test("two", () => see("b")); });`,
      ].join("\n");
      const names = ["one.test.ts", "two.test.ts", "three.test.ts"];
      for (const name of names) writeFileSync(join(dir, name), body);
      const ran = Bun.spawnSync(
        [process.execPath, "test", ...mode, ...names.map((n) => `./${n}`)],
        {
          cwd: dir,
          env: { ...process.env, TMPDIR: temp },
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      expect(ran.exitCode).toBe(0);
      const seen = [...`${ran.stdout}${ran.stderr}`.matchAll(/FOLDER=(\S+) EXISTS=(true|false)/g)];
      expect(seen).toHaveLength(names.length * 3);
      for (const [, folder, exists] of seen) {
        expect(folder?.startsWith(`${temp}/ab-`)).toBe(true);
        expect(exists).toBe("true");
      }
      expect(readdirSync(temp).filter((entry) => entry.startsWith("ab-"))).toEqual([]);
    },
  );

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

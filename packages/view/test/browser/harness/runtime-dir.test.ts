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
import {
  createRuntimeDir,
  LONGEST_SESSION_KEY,
  removeAllRuntimeDirs,
  removeRuntimeDir,
} from "./runtime-dir.ts";

const MODULE = join(import.meta.dir, "runtime-dir.ts");
const uid = process.getuid?.() ?? 0;

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// The longest socket path a session process can hold in the folder, as the design states it.
const longestSocket = (folder: string) =>
  socketPathFor(sessionFolder({ env: { XDG_RUNTIME_DIR: folder }, uid }), LONGEST_SESSION_KEY);

// A second process that makes a folder with the module and prints it, then exits (the `exit` backstop).
const child = (env: Record<string, string> = {}) => {
  const script = `import { createRuntimeDir } from ${JSON.stringify(MODULE)}; import { tmpdir } from "node:os"; console.log(createRuntimeDir(tmpdir()));`;
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

describe("the lifetime of a runtime folder", () => {
  // Security review X-2: no test scope removes it; the owner does, with `removeRuntimeDir`.
  test("outlives the test, the hooks and the file that made it, until removeRuntimeDir", () => {
    const dir = mkdtempSync(join(tmpdir(), "rd-run-"));
    const temp = mkdtempSync(join(tmpdir(), "rd-tmp-"));
    scratch.push(dir, temp);
    const body = [
      `import { afterAll, afterEach, beforeAll, describe, test } from "bun:test";`,
      `import { existsSync } from "node:fs";`,
      `import { tmpdir } from "node:os";`,
      `import { createRuntimeDir } from ${JSON.stringify(MODULE)};`,
      `let made = "";`,
      `const see = (where: string) => console.log("EXISTS=" + existsSync(made) + " " + where);`,
      `describe("a", () => {`,
      `  beforeAll(() => { made = createRuntimeDir(tmpdir()); });`,
      `  afterEach(() => see("afterEach"));`,
      `  test("one", () => see("test"));`,
      `  afterAll(() => see("afterAll"));`,
      `});`,
      `afterAll(() => console.log("MADE=" + made));`,
    ].join("\n");
    writeFileSync(join(dir, "one.test.ts"), body);
    const ran = Bun.spawnSync([process.execPath, "test", "./one.test.ts"], {
      cwd: dir,
      env: { ...process.env, TMPDIR: temp },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(ran.exitCode).toBe(0);
    const out = `${ran.stdout}${ran.stderr}`;
    expect([...out.matchAll(/EXISTS=(true|false) (\w+)/g)].map((m) => `${m[2]}=${m[1]}`)).toEqual([
      "test=true",
      "afterEach=true",
      "afterAll=true",
    ]);
    const made = /MADE=(\S+)/.exec(out)?.[1] ?? "";
    expect(made).toStartWith(`${temp}/ab-`);
    expect(existsSync(made)).toBe(true);
    removeRuntimeDir(made);
    expect(existsSync(made)).toBe(false);
  });

  test("removeRuntimeDir removes the folder with what is in it, and a folder already gone is no error", () => {
    const base = mkdtempSync(join(tmpdir(), "rd-"));
    scratch.push(base);
    const folder = createRuntimeDir(base);
    mkdirSync(join(folder, "askboard"));
    writeFileSync(join(folder, "askboard", "1.json"), "{}");
    removeRuntimeDir(folder);
    expect(existsSync(folder)).toBe(false);
    expect(() => removeRuntimeDir(folder)).not.toThrow();
  });

  test("removeAllRuntimeDirs, which the exit handler runs, removes every folder not yet removed", () => {
    const base = mkdtempSync(join(tmpdir(), "rd-"));
    scratch.push(base);
    const kept = createRuntimeDir(base);
    const gone = createRuntimeDir(base);
    removeRuntimeDir(gone);
    removeAllRuntimeDirs();
    expect(existsSync(kept)).toBe(false);
    expect(() => removeAllRuntimeDirs()).not.toThrow();
  });

  test("a process that makes one and ends without removing it leaves none (the exit backstop)", () => {
    const first = child();
    expect(first.code).toBe(0);
    expect(first.folder.startsWith(`${tmpdir()}/ab-`)).toBe(true);
    expect(existsSync(first.folder)).toBe(false);
  });

  test("a process whose temporary folder is too long for a socket fails with the limit's text, using no shared folder", () => {
    const long = join(tmpdir(), "x".repeat(120));
    const ran = child({ TMPDIR: long });
    expect(ran.code).not.toBe(0);
    expect(ran.folder).toBe("");
    expect(ran.stderr).toMatch(/socket path is \d+ bytes, over the limit of \d+ bytes/);
  });

  test("holds the longest socket path the session folder can have, on macOS and on Linux", () => {
    const base = mkdtempSync(join(tmpdir(), "rd-"));
    scratch.push(base);
    const path = longestSocket(createRuntimeDir(base));
    expect(path).toEndWith(`/askboard/${LONGEST_SESSION_KEY}.sock`);
    expect(socketPathProblem(path, "linux")).toBeUndefined();
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

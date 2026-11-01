import { afterAll, describe, expect, test } from "bun:test";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ConfigFilesOptions,
  configFiles,
  type FileRead,
  type Replace,
} from "../src/config-files.ts";

// Replacing the user file atomically (settings-languages design decision 3, open question B3), as
// attacks on real temporary folders: modes, symbolic links, a planted temporary name, a read-only
// folder, a refusing transform and a hand edit. Each case has its own HOME; none reads the
// developer's.

const root = realpathSync(mkdtempSync(join(tmpdir(), "askboard-config-write-")));
afterAll(() => {
  for (const name of readdirSync(root)) chmodSync(join(root, name), 0o700);
  rmSync(root, { recursive: true, force: true });
});

let count = 0;
const freshHome = (): string => {
  count += 1;
  const home = join(root, `home-${count}`);
  mkdirSync(home, { mode: 0o700 });
  return home;
};

const userFolder = (home: string) => join(home, ".config", "askboard");
const userFile = (home: string) => join(userFolder(home), "config.json");

/** A user file in a fresh HOME, holding `text`. */
const homeWith = (text: string, mode = 0o600): string => {
  const home = freshHome();
  mkdirSync(userFolder(home), { recursive: true, mode: 0o700 });
  writeFileSync(userFile(home), text, { mode });
  chmodSync(userFile(home), mode);
  return home;
};

const adapter = (home: string, more: Partial<ConfigFilesOptions> = {}) =>
  configFiles({ env: { HOME: home }, ...more });

/** Sets `key` in the file's JSON, keeping every other key: the shape of ask-core's transform. */
const setKey =
  (key: string, value: unknown) =>
  (current: FileRead): Replace => {
    if (current.kind === "unreadable") return { kind: "refuse", reason: "file-not-applied" };
    const fields = current.kind === "read" ? JSON.parse(current.text) : { version: "1.0" };
    return { kind: "write", text: `${JSON.stringify({ ...fields, [key]: value }, null, 2)}\n` };
  };

const modeOf = (path: string) => statSync(path).mode & 0o777;
const temporaries = (folder: string) => readdirSync(folder).filter((name) => name.endsWith(".tmp"));
const asRoot = process.getuid?.() === 0;

describe("a write", () => {
  test("creates the folder 0700 and the file 0600, holding version and the key", async () => {
    const home = freshHome();
    const result = await adapter(home).replaceUserFile(setKey("theme", "dark"));
    expect(result).toEqual({ kind: "written", path: userFile(home) });
    expect(modeOf(userFolder(home))).toBe(0o700);
    expect(modeOf(join(home, ".config"))).toBe(0o700);
    expect(modeOf(userFile(home))).toBe(0o600);
    expect(JSON.parse(readFileSync(userFile(home), "utf8"))).toEqual({
      version: "1.0",
      theme: "dark",
    });
    expect(temporaries(userFolder(home))).toEqual([]);
  });

  test("keeps an existing file's mode", async () => {
    const home = homeWith('{"version": "1.0"}', 0o640);
    await adapter(home).replaceUserFile(setKey("density", "comfortable"));
    expect(modeOf(userFile(home))).toBe(0o640);
    expect(temporaries(userFolder(home))).toEqual([]);
  });

  test("writes a symlinked user file through to its target, and the link survives", async () => {
    const home = freshHome();
    const dotfiles = join(home, "dotfiles");
    mkdirSync(dotfiles, { mode: 0o700 });
    writeFileSync(join(dotfiles, "askboard.json"), '{"version": "1.0"}', { mode: 0o600 });
    mkdirSync(userFolder(home), { recursive: true, mode: 0o700 });
    symlinkSync(join(dotfiles, "askboard.json"), userFile(home));
    const result = await adapter(home).replaceUserFile(setKey("theme", "light"));
    expect(result).toEqual({ kind: "written", path: join(dotfiles, "askboard.json") });
    expect(lstatSync(userFile(home)).isSymbolicLink()).toBe(true);
    expect(JSON.parse(readFileSync(userFile(home), "utf8"))).toMatchObject({ theme: "light" });
    expect(temporaries(dotfiles)).toEqual([]);
    expect(temporaries(userFolder(home))).toEqual([]);
  });

  test("writes through a link to a file not created yet", async () => {
    const home = freshHome();
    const dotfiles = join(home, "dotfiles");
    mkdirSync(dotfiles, { mode: 0o700 });
    mkdirSync(userFolder(home), { recursive: true, mode: 0o700 });
    symlinkSync(join(dotfiles, "askboard.json"), userFile(home));
    await adapter(home).replaceUserFile(setKey("theme", "light"));
    expect(lstatSync(userFile(home)).isSymbolicLink()).toBe(true);
    expect(JSON.parse(readFileSync(join(dotfiles, "askboard.json"), "utf8"))).toEqual({
      version: "1.0",
      theme: "light",
    });
  });

  test("fails on a user file that is a loop of symlinks, writing nothing", async () => {
    const home = freshHome();
    mkdirSync(userFolder(home), { recursive: true, mode: 0o700 });
    symlinkSync(join(userFolder(home), "loop.json"), userFile(home));
    symlinkSync(userFile(home), join(userFolder(home), "loop.json"));
    const result = await adapter(home).replaceUserFile(setKey("theme", "dark"));
    expect(result).toEqual({ kind: "failed", path: userFile(home), code: "ELOOP" });
    expect(readdirSync(userFolder(home)).sort()).toEqual(["config.json", "loop.json"]);
  });

  test("never follows a symlink planted at its temporary name", async () => {
    const home = homeWith('{"version": "1.0"}');
    const victim = join(home, "victim.txt");
    writeFileSync(victim, "untouched");
    symlinkSync(victim, `${userFile(home)}.planted.tmp`);
    const names = ["planted", "fresh"];
    const files = adapter(home, { random: () => names.shift() ?? "spare" });
    const result = await files.replaceUserFile(setKey("theme", "dark"));
    expect(result).toEqual({ kind: "written", path: userFile(home) });
    expect(readFileSync(victim, "utf8")).toBe("untouched");
    expect(JSON.parse(readFileSync(userFile(home), "utf8"))).toMatchObject({ theme: "dark" });
    // Only the planted link is left, which is not the adapter's.
    expect(temporaries(userFolder(home))).toEqual(["config.json.planted.tmp"]);
  });

  test("fails, writing nothing, when every temporary name is taken", async () => {
    const home = homeWith('{"version": "1.0"}');
    const victim = join(home, "victim.txt");
    writeFileSync(victim, "untouched");
    symlinkSync(victim, `${userFile(home)}.planted.tmp`);
    const files = adapter(home, { random: () => "planted" });
    const result = await files.replaceUserFile(setKey("theme", "dark"));
    expect(result).toEqual({ kind: "failed", path: userFile(home), code: "EEXIST" });
    expect(readFileSync(victim, "utf8")).toBe("untouched");
    expect(readFileSync(userFile(home), "utf8")).toBe('{"version": "1.0"}');
  });

  test.skipIf(asRoot)("into a read-only folder fails with the path and the code", async () => {
    const home = homeWith('{"version": "1.0"}');
    chmodSync(userFolder(home), 0o500);
    const result = await adapter(home).replaceUserFile(setKey("theme", "dark"));
    chmodSync(userFolder(home), 0o700);
    expect(result).toEqual({ kind: "failed", path: userFile(home), code: "EACCES" });
    expect(readdirSync(userFolder(home))).toEqual(["config.json"]);
    expect(readFileSync(userFile(home), "utf8")).toBe('{"version": "1.0"}');
  });

  test("that the transform refuses writes nothing, and creates no folder", async () => {
    const home = homeWith('{"version": "1.0"}');
    const refuse = () => ({ kind: "refuse", reason: "set-by-project" }) as const;
    expect(await adapter(home).replaceUserFile(refuse)).toEqual({
      kind: "refused",
      reason: "set-by-project",
    });
    expect(readdirSync(userFolder(home))).toEqual(["config.json"]);
    const empty = freshHome();
    await adapter(empty).replaceUserFile(refuse);
    expect(readdirSync(empty)).toEqual([]);
  });

  test("gives the transform the file as it is now, so a hand edit survives", async () => {
    const home = homeWith('{"version": "1.0", "theme": "dark"}');
    const files = adapter(home);
    expect(await files.userFile()).toMatchObject({ kind: "read" });
    writeFileSync(userFile(home), '{"version": "1.0", "theme": "light", "fontSize": 14}');
    const seen: FileRead[] = [];
    await files.replaceUserFile((current) => {
      seen.push(current);
      return setKey("density", "comfortable")(current);
    });
    expect(seen).toEqual([
      {
        kind: "read",
        text: '{"version": "1.0", "theme": "light", "fontSize": 14}',
        othersCanWrite: false,
      },
    ]);
    expect(JSON.parse(readFileSync(userFile(home), "utf8"))).toEqual({
      version: "1.0",
      theme: "light",
      fontSize: 14,
      density: "comfortable",
    });
  });

  test("gives the transform an unreadable file as such", async () => {
    const home = freshHome();
    mkdirSync(userFile(home), { recursive: true });
    const result = await adapter(home).replaceUserFile(setKey("theme", "dark"));
    expect(result).toEqual({ kind: "refused", reason: "file-not-applied" });
  });

  test("fails with no HOME and no XDG_CONFIG_HOME, never calling the transform", async () => {
    let called = false;
    const files = configFiles({ env: {} });
    const result = await files.replaceUserFile(() => {
      called = true;
      return { kind: "write", text: "{}" };
    });
    expect(result).toEqual({ kind: "failed", code: "no-user-file" });
    expect(called).toBe(false);
  });

  test("that fails at the rename removes its temporary file", async () => {
    const home = homeWith('{"version": "1.0"}');
    const rename = async () => {
      throw Object.assign(new Error("cross-device"), { code: "EXDEV" });
    };
    const result = await adapter(home, { fs: { rename } }).replaceUserFile(setKey("a", 1));
    expect(result).toEqual({ kind: "failed", path: userFile(home), code: "EXDEV" });
    expect(readdirSync(userFolder(home))).toEqual(["config.json"]);
    expect(readFileSync(userFile(home), "utf8")).toBe('{"version": "1.0"}');
  });

  test("that cannot sync its folder after the rename says so", async () => {
    const home = homeWith('{"version": "1.0"}');
    const failingFolder = async (path: string, flags: string, mode?: number) => {
      if (flags === "r") throw Object.assign(new Error("no sync"), { code: "EIO" });
      return open(path, flags, mode);
    };
    const result = await adapter(home, { fs: { open: failingFolder } }).replaceUserFile(
      setKey("theme", "dark"),
    );
    expect(result).toEqual({ kind: "failed", path: userFile(home), code: "EIO" });
    expect(temporaries(userFolder(home))).toEqual([]);
  });
});

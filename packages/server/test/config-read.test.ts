import { afterAll, describe, expect, test } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configFiles, type FileStatus, readConfigFile } from "../src/config-files.ts";

// Reading the configuration files (settings-languages design decisions 3 and 4, open question B4),
// on real temporary folders: the text, absent, unreadable, and whether another user can write the
// file or its folder. Every test passes its own environment, never the developer's.

const root = realpathSync(mkdtempSync(join(tmpdir(), "askboard-config-read-")));
afterAll(() => {
  chmodSync(root, 0o700);
  rmSync(root, { recursive: true, force: true });
});

let count = 0;
/** A fresh folder of mode 0700 holding `config.json` with `text`, unless `text` is undefined. */
const folderWith = (text?: string): { folder: string; file: string } => {
  count += 1;
  const folder = join(root, `case-${count}`);
  mkdirSync(folder, { mode: 0o700 });
  const file = join(folder, "config.json");
  if (text !== undefined) writeFileSync(file, text, { mode: 0o600 });
  return { folder, file };
};

const asRoot = process.getuid?.() === 0;
const TEXT = '{"version": "1.0", "theme": "dark"}\n';

describe("a configuration file", () => {
  test("absent", async () => {
    expect(await readConfigFile(folderWith().file)).toEqual({ kind: "absent" });
  });

  test("no path at all reads as absent", async () => {
    expect(await readConfigFile(undefined)).toEqual({ kind: "absent" });
  });

  test("a regular file gives its text", async () => {
    const { file } = folderWith(TEXT);
    expect(await readConfigFile(file)).toEqual({ kind: "read", text: TEXT, othersCanWrite: false });
  });

  test.skipIf(asRoot)("a file the user cannot read is unreadable", async () => {
    const { file } = folderWith(TEXT);
    chmodSync(file, 0o000);
    expect(await readConfigFile(file)).toEqual({ kind: "unreadable", code: "EACCES" });
  });

  test("a symlinked file is read through", async () => {
    const target = folderWith(TEXT).file;
    const { file } = folderWith();
    symlinkSync(target, file);
    expect(await readConfigFile(file)).toEqual({ kind: "read", text: TEXT, othersCanWrite: false });
  });

  test("a symlink to nothing reads as absent", async () => {
    const { file } = folderWith();
    symlinkSync(join(root, "nowhere.json"), file);
    expect(await readConfigFile(file)).toEqual({ kind: "absent" });
  });

  test("a directory in the file's place is unreadable", async () => {
    const { file } = folderWith();
    mkdirSync(file);
    expect(await readConfigFile(file)).toEqual({ kind: "unreadable", code: "EISDIR" });
  });

  test("a file in a folder's place is unreadable", async () => {
    const { file } = folderWith(TEXT);
    expect(await readConfigFile(join(file, "config.json"))).toEqual({
      kind: "unreadable",
      code: "ENOTDIR",
    });
  });

  test("a named pipe in the file's place is unreadable, and never opened", async () => {
    const { file } = folderWith();
    const made = Bun.spawnSync(["mkfifo", file]);
    expect(made.exitCode).toBe(0);
    expect(await readConfigFile(file)).toEqual({ kind: "unreadable", code: "ENOTFILE" });
  });

  test("a read that fails with no code is unreadable as EIO", async () => {
    const { file } = folderWith(TEXT);
    const readFile = async (): Promise<string> => {
      throw new Error("the disk went away");
    };
    expect(await readConfigFile(file, { readFile })).toEqual({ kind: "unreadable", code: "EIO" });
  });

  test("a file larger than a configuration can be is unreadable, and never read", async () => {
    const { file } = folderWith(" ".repeat(1_048_577));
    expect(await readConfigFile(file)).toEqual({ kind: "unreadable", code: "EFBIG" });
  });
});

describe("others can write it", () => {
  test("when the file is group-writable", async () => {
    const { file } = folderWith(TEXT);
    chmodSync(file, 0o620);
    expect(await readConfigFile(file)).toMatchObject({ kind: "read", othersCanWrite: true });
  });

  test("when the file is world-writable", async () => {
    const { file } = folderWith(TEXT);
    chmodSync(file, 0o602);
    expect(await readConfigFile(file)).toMatchObject({ kind: "read", othersCanWrite: true });
  });

  test("when its folder is world-writable", async () => {
    const { folder, file } = folderWith(TEXT);
    chmodSync(folder, 0o777);
    expect(await readConfigFile(file)).toMatchObject({ kind: "read", othersCanWrite: true });
  });

  test("when a symlinked file's own folder, or its target's, is writable by others", async () => {
    const target = folderWith(TEXT);
    const link = folderWith();
    symlinkSync(target.file, link.file);
    chmodSync(target.folder, 0o770);
    expect(await readConfigFile(link.file)).toMatchObject({ othersCanWrite: true });
    chmodSync(target.folder, 0o700);
    chmodSync(link.folder, 0o730);
    expect(await readConfigFile(link.file)).toMatchObject({ othersCanWrite: true });
  });

  test("when another owner holds the file or its folder", async () => {
    const { folder, file } = folderWith(TEXT);
    const someoneElse =
      (held: string) =>
      async (path: string): Promise<FileStatus> => {
        const status = await stat(path);
        return {
          mode: status.mode,
          size: status.size,
          uid: path === held ? status.uid + 1 : status.uid,
          isFile: () => status.isFile(),
          isDirectory: () => status.isDirectory(),
        };
      };
    for (const held of [file, folder]) {
      const read = await readConfigFile(file, { stat: someoneElse(held) });
      expect({ held, read }).toEqual({
        held,
        read: { kind: "read", text: TEXT, othersCanWrite: true },
      });
    }
  });

  test("when the folder's status cannot be read", async () => {
    const { folder, file } = folderWith(TEXT);
    const failing = async (path: string): Promise<FileStatus> => {
      if (path === folder) throw Object.assign(new Error("denied"), { code: "EACCES" });
      return stat(path);
    };
    expect(await readConfigFile(file, { stat: failing })).toMatchObject({
      kind: "read",
      othersCanWrite: true,
    });
  });

  test("not when the file is 0644 in a 0755 folder the user owns", async () => {
    const { folder, file } = folderWith(TEXT);
    chmodSync(file, 0o644);
    chmodSync(folder, 0o755);
    expect(await readConfigFile(file)).toMatchObject({ othersCanWrite: false });
  });
});

describe("the adapter's reads", () => {
  test("read the user and the project file at their paths, with the panel's paths", async () => {
    const home = folderWith().folder;
    const project = folderWith().folder;
    mkdirSync(join(home, ".config/askboard"), { recursive: true, mode: 0o700 });
    mkdirSync(join(project, ".askboard"));
    writeFileSync(join(home, ".config/askboard/config.json"), TEXT, { mode: 0o600 });
    writeFileSync(join(project, ".askboard/config.json"), '{"version": "1.0"}', { mode: 0o600 });
    const files = configFiles({ env: { HOME: home, CLAUDE_PROJECT_DIR: project } });
    expect(files.paths).toEqual({
      user: "~/.config/askboard/config.json",
      project: ".askboard/config.json",
    });
    expect(await files.userFile()).toEqual({ kind: "read", text: TEXT, othersCanWrite: false });
    expect(await files.projectFile()).toEqual({
      kind: "read",
      text: '{"version": "1.0"}',
      othersCanWrite: false,
    });
  });

  test("read no file without HOME, XDG_CONFIG_HOME or CLAUDE_PROJECT_DIR", async () => {
    const files = configFiles({ env: {} });
    expect(files.paths).toEqual({});
    expect(await files.userFile()).toEqual({ kind: "absent" });
    expect(await files.projectFile()).toEqual({ kind: "absent" });
  });

  test("touch nothing until a file is read", async () => {
    const calls: string[] = [];
    const files = configFiles({
      env: { HOME: root, CLAUDE_PROJECT_DIR: root },
      fs: {
        stat: async (path) => {
          calls.push(path);
          return stat(path);
        },
      },
    });
    expect(calls).toEqual([]);
    await files.userFile();
    expect(calls.length).toBeGreaterThan(0);
  });
});

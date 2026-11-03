import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, lstatSync, mkdirSync, statSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { LOCAL_API_ROUTES, SOCKET_PATH_MAX_BYTES } from "@askboard/contract";
import {
  entriesOf,
  KEY,
  localRequest,
  removeRuntimeFolders,
  runtimeFolder,
  testApi,
} from "./helpers.ts";

// Board-host spec, Local API on a Unix socket (design decision 2, task 4.1): started on demand in
// the contract's session folder, the folder 0700, owned by the user and not a symlink, the socket
// 0600 under any umask, never on a network interface; a socket path over the platform's limit
// leaves the session on pull with one diagnostic.

afterAll(removeRuntimeFolders);

const modeOf = (path: string) => lstatSync(path).mode & 0o777;
const rule = LOCAL_API_ROUTES.rule.path;

describe("before the start", () => {
  test("making the local API creates no folder, socket or session file", () => {
    const { folder } = testApi();
    expect(existsSync(folder)).toBe(false);
  });
});

describe("the start", () => {
  test("creates the folder 0700 and the socket 0600, even under umask 0", async () => {
    const previous = process.umask(0);
    const run = testApi();
    try {
      await run.api.start();
      expect(process.umask()).toBe(0);
    } finally {
      process.umask(previous);
    }
    const folder = lstatSync(run.folder);
    expect(folder.isDirectory()).toBe(true);
    expect(folder.isSymbolicLink()).toBe(false);
    expect(folder.uid).toBe(process.getuid?.() ?? -1);
    expect(modeOf(run.folder)).toBe(0o700);
    expect(statSync(run.socket).isSocket()).toBe(true);
    expect(modeOf(run.socket)).toBe(0o600);
    expect((await localRequest(run.socket, rule)).status).toBe(200);
    expect(run.diagnosed).toEqual([]);
    await run.api.close();
  });

  test("tightens an existing folder of the user to 0700", async () => {
    const run = testApi();
    mkdirSync(run.folder, { mode: 0o755 });
    chmodSync(run.folder, 0o755);
    await run.api.start();
    expect(modeOf(run.folder)).toBe(0o700);
    await run.api.close();
  });

  // A folder made under a set-group-ID parent inherits that bit on Linux; macOS may drop it at the
  // chmod for a group the user is not in, so the sticky bit stands for both here.
  test("clears a special bit, since the mod checks for 0700 exactly", async () => {
    const run = testApi();
    mkdirSync(run.folder, { mode: 0o700 });
    chmodSync(run.folder, 0o1700);
    expect(lstatSync(run.folder).mode & 0o7777).toBe(0o1700);
    await run.api.start();
    expect(lstatSync(run.folder).mode & 0o7777).toBe(0o700);
    await run.api.close();
  });

  test("starts once, however often it is asked", async () => {
    const run = testApi();
    await Promise.all([run.api.start(), run.api.start()]);
    await run.api.start();
    expect(entriesOf(run.folder)).toEqual([`${KEY}.json`, `${KEY}.sock`]);
    expect(run.reported).toEqual([]);
    await run.api.close();
  });

  test("listens on no network interface: the session file names the socket", async () => {
    const run = testApi();
    await run.api.start();
    const { apiAddress } = JSON.parse(await Bun.file(run.file).text());
    expect(apiAddress).toBe(run.socket);
    expect(apiAddress.startsWith("/")).toBe(true);
    await run.api.close();
  });
});

describe("a session left on pull", () => {
  test("a socket path over the platform's limit: one diagnostic, no folder", async () => {
    const root = `/tmp/${"x".repeat(SOCKET_PATH_MAX_BYTES.darwin)}`;
    const run = testApi({ env: { XDG_RUNTIME_DIR: root }, platform: "darwin" });
    await run.api.start();
    expect(run.diagnosed).toEqual([
      expect.stringMatching(/pull alone.*over the limit of 103 bytes on macOS/),
    ]);
    expect(existsSync(root)).toBe(false);
    expect(run.reported).toEqual([]);
    await run.api.close();
  });

  test("the limit is Linux's on Linux", async () => {
    const root = `/tmp/${"y".repeat(SOCKET_PATH_MAX_BYTES.linux - 20)}`;
    const run = testApi({ env: { XDG_RUNTIME_DIR: root }, platform: "linux" });
    await run.api.start();
    expect(run.diagnosed).toEqual([expect.stringMatching(/107 bytes on Linux/)]);
  });

  test("a session folder that is a symlink: one diagnostic, nothing written through it", async () => {
    const { root, env, folder } = runtimeFolder();
    const target = join(root, "elsewhere");
    mkdirSync(target, { mode: 0o700 });
    symlinkSync(target, folder);
    const run = testApi({ env });
    await run.api.start();
    expect(run.diagnosed).toEqual([expect.stringMatching(/pull alone.*not a folder/)]);
    expect(entriesOf(target)).toEqual([]);
    await run.api.close();
  });

  test("a session folder that is a file: one diagnostic", async () => {
    const { env, folder } = runtimeFolder();
    await Bun.write(folder, "");
    const run = testApi({ env });
    await run.api.start();
    expect(run.diagnosed).toEqual([expect.stringMatching(/pull alone.*not a folder/)]);
  });

  test("a project folder that is not absolute: one diagnostic, no session file", async () => {
    const run = testApi({ projectRoot: "relative/project" });
    await run.api.start();
    expect(run.diagnosed).toEqual([expect.stringMatching(/pull alone.*session file.*not valid/)]);
    expect(entriesOf(run.folder)).toEqual([]);
  });

  test("a folder at the session file's name is reported, and nothing listens", async () => {
    const run = testApi();
    mkdirSync(join(run.file, "occupied"), { recursive: true });
    await run.api.start();
    expect(run.reported).toHaveLength(1);
    expect(entriesOf(run.folder)).toEqual([`${KEY}.json`]);
    await run.api.close();
  });

  test("a socket path that cannot be cleared is reported, and the claimed file goes", async () => {
    const run = testApi();
    mkdirSync(join(run.socket, "occupied"), { recursive: true });
    await run.api.start();
    expect(run.reported).toHaveLength(1);
    expect(entriesOf(run.folder)).toEqual([`${KEY}.sock`]);
    await run.api.close();
    expect(run.reported).toHaveLength(1);
  });

  test("a folder that cannot be made is reported once, and the session goes on", async () => {
    const run = testApi({ env: { XDG_RUNTIME_DIR: "/nonexistent-askboard-root" } });
    await run.api.start();
    expect(run.reported).toHaveLength(1);
    expect((run.reported[0] as { code?: string }).code).toBe("ENOENT");
    await run.api.close();
  });
});

describe("the close", () => {
  test("stops listening and leaves nothing in the folder", async () => {
    const run = testApi();
    await run.api.start();
    await run.api.close();
    expect(entriesOf(run.folder)).toEqual([]);
    await expect(localRequest(run.socket, rule)).rejects.toThrow();
  });

  test("before the start, it does nothing; after it, no start opens anything", async () => {
    const run = testApi();
    await run.api.close();
    await run.api.start();
    expect(existsSync(run.folder)).toBe(false);
  });

  test("during the start, it leaves nothing behind", async () => {
    const run = testApi();
    const starting = run.api.start();
    await run.api.close();
    await starting;
    expect(entriesOf(run.folder)).toEqual([]);
  });
});

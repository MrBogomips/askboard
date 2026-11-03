import { afterAll, describe, expect, test } from "bun:test";
import { lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LOCAL_API_ROUTES, SESSION_FILE_FORMAT, type SessionFile } from "@askboard/contract";
import { validateSessionFile } from "@askboard/contract/validate";
import { claimSessionFile, isAlive } from "../../../src/board-host/local-api/session-file.ts";
import {
  deadPid,
  entriesOf,
  KEY,
  localRequest,
  PID,
  PROJECT,
  removeRuntimeFolders,
  runtimeFolder,
  TOKEN,
  testApi,
} from "./helpers.ts";

// Board-host spec, Session file and Session file removed at exit (design decision 3, tasks 4.2 and
// 13.5): claimed 0600 by a temporary file linked to its name, which fails when the name exists,
// named by the Claude Code PID; a stale file taken out of the way and the claim tried once more, a
// live one left alone; other dead sessions' files and sockets pruned; file and socket removed at
// the close while the file is still this process's.

afterAll(removeRuntimeFolders);

const sessionOf = (pid: number, key = KEY) =>
  JSON.stringify({ format: SESSION_FILE_FORMAT, key, pid, epoch: "q8w2zz11" });

describe("the session file", () => {
  test("is written 0600 as <key>.json, valid, naming this process, its epoch and socket", async () => {
    const before = Date.now();
    const run = testApi();
    await run.api.start();
    expect(lstatSync(run.file).mode & 0o777).toBe(0o600);
    const written = JSON.parse(readFileSync(run.file, "utf8"));
    const checked = validateSessionFile(written);
    expect(checked.ok).toBe(true);
    expect(written).toEqual({
      format: SESSION_FILE_FORMAT,
      key: KEY,
      pid: PID,
      epoch: run.core.epoch,
      apiAddress: run.socket,
      sessionToken: TOKEN,
      projectDir: PROJECT,
      startedAt: expect.any(String),
    });
    expect(Date.parse(written.startedAt)).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000);
    // The temporary name is gone: only the file and the socket remain.
    expect(entriesOf(run.folder)).toEqual([`${KEY}.json`, `${KEY}.sock`]);
    await run.api.close();
  });

  test("names no project in a session without a project root (AD-12)", async () => {
    const run = testApi({ projectRoot: null });
    await run.api.start();
    const written = JSON.parse(readFileSync(run.file, "utf8"));
    expect(validateSessionFile(written).ok).toBe(true);
    expect(written).not.toHaveProperty("projectDir");
    expect(written).toMatchObject({ key: KEY, pid: PID, apiAddress: run.socket });
    await run.api.close();
  });

  test("replaces a file whose process is gone, and its socket", async () => {
    const { env, folder } = runtimeFolder();
    mkdirSync(folder, { mode: 0o700 });
    writeFileSync(join(folder, `${KEY}.json`), sessionOf(deadPid()));
    writeFileSync(join(folder, `${KEY}.sock`), "a stale socket");
    const run = testApi({ env });
    await run.api.start();
    expect(JSON.parse(readFileSync(run.file, "utf8")).pid).toBe(PID);
    expect(lstatSync(run.socket).isSocket()).toBe(true);
    expect(run.diagnosed).toEqual([]);
    await run.api.close();
  });

  test("replaces a file that holds no session", async () => {
    const { env, folder } = runtimeFolder();
    mkdirSync(folder, { mode: 0o700 });
    writeFileSync(join(folder, `${KEY}.json`), "not JSON");
    const run = testApi({ env });
    await run.api.start();
    expect(JSON.parse(readFileSync(run.file, "utf8")).pid).toBe(PID);
    await run.api.close();
  });

  test("leaves a live process's file alone, and runs on pull with one diagnostic", async () => {
    const { env, folder } = runtimeFolder();
    mkdirSync(folder, { mode: 0o700 });
    const live = 51_000;
    const held = sessionOf(live);
    writeFileSync(join(folder, `${KEY}.json`), held);
    const run = testApi({ env, alive: (pid) => pid === live || pid === PID });
    await run.api.start();
    expect(readFileSync(run.file, "utf8")).toBe(held);
    expect(entriesOf(folder)).toEqual([`${KEY}.json`]);
    expect(run.diagnosed).toEqual([
      expect.stringMatching(/pull alone: another AskBoard session process/),
    ]);
    await run.api.close();
    expect(readFileSync(run.file, "utf8")).toBe(held);
  });

  test("prunes the other files and sockets whose process is gone, and nothing else", async () => {
    const { env, folder } = runtimeFolder();
    mkdirSync(folder, { mode: 0o700 });
    const [liveKey, liveOwner, deadKey, orphanKey] = [61_001, 61_002, 61_003, 61_004];
    const write = (name: string, text = "") => writeFileSync(join(folder, name), text);
    write(`${liveKey}.json`, sessionOf(liveOwner, liveKey));
    write(`${liveKey}.sock`);
    write(`${deadKey}.json`, sessionOf(61_005, deadKey));
    write(`${deadKey}.sock`);
    write(`${orphanKey}.sock`);
    write(`${orphanKey}.ab12`);
    write(`${orphanKey}.json.61006.tmp`, "{");
    write(`${orphanKey}.json.61006.old`, "{");
    write(`${liveKey}.json.${liveOwner}.tmp`, "{");
    write(`${liveKey}.cd34`);
    write("notes.txt", "kept");
    const alive = (pid: number) => [PID, liveKey, liveOwner].includes(pid);
    const run = testApi({ env, alive });
    await run.api.start();
    expect(entriesOf(folder)).toEqual([
      `${KEY}.json`,
      `${KEY}.sock`,
      `${liveKey}.cd34`,
      `${liveKey}.json`,
      `${liveKey}.json.${liveOwner}.tmp`,
      `${liveKey}.sock`,
      "notes.txt",
    ]);
    await run.api.close();
  });
});

// The review's race (task 13.5): two session processes of one Claude Code process, starting together.
describe("two session processes starting at once under one key", () => {
  const rule = LOCAL_API_ROUTES.rule.path;
  const FIRST = { pid: 50_001, token: "A".repeat(22) };
  const SECOND = { pid: 50_002, token: "B".repeat(22) };

  test("exactly one holds the file and the socket; the other runs on pull with one diagnostic", async () => {
    const first = testApi({ ...FIRST, alive: () => true });
    const second = testApi({ ...SECOND, env: first.env, alive: () => true });
    await Promise.all([first.api.start(), second.api.start()]);
    const held = JSON.parse(readFileSync(first.file, "utf8"));
    const [winner, loser] = held.pid === FIRST.pid ? [first, second] : [second, first];
    expect(held.sessionToken).toBe(held.pid === FIRST.pid ? FIRST.token : SECOND.token);
    expect(winner.diagnosed).toEqual([]);
    expect(loser.diagnosed).toEqual([
      expect.stringMatching(/pull alone: another AskBoard session process/),
    ]);
    expect([...first.reported, ...second.reported]).toEqual([]);
    expect(entriesOf(first.folder)).toEqual([`${KEY}.json`, `${KEY}.sock`]);
    const token = held.sessionToken;
    expect((await localRequest(first.socket, rule, { token })).status).toBe(200);
    // Closing the one on pull leaves the holder's file and socket, and the holder reachable.
    await loser.api.close();
    expect(entriesOf(first.folder)).toEqual([`${KEY}.json`, `${KEY}.sock`]);
    expect((await localRequest(first.socket, rule, { token })).status).toBe(200);
    await winner.api.close();
    expect(entriesOf(first.folder)).toEqual([]);
  });

  test("over a stale file of a killed process, exactly one replaces it", async () => {
    const { env, folder } = runtimeFolder();
    mkdirSync(folder, { mode: 0o700 });
    const dead = deadPid();
    writeFileSync(join(folder, `${KEY}.json`), sessionOf(dead));
    const alive = (pid: number) => pid !== dead;
    const first = testApi({ ...FIRST, env, alive });
    const second = testApi({ ...SECOND, env, alive });
    await Promise.all([first.api.start(), second.api.start()]);
    const held = JSON.parse(readFileSync(first.file, "utf8"));
    expect([FIRST.pid, SECOND.pid]).toContain(held.pid);
    expect([...first.diagnosed, ...second.diagnosed]).toHaveLength(1);
    expect(entriesOf(folder)).toEqual([`${KEY}.json`, `${KEY}.sock`]);
    await Promise.all([first.api.close(), second.api.close()]);
    expect(entriesOf(folder)).toEqual([]);
  });
});

describe("the claim of the session file", () => {
  const sessionFor = (pid: number, folder: string): SessionFile => ({
    format: SESSION_FILE_FORMAT,
    key: KEY,
    pid,
    epoch: "q8w2zz11",
    apiAddress: join(folder, `${KEY}.sock`),
    sessionToken: TOKEN,
    projectDir: PROJECT,
    startedAt: "2026-11-01T09:00:00.000Z",
  });

  const staleFolder = () => {
    const { folder } = runtimeFolder();
    mkdirSync(folder, { mode: 0o700 });
    const file = join(folder, `${KEY}.json`);
    const dead = deadPid();
    writeFileSync(file, sessionOf(dead));
    return { folder, file, dead };
  };

  test("claims a free name, writing the file 0600 with nothing left behind", () => {
    const { folder } = runtimeFolder();
    mkdirSync(folder, { mode: 0o700 });
    const file = join(folder, `${KEY}.json`);
    expect(claimSessionFile(file, sessionFor(PID, folder), () => true)).toBe(true);
    expect(JSON.parse(readFileSync(file, "utf8")).pid).toBe(PID);
    expect(lstatSync(file).mode & 0o777).toBe(0o600);
    expect(entriesOf(folder)).toEqual([`${KEY}.json`]);
  });

  test("a stale file a starter claims meanwhile is put back, and this claim is refused", () => {
    const { folder, file, dead } = staleFolder();
    const other = sessionOf(50_003);
    let raced = false;
    // Between this claim's read of the dead holder and its taking the file, another starter takes
    // the stale file and claims the name.
    const alive = (pid: number) => {
      if (pid === dead && !raced) {
        raced = true;
        rmSync(file);
        writeFileSync(file, other);
      }
      return pid === 50_003;
    };
    expect(claimSessionFile(file, sessionFor(PID, folder), alive)).toBe(false);
    expect(readFileSync(file, "utf8")).toBe(other);
    expect(entriesOf(folder)).toEqual([`${KEY}.json`]);
  });

  test("a claim made by another starter before the second try is left alone", () => {
    const { folder, file, dead } = staleFolder();
    const other = sessionOf(50_003);
    let reads = 0;
    // The second look at the dead holder, on the file this claim took, lets another starter claim.
    const alive = (pid: number) => {
      if (pid === dead) {
        reads += 1;
        if (reads === 2) writeFileSync(file, other);
      }
      return pid === 50_003;
    };
    expect(claimSessionFile(file, sessionFor(PID, folder), alive)).toBe(false);
    expect(readFileSync(file, "utf8")).toBe(other);
    expect(entriesOf(folder)).toEqual([`${KEY}.json`]);
  });

  test("a folder at the file's name is not taken: the claim throws, and nothing is left behind", () => {
    const { folder } = runtimeFolder();
    const file = join(folder, `${KEY}.json`);
    mkdirSync(join(file, "occupied"), { recursive: true });
    expect(() => claimSessionFile(file, sessionFor(PID, folder), () => false)).toThrow();
    expect(entriesOf(folder)).toEqual([`${KEY}.json`]);
  });
});

describe("at the close", () => {
  test("the file and the socket go while the file is still this process's", async () => {
    const run = testApi();
    await run.api.start();
    await run.api.close();
    expect(entriesOf(run.folder)).toEqual([]);
  });

  test("a file another session process wrote since stays", async () => {
    const run = testApi({ alive: () => true });
    await run.api.start();
    const other = sessionOf(PID + 1);
    writeFileSync(run.file, other);
    await run.api.close();
    expect(readFileSync(run.file, "utf8")).toBe(other);
  });
});

describe("whether a process is alive", () => {
  test("this one is, an exited one is not", () => {
    expect(isAlive(process.pid)).toBe(true);
    expect(isAlive(deadPid())).toBe(false);
  });
});

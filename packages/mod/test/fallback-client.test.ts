import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  LOCAL_API_VERSION,
  SESSION_FILE_FORMAT,
  type SessionFile,
  sessionFilePath,
  sessionFolder,
  socketPathFor,
} from "@askboard/contract";
import { register } from "../src/index.ts";
import { privateCheck } from "../src/locate.ts";
import type { FsStat, ModApi, ProcessRunResult } from "../src/mod-api.ts";
import { clientCommand } from "../src/transport.ts";
import { answerAt, entryOf, MAIN_ASK, pollOf } from "./fake-local-api.ts";
import { fakeModApi, fakeOn, settle } from "./fake-mod-api.ts";

// The fallback against the real client mode (task 7.5): the session process's entry point built as
// the plugin's bundle, `dist/askboard.mjs`, and run through the plugin's start script by the mod's
// own client command through a real `$.process.run`, as a child of this test, which stands for Claude Code: the client finds the
// session file named by its parent's PID, as the mod does through its own PID command. The local
// API is a stand-in on a real Unix socket; `$.http.fetch` is refused by policy.

const ENTRY = join(import.meta.dir, "..", "..", "server", "src", "main.ts");
const START_SCRIPT = join(import.meta.dir, "..", "..", "..", "scripts", "askboard");
const REFUSAL = "$.http.fetch: probe-fetch-block: network requests are refused by policy";
const TOKEN = "Hc4nQ8vLw2Zr7TxB5mKp9A";
const UID = process.getuid?.() ?? 0;

type Received = { method: string; path: string; token: string | undefined; body?: unknown };

let plugin = "";
let runtime = "";
let server: Server | undefined;
const received: Received[] = [];
/** Statuses the stand-in refuses a route with, by path. */
const refusals = new Map<string, number>();

const serve = (socket: string) =>
  new Promise<Server>((resolve) => {
    const made = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const path = request.url ?? "";
        received.push({
          method: request.method ?? "",
          path,
          token: request.headers["x-askboard-session"] as string | undefined,
          ...(text === "" ? {} : { body: JSON.parse(text) }),
        });
        const refused = refusals.get(path);
        const body =
          path === "/v1/mod/poll"
            ? pollOf([entryOf(MAIN_ASK, [answerAt(1)])])
            : { version: LOCAL_API_VERSION };
        response.writeHead(refused ?? 200, { "Content-Type": "application/json" });
        response.end(refused === undefined ? JSON.stringify(body) : "refused\n");
      });
    });
    made.listen(socket, () => resolve(made));
  });

beforeAll(async () => {
  plugin = mkdtempSync(join(tmpdir(), "askboard-mod-plugin-"));
  const built = await Bun.build({ entrypoints: [ENTRY], target: "node", format: "esm" });
  const [bundle] = built.outputs;
  if (!built.success || bundle === undefined) throw new Error(built.logs.join("\n"));
  mkdirSync(join(plugin, "dist"));
  await Bun.write(join(plugin, "dist", "askboard.mjs"), bundle);
  // The start script the mod's client command runs, which needs Node 24.22.1 or later on PATH.
  mkdirSync(join(plugin, "scripts"));
  await Bun.write(join(plugin, "scripts", "askboard"), Bun.file(START_SCRIPT));
  // Short, for the socket path's limit.
  runtime = mkdtempSync("/tmp/abm-");
  const folder = sessionFolder({ env: { XDG_RUNTIME_DIR: runtime }, uid: UID });
  mkdirSync(folder, { mode: 0o700 });
  chmodSync(folder, 0o700);
  const session: SessionFile = {
    format: SESSION_FILE_FORMAT,
    key: process.pid,
    pid: process.pid,
    epoch: "k3x9",
    apiAddress: socketPathFor(folder, process.pid),
    sessionToken: TOKEN,
    projectDir: plugin,
    startedAt: "2026-10-31T09:40:02.117Z",
  };
  server = await serve(session.apiAddress);
  const file = sessionFilePath(folder, process.pid);
  writeFileSync(file, JSON.stringify(session), { mode: 0o600 });
  chmodSync(file, 0o600);
});

afterAll(async () => {
  await new Promise((resolve) => server?.close(resolve));
  rmSync(runtime, { recursive: true, force: true });
  rmSync(plugin, { recursive: true, force: true });
});

const folderOf = () => sessionFolder({ env: { XDG_RUNTIME_DIR: runtime }, uid: UID });

// The Node the repository pins, found from the repository (a version manager's shim picks its
// version by the working directory, and the start script runs in the plugin folder, outside it).
const NODE_FOLDER = dirname(
  Bun.spawnSync(["node", "-p", "process.execPath"], {
    cwd: join(import.meta.dir, "..", "..", ".."),
    stderr: "pipe",
  })
    .stdout.toString()
    .trim(),
);

const ENV = (): Record<string, string> => ({
  PATH: `${NODE_FOLDER}:${dirname(process.execPath)}:${process.env.PATH ?? ""}`,
  HOME: plugin,
  XDG_RUNTIME_DIR: runtime,
});

const stat = async (path: string): Promise<FsStat> => {
  const own = lstatSync(path);
  const led = own.isSymbolicLink() ? statSync(path) : own;
  const kind = led.isDirectory() ? "dir" : led.isFile() ? "file" : "other";
  return { kind, size: led.size, mtimeMs: led.mtimeMs, isLink: own.isSymbolicLink() };
};

/** A `$` whose environment, files and processes are this machine's, and whose fetch is refused. */
const realApi = () => {
  const fake = fakeModApi({ root: plugin });
  const runs: (readonly string[])[] = [];
  const api: ModApi = {
    ...fake.api,
    env: { get: async (name) => ENV()[name] },
    fs: { read: (path) => readFile(path, "utf8"), stat },
    http: {
      fetch: async () => {
        fake.calls.fetch.push({ url: "refused", init: undefined });
        throw new Error(REFUSAL);
      },
    },
    process: {
      run: async (argv): Promise<ProcessRunResult> => {
        runs.push(argv);
        const child = Bun.spawn([...argv], {
          env: ENV(),
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
        });
        const [exitCode, stdout, stderr] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ]);
        return { exitCode, stdout, stderr };
      },
    },
  };
  return { fake, api, runs };
};

const until = async (done: () => boolean): Promise<void> => {
  for (let wait = 0; wait < 160 && !done(); wait += 1) await Bun.sleep(25);
};

describe("the fallback through the bundle's client mode", () => {
  test("says hello, polls, pushes and reports through the client, with the session's token", async () => {
    received.splice(0);
    const { fake, api, runs } = realApi();
    const hooks = fakeOn(api);
    register(hooks.on);
    await hooks.sessionStart();
    await fake.tick();
    await until(() => received.some((request) => request.path === "/v1/mod/delivered"));
    await settle();
    expect(received.map((request) => `${request.method} ${request.path}`)).toEqual([
      "POST /v1/mod/hello",
      "GET /v1/mod/poll",
      "POST /v1/mod/delivered",
    ]);
    expect(received.every((request) => request.token === TOKEN)).toBe(true);
    expect(received[0]?.body).toEqual({
      version: LOCAL_API_VERSION,
      client: { name: "claude-code", version: "2.1.314" },
    });
    expect(received[2]?.body).toEqual({
      version: LOCAL_API_VERSION,
      askId: MAIN_ASK,
      cursor: "k3x9.1",
      via: "submit",
    });
    expect(fake.calls.submit).toHaveLength(1);
    // Each request was refused by fetch first; the third refusal in a row pinned the client.
    expect(fake.calls.fetch).toHaveLength(3);
    // The session folder and file were checked first, by the machine's own find.
    const [, folderCheck, fileCheck, ...clientRuns] = runs;
    expect([folderCheck, fileCheck]).toEqual([
      privateCheck(folderOf(), "d", UID, "700"),
      privateCheck(sessionFilePath(folderOf(), process.pid), "f", UID, "600"),
    ]);
    expect(clientRuns.length).toBeGreaterThan(0);
    expect(
      clientRuns.every((argv) => argv.slice(0, 3).join(" ") === clientCommand(plugin).join(" ")),
    ).toBe(true);
  });

  test("the machine's find refuses a session folder with mode 755, and nothing is sent", async () => {
    received.splice(0);
    chmodSync(folderOf(), 0o755);
    try {
      const { fake, api, runs } = realApi();
      const hooks = fakeOn(api);
      register(hooks.on);
      await hooks.sessionStart();
      await fake.tick();
      await settle();
      expect(runs.map((argv) => argv[0])).toEqual(["sh", "find"]);
      expect(received).toEqual([]);
      expect(fake.calls.fetch).toEqual([]);
      expect(fake.calls.log).toEqual([
        "AskBoard: the session folder or file is not private to this user; push waits for one that is",
      ]);
    } finally {
      chmodSync(folderOf(), 0o700);
    }
  });

  test("takes the client's refusal as final", async () => {
    received.splice(0);
    refusals.set("/v1/mod/delivered", 409);
    const { fake, api } = realApi();
    const hooks = fakeOn(api);
    register(hooks.on);
    await hooks.sessionStart();
    await fake.tick();
    await until(() => received.some((request) => request.path === "/v1/mod/delivered"));
    await settle();
    await fake.tick();
    await settle();
    refusals.clear();
    expect(received.map((request) => `${request.method} ${request.path}`)).toEqual([
      "POST /v1/mod/hello",
      "GET /v1/mod/poll",
      "POST /v1/mod/delivered",
      "GET /v1/mod/poll",
    ]);
  });
});

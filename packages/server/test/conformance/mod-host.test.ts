import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import {
  createModHost,
  type HostApi,
  type HostedAgent,
  MOD_MODULE,
  type ModHost,
  type ModModule,
} from "./mod-host.ts";

// The stand-in mod host itself (push delivery, task 9.1): what reaches the machine is real, what
// would act on Claude Code is recorded, and what it does not implement is reported. These tests
// load a small mod of their own; the conformance configurations load the built one.

const UID = process.getuid?.() ?? 0;
const made: string[] = [];
const hosts: ModHost[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(hosts.splice(0).map((host) => host.stop()));
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
  for (const folder of made.splice(0)) rmSync(folder, { recursive: true, force: true });
});

const folder = (): string => {
  const created = mkdtempSync("/tmp/abh-");
  made.push(created);
  return created;
};

type Hook = Parameters<Parameters<ModModule["register"]>[0]>[1];

/** A mod that registers `hooks` and keeps the `$` it is given. */
const modOf = (hooks: Readonly<Record<string, Hook>> = {}) => {
  const seen: { api?: HostApi } = {};
  const module: ModModule = {
    register: (on) => {
      for (const [event, hook] of Object.entries(hooks)) on(event, hook);
      on("session.start", async ($, e, next) => {
        seen.api = $;
        return next(e);
      });
    },
  };
  return { module, seen };
};

const hostOf = async (
  hooks: Readonly<Record<string, Hook>> = {},
  options: Partial<Parameters<typeof createModHost>[0]> = {},
) => {
  const { module, seen } = modOf(hooks);
  const host = await createModHost({
    env: { PATH: process.env.PATH ?? "", XDG_RUNTIME_DIR: "/run/user/test" },
    cwd: folder(),
    module,
    ...options,
  });
  hosts.push(host);
  await host.sessionStart();
  if (seen.api === undefined) throw new Error("the mod saw no session.start");
  return { host, $: seen.api };
};

describe("loading a mod", () => {
  test("the built module by default, from hooks/askboard-mod.js", () => {
    expect(MOD_MODULE.endsWith(join("hooks", "askboard-mod.js"))).toBe(true);
  });

  test("register gets an on that keeps its hooks; an event the host never emits is a problem", async () => {
    const { host } = await hostOf({ "tool.call": async (_$, e, next) => next(e) });
    expect(host.record.problems).toEqual([
      "the mod hooks tool.call, which the stand-in host never emits",
    ]);
    expect(host.record.events).toEqual([{ event: "session.start" }]);
  });
});

describe("what reaches the machine is real", () => {
  test("a process run is a child of this process, Claude Code's stand-in, in Claude Code's environment", async () => {
    const { $ } = await hostOf();
    const pid = await $.process.run(["sh", "-c", `printf '%s %s' "$PPID" "$(id -u)"`]);
    expect(pid).toEqual({ exitCode: 0, stdout: `${process.pid} ${UID}`, stderr: "" });
    const env = await $.process.run(["sh", "-c", 'printf %s "$XDG_RUNTIME_DIR"; cat'], {
      stdin: "in",
      env: { EXTRA: "1" },
    });
    expect(env.stdout).toBe("/run/user/testin");
    const failed = await $.process.run(["sh", "-c", "echo out; echo err >&2; exit 3"]);
    expect(failed).toEqual({ exitCode: 3, stdout: "out\n", stderr: "err\n" });
  });

  test("a run past its timeout is ended and reads as 1; stopping the host ends what it started", async () => {
    const { host, $ } = await hostOf();
    const started = Date.now();
    expect((await $.process.run(["sleep", "5"], { timeoutMs: 100 })).exitCode).toBe(1);
    expect(Date.now() - started).toBeLessThan(2_000);
    const running = $.process.run(["sleep", "5"]);
    await Bun.sleep(50);
    await host.stop();
    expect((await running).exitCode).toBe(1);
    expect(Date.now() - started).toBeLessThan(3_000);
    await expect($.process.run(["true"])).rejects.toThrow("the stand-in host has stopped");
  });

  test("$.http.fetch goes over the Unix socket, with its method, headers and body", async () => {
    const socket = join(folder(), "api.sock");
    const heard: Record<string, unknown>[] = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        heard.push({
          method: request.method,
          url: request.url,
          host: request.headers.host,
          token: request.headers["x-askboard-session"],
          origin: request.headers.origin,
          body: Buffer.concat(chunks).toString("utf8"),
        });
        response.writeHead(request.url === "/refused" ? 409 : 200, { "X-Seen": "yes" });
        response.end(request.url === "/refused" ? "refused\n" : '{"version":"1.0"}');
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(socket, resolve));
    const { host, $ } = await hostOf();
    const answered = await $.http.fetch("http://askboard/v1/mod/hello", {
      method: "POST",
      headers: { "X-AskBoard-Session": "token", "Content-Type": "application/json" },
      body: '{"version":"1.0"}',
      socketPath: socket,
    });
    expect(answered).toMatchObject({ status: 200, ok: true, text: '{"version":"1.0"}' });
    expect(answered.headers["x-seen"]).toBe("yes");
    expect(heard).toEqual([
      {
        method: "POST",
        url: "/v1/mod/hello",
        host: "askboard",
        token: "token",
        origin: undefined,
        body: '{"version":"1.0"}',
      },
    ]);
    const refused = await $.http.fetch("http://askboard/refused", { socketPath: socket });
    expect(refused).toMatchObject({ status: 409, ok: false, text: "refused\n" });
    expect(host.record.exchanges).toEqual([
      {
        via: "fetch",
        method: "POST",
        path: "/v1/mod/hello",
        request: { version: "1.0" },
        status: 200,
        response: { version: "1.0" },
      },
      { via: "fetch", method: "GET", path: "/refused", status: 409 },
    ]);
  });

  test("a fetch with no socket is never made: AskBoard's mod has no network request to make", async () => {
    const { host, $ } = await hostOf();
    await expect($.http.fetch("http://askboard/v1/mod/poll")).rejects.toThrow("no socketPath");
    expect(host.record.problems).toEqual([
      "the mod fetched http://askboard/v1/mod/poll over the network, not over a Unix socket",
    ]);
  });

  test("a fetch over a socket no process listens on rejects, recorded with no answer", async () => {
    const { host, $ } = await hostOf();
    const socketPath = join(folder(), "gone.sock");
    await expect($.http.fetch("http://askboard/v1/mod/poll", { socketPath })).rejects.toThrow();
    expect(host.record.exchanges).toEqual([{ via: "fetch", method: "GET", path: "/v1/mod/poll" }]);
  });

  test("a run of the AskBoard client is recorded as the local API exchange it carries", async () => {
    const { host, $ } = await hostOf();
    // The client's command line ends with `client <path> [<JSON body>]`; sh stands in for it here.
    const client = (script: string, ...rest: string[]) =>
      $.process.run(["sh", "-c", script, "client", ...rest]);
    await client(`printf '{"version":"1.0"}'`, "/v1/mod/hello", '{"version":"1.0"}');
    await client(`printf '{"status":409}'; exit 3`, "/v1/mod/delivered", '{"cursor":"k3x9.1"}');
    await client("exit 1", "/v1/mod/poll");
    expect(host.record.exchanges).toEqual([
      {
        via: "client",
        method: "POST",
        path: "/v1/mod/hello",
        request: { version: "1.0" },
        status: 200,
        response: { version: "1.0" },
      },
      {
        via: "client",
        method: "POST",
        path: "/v1/mod/delivered",
        request: { cursor: "k3x9.1" },
        status: 409,
      },
      { via: "client", method: "GET", path: "/v1/mod/poll" },
    ]);
  });

  test("with fetch refused by policy, every fetch rejects and is recorded as refused", async () => {
    const { host, $ } = await hostOf({}, { refuseFetch: true });
    await expect(
      $.http.fetch("http://askboard/v1/mod/poll", { socketPath: "/nonexistent.sock" }),
    ).rejects.toThrow("refused by policy");
    expect(host.record.exchanges).toEqual([
      { via: "fetch", method: "GET", path: "/v1/mod/poll", refused: true },
    ]);
  });

  test("$.fs reads real files and tells a link from what it leads to", async () => {
    const where = folder();
    mkdirSync(join(where, "dir"));
    writeFileSync(join(where, "file.json"), "{}");
    symlinkSync(join(where, "file.json"), join(where, "link.json"));
    const { host, $ } = await hostOf();
    expect(await $.fs.read(join(where, "file.json"))).toBe("{}");
    expect(await $.fs.stat(join(where, "dir"))).toMatchObject({ kind: "dir", isLink: false });
    expect(await $.fs.stat(join(where, "file.json"))).toMatchObject({
      kind: "file",
      size: 2,
      isLink: false,
    });
    expect(await $.fs.stat(join(where, "link.json"))).toMatchObject({ kind: "file", isLink: true });
    await expect($.fs.stat(join(where, "missing"))).rejects.toThrow();
    await expect($.fs.read(join(where, "missing"))).rejects.toThrow();
    expect(host.record.reads).toEqual([join(where, "file.json"), join(where, "missing")]);
  });

  test("$.clock gives the system time, and its timers run until cancelled or the host stops", async () => {
    const { host, $ } = await hostOf();
    const before = Date.now();
    const now = await $.clock.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
    let cancelled = 0;
    let stopped = 0;
    const timer = $.clock.every(10, () => {
      cancelled += 1;
    });
    $.clock.every(10, async () => {
      stopped += 1;
      throw new Error("a tick that fails");
    });
    await host.until(() => (cancelled >= 2 ? true : undefined), "two ticks");
    timer.cancel();
    const atCancel = cancelled;
    await Bun.sleep(50);
    expect(cancelled).toBe(atCancel);
    expect(stopped).toBeGreaterThan(2);
    expect(host.record.problems).toContain("a timer of the mod threw: a tick that fails");
    await host.stop();
    const atStop = stopped;
    await Bun.sleep(50);
    expect(stopped).toBe(atStop);
  });

  test("$.env gives Claude Code's environment, and the host records each name read", async () => {
    const { host, $ } = await hostOf();
    expect(await $.env.get("XDG_RUNTIME_DIR")).toBe("/run/user/test");
    expect(await $.env.get("TMPDIR")).toBeUndefined();
    expect(host.record.envReads).toEqual(["XDG_RUNTIME_DIR", "TMPDIR"]);
  });
});

describe("what would act on Claude Code is recorded", () => {
  test("the agent list, appends, submits, the version, toasts, the status entry and logs", async () => {
    const agents: HostedAgent[] = [
      { id: "a1", type: "code-reviewer", description: "", status: "running" },
    ];
    const { host, $ } = await hostOf({}, { agents, version: "2.1.312" });
    expect(await $.session.version()).toEqual({ version: "2.1.312", base: "2.1.312" });
    expect(await $.agent.list()).toEqual(agents);
    const message = { type: "user", content: [{ type: "text", text: "pushed" }] } as const;
    expect(await $.session.append({ message, agentId: "a1" })).toEqual({ uuid: "row-1" });
    host.setAgents([]);
    expect(await $.agent.list()).toEqual([]);
    expect(await $.session.append({ message })).toEqual({ uuid: "row-2" });
    expect(await $.prompt.submit({ text: "submitted" })).toEqual({ text: "submitted" });
    $.ui.toast("a toast");
    $.ui.status("a line");
    $.ui.status(undefined);
    $.ui.log("a debug line", { to: "debug" });
    expect(host.record.agentLists).toBe(2);
    expect(host.record.pushes.map(({ at: _at, ...push }) => push)).toEqual([
      { via: "append", agentId: "a1", text: "pushed" },
      { via: "append", text: "pushed" },
      { via: "submit", text: "submitted" },
    ]);
    expect(host.record.toasts).toEqual(["a toast"]);
    expect(host.record.statuses).toEqual(["a line", undefined]);
    expect(host.record.logs).toEqual(["a debug line"]);
  });

  test("an append to an agent not listed, or listed as finished, is refused, as the engine refuses it", async () => {
    const status = (id: string, of: HostedAgent["status"]): HostedAgent => ({
      id,
      type: "code-reviewer",
      description: "",
      status: of,
    });
    const agents = [
      status("a1", "idle"),
      status("a2", "completed"),
      status("a3", "failed"),
      status("a4", "killed"),
    ];
    const { host, $ } = await hostOf({}, { agents });
    const message = { type: "user", content: [{ type: "text", text: "pushed" }] } as const;
    for (const agentId of ["a2", "a3", "a4", "a5"]) {
      await expect($.session.append({ message, agentId })).rejects.toThrow(
        `$.session.append: no running loop is named ${agentId}`,
      );
    }
    expect(await $.session.append({ message, agentId: "a1" })).toEqual({ uuid: "row-1" });
    expect(await $.session.append({ message })).toEqual({ uuid: "row-2" });
    expect(host.record.pushes.map((push) => push.agentId)).toEqual(["a1", undefined]);
    expect(host.record.refusedAppends).toEqual(["a2", "a3", "a4", "a5"]);
    expect(host.record.problems).toEqual([]);
  });

  test("a submit can be dropped, as after the user interrupts a turn", async () => {
    const { $ } = await hostOf({}, { submit: async () => ({ drop: "interrupted" }) });
    expect(await $.prompt.submit({ text: "pushed" })).toEqual({ drop: "interrupted" });
  });

  test("turn events go through the mod's hooks and are recorded; a step's stream is read to its end", async () => {
    const seen: string[] = [];
    const { host } = await hostOf({
      "turn.start": async (_$, e, next) => {
        seen.push(`start ${(e as { agentId?: string }).agentId ?? "main"}`);
        return next(e);
      },
      "turn.step": async function* (_$, e, next) {
        seen.push(`step ${(e as { index: number }).index}`);
        yield "chunk";
        return yield* next(e) as AsyncGenerator<unknown, unknown>;
      },
      "turn.complete": async (_$, e, next) => {
        seen.push(`complete ${(e as { isAborted: boolean }).isAborted}`);
        return next(e);
      },
    });
    await host.turnStart();
    await host.turnStep();
    await host.turnStep();
    await host.turnComplete(undefined, true);
    await host.turnStart("a1");
    await host.turnComplete("a1");
    expect(seen).toEqual([
      "start main",
      "step 0",
      "step 1",
      "complete true",
      "start a1",
      "complete false",
    ]);
    expect(host.record.events).toEqual([
      { event: "session.start" },
      { event: "turn.start" },
      { event: "turn.step" },
      { event: "turn.step" },
      { event: "turn.complete" },
      { event: "turn.start", agentId: "a1" },
      { event: "turn.complete", agentId: "a1" },
    ]);
  });
});

describe("what the host does not implement", () => {
  test("is a problem the suite sees, and a throw the mod sees, never undefined", async () => {
    const { host, $ } = await hostOf();
    const loose = $ as unknown as Record<string, Record<string, unknown>>;
    expect(() => loose.session?.send).toThrow("$.session.send");
    expect(() => loose.tool).toThrow("$.tool");
    expect(host.record.problems).toEqual([
      "the mod reached $.session.send, which the stand-in host does not implement",
      "the mod reached $.tool, which the stand-in host does not implement",
    ]);
  });
});

describe("waiting for the record", () => {
  test("until gives what the probe finds, or fails naming what it waited for", async () => {
    const { host } = await hostOf();
    expect(await host.until((record) => record.events[0], "an event")).toEqual({
      event: "session.start",
    });
    await expect(host.until(() => undefined, "a push", 50)).rejects.toThrow(
      "the stand-in mod host waited 50 ms for a push",
    );
  });
});

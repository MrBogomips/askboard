import { describe, expect, test } from "bun:test";
import {
  CLAUDE_CODE_CLIENT_NAME,
  LOCAL_API_VERSION,
  POLL_INTERVAL_MS,
  sessionFilePath,
  sessionFolder,
} from "@askboard/contract";
import { register } from "../src/index.ts";
import {
  answerAt,
  entryOf,
  folderOf,
  MAIN_ASK,
  pendingOf,
  pollOf,
  runningSession,
  sessionOf,
  writeSessionFile,
} from "./fake-local-api.ts";
import { type FakeOptions, fakeModApi, fakeOn, PID_COMMAND, settle } from "./fake-mod-api.ts";

// The mod's start and its poll (task 7.1; mod spec, "Finding the session process", "Polling the
// local API"; design decision 7, Start and Per poll).

const started = async (options: FakeOptions = {}) => {
  const fake = fakeModApi(options);
  const hooks = fakeOn(fake.api);
  register(hooks.on);
  await hooks.sessionStart();
  return { fake, hooks };
};

describe("registering", () => {
  test("hooks the session's start and the turns, and nothing else", () => {
    const fake = fakeModApi();
    const hooks = fakeOn(fake.api);
    register(hooks.on);
    expect(hooks.events()).toEqual(["session.start", "turn.complete", "turn.start", "turn.step"]);
    expect(fake.calls.reached).toEqual([]);
  });

  test("passes every event on to the engine, a subagent's and the main conversation's", async () => {
    const { hooks } = await started();
    for (const agentId of [undefined, "a3f9c1d27b8e4f60"]) {
      expect(await hooks.turnStart({ turnId: "t1", agentId })).toEqual({ turnId: "t1" });
      expect(await hooks.turnStep({ turnId: "t1", agentId })).toBe("step-result");
      expect(await hooks.turnComplete({ turnId: "t1", agentId })).toEqual({ text: "" });
    }
  });
});

describe("the start", () => {
  test("runs one process for the Claude Code PID and the uid, and starts the poll", async () => {
    const { fake } = await started();
    expect(fake.calls.run).toEqual([{ argv: PID_COMMAND, init: undefined }]);
    expect(fake.intervals.map((interval) => interval.ms)).toEqual([POLL_INTERVAL_MS]);
  });

  test("reads only the session folder's variables, never CLAUDE_CODE_SESSION_ID", async () => {
    const { fake } = await started();
    expect([...fake.calls.env].sort()).toEqual(["TMPDIR", "XDG_RUNTIME_DIR"]);
    await fake.tick();
    expect(fake.calls.env).not.toContain("CLAUDE_CODE_SESSION_ID");
  });

  test.each([
    ["XDG_RUNTIME_DIR", { XDG_RUNTIME_DIR: "/run/user/501", TMPDIR: "/var/tmp/" }],
    ["TMPDIR", { TMPDIR: "/var/folders/7x/T/" }],
    ["neither", {}],
  ])("looks for the session file where the contract puts it, with %s", async (_case, env) => {
    const { fake } = await started({ env, pid: 777, uid: 503 });
    await fake.tick();
    const expected = sessionFilePath(sessionFolder({ env, uid: 503 }), 777);
    expect(fake.calls.reached).toContain("fs.stat");
    // The file is missing, so the folder and the file are looked at, and nothing is read.
    expect(fake.calls.fetch).toEqual([]);
    fake.dirs.add(sessionFolder({ env, uid: 503 }));
    fake.files.set(expected, "{}");
    const before = fake.calls.reached.filter((name) => name === "fs.read").length;
    await fake.tick();
    expect(fake.calls.reached.filter((name) => name === "fs.read").length).toBe(before + 1);
  });

  test("starts no poll when the PID command fails or prints something else", async () => {
    for (const result of [
      { exitCode: 1, stdout: "", stderr: "no sh" },
      { exitCode: 0, stdout: "48213", stderr: "" },
      { exitCode: 0, stdout: "x 501", stderr: "" },
    ]) {
      const fake = fakeModApi();
      fake.handlers.run = async () => result;
      const hooks = fakeOn(fake.api);
      const wrapped = { ...fake.api, process: { run: fake.handlers.run } };
      register(hooks.on);
      // The hook gets a `$` whose PID command gives `result`.
      const hook = hooks.hooks["session.start"]?.[0];
      await hook?.(wrapped, { cwd: "/project", isInteractive: true }, async (e) => ({
        cwd: e.cwd,
      }));
      expect(fake.intervals).toEqual([]);
    }
  });

  test("starts no poll when the PID command cannot run", async () => {
    const fake = fakeModApi();
    const hooks = fakeOn(fake.api);
    register(hooks.on);
    const failing = {
      ...fake.api,
      process: {
        run: async () => {
          throw new Error("refused");
        },
      },
    };
    const hook = hooks.hooks["session.start"]?.[0];
    const result = await hook?.(failing, { cwd: "/project", isInteractive: true }, async (e) => ({
      cwd: e.cwd,
    }));
    expect(result).toEqual({ cwd: "/project" });
    expect(fake.intervals).toEqual([]);
  });

  test("starts one poll, even when the session starts twice in one module", async () => {
    const { fake, hooks } = await started();
    await hooks.sessionStart();
    expect(fake.intervals).toHaveLength(1);
    expect(fake.calls.run).toHaveLength(1);
  });
});

describe("finding the session process", () => {
  test("pushes nothing until the session file exists, then reaches the local API", async () => {
    const { fake } = await started();
    await fake.tick();
    await fake.tick();
    expect(fake.calls.fetch).toEqual([]);
    const api = runningSession(fake);
    await fake.tick();
    expect(api.paths()).toEqual(["POST /v1/mod/hello", "GET /v1/mod/poll"]);
  });

  test("says hello once per epoch with the version the mod API gives", async () => {
    const { fake } = await started({ version: "2.1.314" });
    const api = runningSession(fake);
    await fake.tick();
    await fake.tick();
    expect(api.bodiesTo("/v1/mod/hello")).toEqual([
      { version: LOCAL_API_VERSION, client: { name: CLAUDE_CODE_CLIENT_NAME, version: "2.1.314" } },
    ]);
    expect(api.paths().filter((path) => path === "GET /v1/mod/poll")).toHaveLength(2);
  });

  test("sends each request over the session's socket with its token", async () => {
    const { fake } = await started();
    const api = runningSession(fake);
    await fake.tick();
    for (const { url, init } of fake.calls.fetch) {
      expect(url.startsWith("http://askboard/v1/")).toBe(true);
      expect(init?.socketPath).toBe(api.session.apiAddress);
      expect(init?.headers?.["X-AskBoard-Session"]).toBe(api.session.sessionToken);
    }
  });

  test("tries the hello again on the next poll when it cannot be sent", async () => {
    const { fake } = await started();
    const api = runningSession(fake);
    api.unreachable.add("/v1/mod/hello");
    await fake.tick();
    api.unreachable.clear();
    await fake.tick();
    await fake.tick();
    expect(api.paths().filter((path) => path === "POST /v1/mod/hello")).toHaveLength(2);
  });

  test("keeps polling when the version cannot be read, and says hello once it can", async () => {
    const { fake } = await started({ version: "2.1.314" });
    const api = runningSession(fake);
    const version = fake.api.session.version;
    (fake.api.session as { version: () => Promise<unknown> }).version = async () => {
      throw new Error("no version");
    };
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    // The poll went on (task 13.2): the answer was pushed, with no hello yet.
    expect(api.paths()).toEqual(["GET /v1/mod/poll", "POST /v1/mod/delivered"]);
    expect(fake.calls.submit).toHaveLength(1);
    (fake.api.session as { version: typeof version }).version = version;
    await fake.tick();
    expect(api.bodiesTo("/v1/mod/hello")).toEqual([
      { version: LOCAL_API_VERSION, client: { name: CLAUDE_CODE_CLIENT_NAME, version: "2.1.314" } },
    ]);
  });

  test("takes a refused hello as said, and does not repeat it", async () => {
    const { fake } = await started();
    const api = runningSession(fake);
    api.refuse.set("/v1/mod/hello", 400);
    await fake.tick();
    await fake.tick();
    expect(api.paths().filter((path) => path === "POST /v1/mod/hello")).toHaveLength(1);
  });

  test("forgets an epoch when the session file names another, and says hello again", async () => {
    const { fake } = await started();
    const first = runningSession(fake);
    // A long poll cut at a continuation, which belongs to the first epoch.
    first.answerPolls(
      pollOf([entryOf(MAIN_ASK, [answerAt(1)])], [], {
        more: true,
        continuation: { askId: MAIN_ASK, seq: 2 },
      }),
    );
    await fake.tick();
    await fake.tick();
    expect(first.paths()).toContain("GET /v1/mod/poll?askId=order-db-choice-x7k2&seq=2");
    const second = runningSession(fake, { epoch: "m7q2", pid: 48299 });
    second.answerPolls(pollOf([], [], { epoch: "m7q2" }));
    await fake.tick();
    expect(second.paths().slice(-2)).toEqual(["POST /v1/mod/hello", "GET /v1/mod/poll"]);
  });

  test("forgets a session process that restarted with the same epoch under a new PID", async () => {
    const { fake } = await started();
    runningSession(fake);
    await fake.tick();
    const restarted = runningSession(fake, { pid: 48300 });
    await fake.tick();
    expect(restarted.paths()).toEqual(["POST /v1/mod/hello", "GET /v1/mod/poll"]);
  });

  test.each([
    ["not JSON", "{"],
    ["another format major", { format: "2.0" }],
    ["a missing field", { sessionToken: undefined }],
    ["an extra field", { extra: 1 }],
    ["another key", { key: 9 }],
    ["another socket", { apiAddress: "/tmp/elsewhere.sock" }],
  ])("finds no session in a file with %s", async (_case, changes) => {
    const { fake } = await started();
    const session = sessionOf(fake);
    runningSession(fake);
    writeSessionFile(fake, typeof changes === "string" ? changes : { ...session, ...changes });
    await fake.tick();
    expect(fake.calls.fetch).toEqual([]);
  });

  test.each(["folder", "file"])("finds no session when the %s is a link", async (which) => {
    const { fake } = await started();
    const path = runningSession(fake).session.apiAddress.replace(/\.sock$/, ".json");
    fake.links.add(which === "folder" ? folderOf(fake) : path);
    await fake.tick();
    expect(fake.calls.fetch).toEqual([]);
  });

  test("finds no session when the folder is a file", async () => {
    const { fake } = await started();
    runningSession(fake);
    fake.dirs.delete(folderOf(fake));
    fake.files.set(folderOf(fake), "");
    await fake.tick();
    expect(fake.calls.fetch).toEqual([]);
  });
});

describe("trusting the session folder and file (AD-5, AD-10)", () => {
  const NOT_PRIVATE =
    "AskBoard: the session folder or file is not private to this user; push waits for one that is";

  const findOf = (path: string, type: "d" | "f", uid: number, perm: string) => [
    "find",
    path,
    "-maxdepth",
    "0",
    "-type",
    type,
    "-uid",
    `${uid}`,
    "-perm",
    perm,
  ];

  test("checks the folder 0700 and the file 0600, owned by the user, then reaches the local API", async () => {
    const { fake } = await started({ uid: 503 });
    const api = runningSession(fake);
    await fake.tick();
    const file = sessionFilePath(folderOf(fake), fake.pid);
    expect(fake.calls.find.map((run) => run.argv)).toEqual([
      findOf(folderOf(fake), "d", 503, "700"),
      findOf(file, "f", 503, "600"),
    ]);
    for (const run of fake.calls.find) expect(run.init?.timeoutMs).toBeGreaterThan(0);
    expect(api.paths()).toEqual(["POST /v1/mod/hello", "GET /v1/mod/poll"]);
    expect(fake.calls.log).toEqual([]);
  });

  test.each([
    ["the folder belongs to another user", "folder", { owner: 1001 }],
    ["the folder has mode 755", "folder", { mode: 0o755 }],
    ["the file belongs to another user", "file", { owner: 0 }],
    ["the file has mode 644", "file", { mode: 0o644 }],
  ])("pushes nothing when %s, with one debug line", async (_case, which, change) => {
    const { fake } = await started();
    const api = runningSession(fake);
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    const path = which === "folder" ? folderOf(fake) : sessionFilePath(folderOf(fake), fake.pid);
    if ("owner" in change) fake.owners.set(path, change.owner);
    if ("mode" in change) fake.modes.set(path, change.mode);
    await fake.tick();
    await fake.tick();
    await settle();
    expect(fake.calls.fetch).toEqual([]);
    expect(fake.calls.submit).toEqual([]);
    expect(fake.calls.status).toEqual([]);
    expect(fake.calls.log).toEqual([NOT_PRIVATE]);
  });

  test("pushes nothing when the check cannot run", async () => {
    const { fake } = await started();
    runningSession(fake);
    const run = fake.api.process.run;
    (fake.api.process as { run: typeof run }).run = async (argv, init) => {
      if (argv[0] === "find") throw new Error("find: not allowed");
      return run(argv, init);
    };
    await fake.tick();
    expect(fake.calls.fetch).toEqual([]);
    expect(fake.calls.log).toEqual([NOT_PRIVATE]);
  });

  test("checks once per session process, and again for a new epoch or PID", async () => {
    const { fake } = await started();
    runningSession(fake);
    await fake.tick();
    await fake.tick();
    expect(fake.calls.find).toHaveLength(2);
    runningSession(fake, { epoch: "m7q2" });
    await fake.tick();
    expect(fake.calls.find).toHaveLength(4);
    const restarted = runningSession(fake, { epoch: "m7q2", pid: 48300 });
    await fake.tick();
    expect(fake.calls.find).toHaveLength(6);
    expect(restarted.paths()).toEqual(["POST /v1/mod/hello", "GET /v1/mod/poll"]);
  });

  test("checks again once a minute, at every sixtieth poll, while it acts on one session process", async () => {
    const { fake } = await started();
    const api = runningSession(fake);
    await fake.tick();
    expect(fake.calls.find).toHaveLength(2);
    for (let poll = 2; poll <= 60; poll += 1) await fake.tick();
    expect(fake.calls.find).toHaveLength(2);
    await fake.tick();
    expect(fake.calls.find).toHaveLength(4);
    expect(api.paths().filter((path) => path === "GET /v1/mod/poll")).toHaveLength(61);
  });

  test("stops polling at the check a minute on when the folder is no longer private", async () => {
    const { fake } = await started();
    const api = runningSession(fake);
    api.answerPolls(pollOf([], [pendingOf(MAIN_ASK)]));
    for (let poll = 1; poll <= 60; poll += 1) await fake.tick();
    const polled = api.paths().length;
    fake.modes.set(folderOf(fake), 0o755);
    await fake.tick();
    await fake.tick();
    expect(api.paths()).toHaveLength(polled);
    expect(fake.calls.status.at(-1)).toBeUndefined();
    expect(fake.calls.log).toEqual([NOT_PRIVATE]);
    // A failed check runs again at the next poll, and the mod polls once it passes.
    fake.modes.delete(folderOf(fake));
    await fake.tick();
    expect(api.paths()).toHaveLength(polled + 1);
  });

  test("a new session process in a file that is no longer private is not trusted", async () => {
    const { fake } = await started();
    const first = runningSession(fake);
    first.answerPolls(pollOf([], [pendingOf(MAIN_ASK)]));
    await fake.tick();
    expect(fake.calls.status).toHaveLength(1);
    const requests = first.paths().length;
    runningSession(fake, { epoch: "m7q2" });
    fake.modes.set(sessionFilePath(folderOf(fake), fake.pid), 0o644);
    await fake.tick();
    await fake.tick();
    expect(fake.calls.fetch).toHaveLength(requests);
    expect(fake.calls.status).toEqual([expect.any(String), undefined]);
    expect(fake.calls.log).toEqual([NOT_PRIVATE]);
  });

  test("tries the check again at the next poll, and trusts the file once it passes", async () => {
    const { fake } = await started();
    const api = runningSession(fake);
    fake.owners.set(folderOf(fake), 1001);
    await fake.tick();
    expect(fake.calls.fetch).toEqual([]);
    fake.owners.delete(folderOf(fake));
    await fake.tick();
    expect(api.paths()).toEqual(["POST /v1/mod/hello", "GET /v1/mod/poll"]);
  });
});

describe("polling", () => {
  test("keeps polling after /clear, which ends the session and starts no new one", async () => {
    const { fake, hooks } = await started();
    const api = runningSession(fake);
    await fake.tick();
    // A /clear fires session.end, which the mod does not hook, and no session.start.
    expect(hooks.events()).not.toContain("session.end");
    await fake.tick();
    expect(fake.intervals.every((interval) => !interval.cancelled)).toBe(true);
    expect(api.paths().filter((path) => path === "GET /v1/mod/poll")).toHaveLength(2);
  });

  test("pushes nothing from a poll of another local API major", async () => {
    const { fake } = await started();
    const api = runningSession(fake);
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])], [], { version: "2.0" }));
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toEqual([]);
    expect(fake.calls.append).toEqual([]);
    expect(api.paths()).not.toContain("POST /v1/mod/delivered");
  });

  test.each([
    ["not JSON", "{"],
    ["another epoch", pollOf([entryOf(MAIN_ASK, [answerAt(1)])], [], { epoch: "zzzz" })],
  ])("pushes nothing from a poll answer that is %s", async (_case, answer) => {
    const { fake } = await started();
    const api = runningSession(fake);
    api.answerPolls(answer);
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toEqual([]);
  });

  test("pushes nothing when the poll is refused or cannot be sent", async () => {
    const { fake } = await started();
    const api = runningSession(fake);
    api.refuse.set("/v1/mod/poll", 403);
    await fake.tick();
    api.refuse.clear();
    api.unreachable.add("/v1/mod/poll");
    await fake.tick();
    expect(fake.calls.submit).toEqual([]);
  });

  test("skips a period while the previous poll still runs", async () => {
    const { fake } = await started();
    const api = runningSession(fake);
    let release = () => {};
    const answering = fake.handlers.fetch;
    fake.handlers.fetch = (url, init) =>
      new Promise((resolve) => {
        release = () => resolve(answering(url, init));
      });
    const first = fake.tick();
    await settle();
    await fake.tick();
    fake.handlers.fetch = answering;
    release();
    await first;
    expect(api.paths()).toEqual(["POST /v1/mod/hello", "GET /v1/mod/poll"]);
  });
});

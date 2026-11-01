import { describe, expect, test } from "bun:test";
import { LOCAL_API_VERSION } from "@askboard/contract";
import { register } from "../src/index.ts";
import { clientCommand } from "../src/transport.ts";
import { answerAt, entryOf, MAIN_ASK, pollOf, runningSession } from "./fake-local-api.ts";
import { type Fake, fakeModApi, fakeOn, settle } from "./fake-mod-api.ts";

// When `$.http.fetch` is refused (tasks 7.5 and 13.2; mod spec, "When `$.http.fetch` is refused";
// AD-5; finding criterion 11): a request whose fetch fails goes through the AskBoard bundle run as a
// client by `$.process.run`; after three requests in a row to one session process whose fetch
// failed while the client reached it, polls, delivery reports and the hello all go through the
// client for the rest of the session. A fetch that succeeds resets the count, a new session process
// starts a new one, and a client that fails is tried again at the next poll. Against the real client
// mode: fallback-client.test.ts.

const REFUSAL = "$.http.fetch: probe-fetch-block: network requests are refused by policy";
const ROOT = "/plugins/askboard";

const refuseFetch = (fake: Fake) => {
  fake.handlers.fetch = async () => {
    throw new Error(REFUSAL);
  };
};

/** Makes the fetches numbered in `failing`, from 1, reject as a reset socket; the others answer. */
const failFetches = (fake: Fake, failing: ReadonlySet<number>) => {
  const answering = fake.handlers.fetch;
  let made = 0;
  fake.handlers.fetch = async (url, init) => {
    made += 1;
    if (failing.has(made)) throw new Error("read ECONNRESET");
    return answering(url, init);
  };
};

const vias = (api: ReturnType<typeof runningSession>) => api.requests.map((request) => request.via);

const setUp = async () => {
  const fake = fakeModApi({ root: ROOT });
  const hooks = fakeOn(fake.api);
  register(hooks.on);
  await hooks.sessionStart();
  const api = runningSession(fake);
  // The client mode of the bundle, answering for the same session.
  fake.handlers.run = async (argv) => {
    expect(argv.slice(0, 3)).toEqual([...clientCommand(ROOT)]);
    return api.client(argv.slice(3));
  };
  return { fake, hooks, api };
};

/** The process runs after the PID command: the client's. */
const clientRuns = (fake: Fake) => fake.calls.run.slice(1);

describe("the client command", () => {
  test("is one constant: the bundle under the plugin root, run by bun in client mode", () => {
    expect(clientCommand("/p")).toEqual(["bun", "/p/dist/askboard.mjs", "client"]);
  });
});

describe("a refused fetch", () => {
  test("sends the hello, the polls and the reports through the client for the rest of the session", async () => {
    const { fake, api } = await setUp();
    refuseFetch(fake);
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    await fake.tick();
    await settle();
    // The hello, the poll and the report each failed by fetch and reached the session by the client.
    expect(fake.calls.fetch).toHaveLength(3);
    expect(
      api.requests.map((request) => `${request.via} ${request.method} ${request.path}`),
    ).toEqual([
      "client POST /v1/mod/hello",
      "client GET /v1/mod/poll",
      "client POST /v1/mod/delivered",
      "client GET /v1/mod/poll",
    ]);
    expect(fake.calls.submit).toHaveLength(1);
    expect(api.bodiesTo("/v1/mod/delivered")).toEqual([
      { version: LOCAL_API_VERSION, askId: MAIN_ASK, cursor: "k3x9.1", via: "submit" },
    ]);
  });

  test("passes the route's path, and a POST's JSON body as one argument", async () => {
    const { fake } = await setUp();
    refuseFetch(fake);
    await fake.tick();
    const [hello, poll] = fake.calls.run.slice(1).map((run) => run.argv);
    expect(hello?.slice(3, 4)).toEqual(["/v1/mod/hello"]);
    expect(JSON.parse(hello?.[4] ?? "")).toEqual({
      version: LOCAL_API_VERSION,
      client: { name: "claude-code", version: "2.1.314" },
    });
    expect(hello).toHaveLength(5);
    expect(poll?.slice(3)).toEqual(["/v1/mod/poll"]);
    expect(fake.calls.run[1]?.init?.timeoutMs).toBeGreaterThan(0);
  });

  test("stays with the client under a new epoch, once it is pinned", async () => {
    const { fake, api } = await setUp();
    refuseFetch(fake);
    await fake.tick();
    await fake.tick();
    const next = runningSession(fake, { epoch: "m7q2", pid: 48299 });
    fake.handlers.run = async (argv) => next.client(argv.slice(3));
    next.answerPolls(pollOf([], [], { epoch: "m7q2" }));
    await fake.tick();
    expect(fake.calls.fetch).toHaveLength(3);
    expect(vias(next)).toEqual(["client", "client"]);
    expect(api.requests).toHaveLength(3);
  });

  test("does not retry a report the client says was refused", async () => {
    const { fake, api } = await setUp();
    refuseFetch(fake);
    api.refuse.set("/v1/mod/delivered", 409);
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    await fake.tick();
    await settle();
    expect(api.bodiesTo("/v1/mod/delivered")).toHaveLength(1);
  });

  test("retries a report the client could not send", async () => {
    const { fake, api } = await setUp();
    refuseFetch(fake);
    api.unreachable.add("/v1/mod/delivered");
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    api.unreachable.clear();
    await fake.tick();
    await settle();
    expect(api.bodiesTo("/v1/mod/delivered")).toHaveLength(2);
    expect(fake.calls.submit).toHaveLength(1);
  });
});

describe("when to pin the client (task 13.2)", () => {
  test("one transient socket error keeps fetch: that request alone goes through the client", async () => {
    const { fake, api } = await setUp();
    failFetches(fake, new Set([2]));
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    for (let poll = 0; poll < 4; poll += 1) {
      await fake.tick();
      await settle();
    }
    // A failed fetch reaches no session, so the local API heard the first poll from the client.
    expect(vias(api)).toEqual(["fetch", "client", "fetch", "fetch", "fetch", "fetch"]);
    expect(api.paths().slice(0, 3)).toEqual([
      "POST /v1/mod/hello",
      "GET /v1/mod/poll",
      "POST /v1/mod/delivered",
    ]);
    expect(fake.calls.submit).toHaveLength(1);
  });

  test("pins it after three requests in a row whose fetch failed while it reached the session", async () => {
    const { fake, api } = await setUp();
    failFetches(fake, new Set([1, 2, 3]));
    for (let poll = 0; poll < 3; poll += 1) await fake.tick();
    // The hello, the first poll and the second failed by fetch; fetch is not tried again.
    expect(fake.calls.fetch).toHaveLength(3);
    expect(vias(api)).toEqual(["client", "client", "client", "client"]);
  });

  test("starts the count over after a fetch that succeeds", async () => {
    const { fake, api } = await setUp();
    failFetches(fake, new Set([1, 2, 4, 5, 7, 8]));
    for (let poll = 0; poll < 8; poll += 1) await fake.tick();
    expect(fake.calls.fetch).toHaveLength(9);
    expect(vias(api).at(-1)).toBe("fetch");
  });

  test("starts a new count with a new session process", async () => {
    const { fake, api } = await setUp();
    failFetches(fake, new Set([1, 2]));
    await fake.tick();
    expect(vias(api)).toEqual(["client", "client"]);
    const next = runningSession(fake, { epoch: "m7q2", pid: 48299 });
    failFetches(fake, new Set([1]));
    fake.handlers.run = async (argv) => next.client(argv.slice(3));
    next.answerPolls(pollOf([], [], { epoch: "m7q2" }));
    await fake.tick();
    await fake.tick();
    // The new session's first failed fetch counts one, not three: fetch stays.
    expect(vias(next)).toEqual(["client", "fetch", "fetch"]);
  });

  test("counts a request whose client fails too neither as a refusal nor as a success", async () => {
    const { fake, api } = await setUp();
    refuseFetch(fake);
    await fake.tick();
    api.unreachable.add("/v1/mod/poll");
    await fake.tick();
    api.unreachable.clear();
    await fake.tick();
    await fake.tick();
    // Two refusals, a request that failed both ways, a third refusal: pinned, so the fourth poll
    // made no fetch.
    expect(vias(api)).toEqual(["client", "client", "client", "client", "client"]);
    expect(fake.calls.fetch).toHaveLength(4);
  });
});

describe("a fetch that fails while the session process is unreachable", () => {
  test("keeps fetch, and tries the client again at each next poll", async () => {
    const { fake, api } = await setUp();
    refuseFetch(fake);
    api.unreachable.add("/v1/mod/hello");
    api.unreachable.add("/v1/mod/poll");
    for (let poll = 0; poll < 5; poll += 1) await fake.tick();
    // One client run a poll, for the hello; the poll's request skips it within that poll.
    expect(api.paths()).toEqual(Array(5).fill("POST /v1/mod/hello"));
    expect(fake.calls.fetch).toHaveLength(10);
    api.unreachable.clear();
    await fake.tick();
    expect(api.paths().slice(5)).toEqual(["POST /v1/mod/hello", "GET /v1/mod/poll"]);
    expect(vias(api).slice(5)).toEqual(["client", "client"]);
  });

  test("a client that fails once is tried again at the next poll, which gets its answer", async () => {
    const { fake, api } = await setUp();
    refuseFetch(fake);
    api.unreachable.add("/v1/mod/hello");
    api.unreachable.add("/v1/mod/poll");
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    api.unreachable.clear();
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toHaveLength(1);
  });

  test.each([
    ["exits 2, a usage error", { exitCode: 2, stdout: "", stderr: "usage" }],
    ["answers what is not JSON", { exitCode: 0, stdout: "{", stderr: "" }],
    ["gives no status with its refusal", { exitCode: 3, stdout: "{}", stderr: "" }],
    ["exits by a signal", { exitCode: 1, stdout: "", stderr: "" }],
  ])("counts a client that %s as no answer", async (_case, result) => {
    const { fake } = await setUp();
    refuseFetch(fake);
    fake.handlers.run = async () => result;
    await fake.tick();
    await fake.tick();
    // No switch: the second poll fetched again.
    expect(fake.calls.fetch.length).toBeGreaterThanOrEqual(2);
  });

  test("counts a client that cannot start as no answer", async () => {
    const { fake } = await setUp();
    refuseFetch(fake);
    fake.handlers.run = async () => {
      throw new Error("bun not found");
    };
    await fake.tick();
    await fake.tick();
    expect(fake.calls.fetch.length).toBeGreaterThanOrEqual(2);
  });
});

describe("a fetch answered with a refusal", () => {
  test("is the local API's answer, not a refused fetch: no switch", async () => {
    const { fake, api } = await setUp();
    api.refuse.set("/v1/mod/poll", 403);
    await fake.tick();
    await fake.tick();
    expect(api.requests.every((request) => request.via === "fetch")).toBe(true);
    expect(clientRuns(fake)).toEqual([]);
  });
});

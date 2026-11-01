import { afterEach, describe, expect, test } from "bun:test";
import { LOCAL_API_HOST, pollPath, SESSION_TOKEN_HEADER } from "@askboard/contract";
import { fixturePollResponse } from "@askboard/contract/fixtures";
import {
  CLIENT_EXIT,
  clientProcess,
  type ModeProcess,
  type ProcessOutput,
  runClient,
} from "../src/index.ts";
import { chunks, type FakeApi, fakeLocalApi, removeRuntimeFolders, UID } from "./fake-local-api.ts";

// The client mode (task 6.6; packaging spec, "Client mode"; AD-5): `askboard client <path>
// [<body>]` sends that one local API request to the session process of its parent Claude Code
// process, found through the session file, and prints the answer. The session token comes from
// the session file, never from the command line. The mod's fallback runs it once per request.

const apis: FakeApi[] = [];
afterEach(async () => {
  await Promise.all(apis.splice(0).map((api) => api.close()));
  removeRuntimeFolders();
});

const started = async () => {
  const api = await fakeLocalApi();
  apis.push(api);
  return api;
};

const lookup = (api: FakeApi | undefined) => ({
  env: api?.env ?? { XDG_RUNTIME_DIR: "/nonexistent-askboard-test" },
  uid: UID,
  ppid: api?.key ?? 48_213,
});

const DELIVERED = { version: "1.0", askId: "retry-policy-q3m8", cursor: "k3x9.1", via: "append" };

describe("a request the local API answers", () => {
  test("prints a poll's answer exactly as the socket gives it", async () => {
    const api = await started();
    api.reply(() => ({ json: fixturePollResponse }));
    const outcome = await runClient([pollPath()], lookup(api));
    expect(outcome).toEqual({
      code: CLIENT_EXIT.answered,
      stdout: JSON.stringify(fixturePollResponse),
      stderr: "",
    });
    const [request] = api.requests;
    expect(request).toMatchObject({ method: "GET", url: "/v1/mod/poll", body: "" });
    expect(request?.headers.host).toBe(LOCAL_API_HOST);
    expect(request?.headers[SESSION_TOKEN_HEADER.toLowerCase()]).toBe(api.session.sessionToken);
    expect(request?.headers.origin).toBeUndefined();
  });

  test("passes a poll's continuation on in its path", async () => {
    const api = await started();
    api.reply(() => ({ json: fixturePollResponse }));
    const path = pollPath({ askId: "retry-policy-q3m8", seq: 4 });
    expect((await runClient([path], lookup(api))).code).toBe(CLIENT_EXIT.answered);
    expect(api.requests[0]?.url).toBe("/v1/mod/poll?askId=retry-policy-q3m8&seq=4");
  });

  test("posts the body given, as it is", async () => {
    const api = await started();
    const body = JSON.stringify(DELIVERED, null, 1);
    const outcome = await runClient(["/v1/mod/delivered", body], lookup(api));
    expect(outcome).toEqual({
      code: CLIENT_EXIT.answered,
      stdout: '{"version":"1.0"}',
      stderr: "",
    });
    expect(api.requests[0]).toMatchObject({ method: "POST", url: "/v1/mod/delivered", body });
    expect(api.requests[0]?.headers["content-type"]).toBe("application/json");
  });
});

describe("a request the local API refuses", () => {
  test("prints its status as JSON and exits 3, with one line", async () => {
    const api = await started();
    api.reply(() => ({ status: 409, text: "Conflict\n- the report names no owned ask\n" }));
    const outcome = await runClient(["/v1/mod/delivered", JSON.stringify(DELIVERED)], lookup(api));
    expect(outcome).toEqual({
      code: CLIENT_EXIT.refused,
      stdout: '{"status":409}\n',
      stderr: "askboard client: the local API answered 409 to POST /v1/mod/delivered\n",
    });
  });
});

describe("a session process that cannot be reached", () => {
  test("exits 1 with one line and nothing on stdout", async () => {
    const outcome = await runClient([pollPath()], lookup(undefined));
    expect(outcome).toEqual({
      code: CLIENT_EXIT.unreachable,
      stdout: "",
      stderr: "askboard client: no session file for this Claude Code process\n",
    });
  });

  test("that does not answer gives up after the request timeout", async () => {
    const api = await started();
    api.reply(() => "hang");
    const outcome = await runClient([pollPath()], { ...lookup(api), timeoutMs: 100 });
    expect(outcome).toEqual({
      code: CLIENT_EXIT.unreachable,
      stdout: "",
      stderr: "askboard client: the session process did not answer within 0.1 s\n",
    });
  });
});

describe("a command line it cannot send", () => {
  test.each([
    ["nothing", []],
    ["an unknown route", ["/v1/mod/push"]],
    ["a route name instead of its path", ["poll"]],
    ["a path with a space", ["/v1/mod/poll?askId=a b"]],
    ["a GET with a body", ["/v1/mod/poll", "{}"]],
    ["a POST with no body", ["/v1/mod/delivered"]],
    ["a POST whose body is not JSON", ["/v1/mod/delivered", "{askId:"]],
    ["one argument too many", ["/v1/mod/delivered", "{}", "{}"]],
  ])("such as %s exits 2 with one line and sends nothing", async (_case, args) => {
    const api = await started();
    const outcome = await runClient(args, lookup(api));
    expect(outcome.code).toBe(CLIENT_EXIT.usage);
    expect(outcome.stdout).toBe("");
    expect(outcome.stderr).toStartWith("askboard client: ");
    expect(outcome.stderr.slice(0, -1)).not.toContain("\n");
    expect(outcome.stderr).toContain("usage: askboard client <path> [<JSON body>]");
    expect(api.requests).toHaveLength(0);
  });
});

describe("clientProcess", () => {
  test("writes the outcome and exits with its code", async () => {
    const api = await started();
    api.reply(() => ({ status: 409, text: "Conflict\n" }));
    const events: string[] = [];
    const output = (name: string): ProcessOutput => ({
      write: (text, done) => {
        events.push(`${name} ${text}`);
        done();
      },
    });
    const io: ModeProcess = {
      stdin: chunks(),
      stdout: output("stdout"),
      stderr: output("stderr"),
      env: api.env,
      ppid: api.key,
      getuid: () => UID,
      exit: (code) => events.push(`exit ${code}`),
    };
    await clientProcess(["/v1/mod/turn", '{"version":"1.0","running":true}'], io);
    expect(events).toEqual([
      'stdout {"status":409}\n',
      "stderr askboard client: the local API answered 409 to POST /v1/mod/turn\n",
      "exit 3",
    ]);
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, rmSync, writeFileSync } from "node:fs";
import {
  HOOK_REQUEST_TIMEOUT_MS,
  LOCAL_API_HOST,
  LOCAL_API_ROUTES,
  SESSION_TOKEN_HEADER,
} from "@askboard/contract";
import {
  HOOK_EVENTS,
  HOOK_INPUT_MAX_BYTES,
  type HookHandler,
  type HookHandlers,
  type HookOptions,
  runHook,
} from "../src/index.ts";
import {
  chunks,
  type FakeApi,
  fakeLocalApi,
  removeRuntimeFolders,
  UID,
  writeSession,
} from "./fake-local-api.ts";

// The hook runner (task 6.2; design decision 6; AD-19): stdin read to its end up to 1 MiB, the
// session file found by the parent's PID, one local API request with a 2 s timeout, and any
// failure ending with exit 0, one stderr line and nothing on stdout. Each hook is tested here
// through stand-in handlers; the hooks' own handlers have their tests beside these.

const apis: FakeApi[] = [];
const started = async (...options: Parameters<typeof fakeLocalApi>) => {
  const api = await fakeLocalApi(...options);
  apis.push(api);
  return api;
};

afterEach(async () => {
  await Promise.all(apis.splice(0).map((api) => api.close()));
  removeRuntimeFolders();
});

const INPUT = { hook_event_name: "PreToolUse", tool_name: "AskUserQuestion", cwd: "/tmp" };

// Every event runs `handler`.
const every = (handler: HookHandler): HookHandlers =>
  Object.fromEntries(HOOK_EVENTS.map((event) => [event, handler])) as unknown as HookHandlers;

// A handler that asks for the rule once and outputs what it got.
const asksTheRule: HookHandler = async ({ localApi }) => {
  const rule = await localApi.exchange(
    { method: "GET", path: LOCAL_API_ROUTES.rule.path },
    "ruleResponse",
  );
  return { output: { rule: rule.rule } };
};

const RULE = { version: "1.0", rule: "always", showable: true };

const options = (api: FakeApi | undefined, extra: Partial<HookOptions> = {}): HookOptions => ({
  stdin: chunks(JSON.stringify(INPUT)),
  env: api?.env ?? { XDG_RUNTIME_DIR: "/nonexistent-askboard-test" },
  uid: UID,
  ppid: api?.key ?? 48_213,
  handlers: every(asksTheRule),
  ...extra,
});

const oneLine = (stderr: string, event = "PreToolUse") => {
  expect(stderr).toStartWith(`askboard hook ${event}: `);
  expect(stderr.endsWith("\n")).toBe(true);
  expect(stderr.slice(0, -1)).not.toContain("\n");
};

describe("the hook input", () => {
  test("is read to its end, across chunks that split a character", async () => {
    let seen: unknown;
    const input = { ...INPUT, tool_input: { question: "Café or tea? ☕ 𝄞" } };
    const bytes = new TextEncoder().encode(JSON.stringify(input));
    const cut = bytes.indexOf(0xe2) + 1;
    const outcome = await runHook("PreToolUse", {
      ...options(undefined),
      stdin: chunks(bytes.slice(0, cut), bytes.slice(cut, cut + 3), bytes.slice(cut + 3)),
      handlers: every(async (context) => {
        seen = context.input;
        return {};
      }),
    });
    expect(seen).toEqual(input);
    expect(outcome).toEqual({ stdout: "", stderr: "" });
  });

  test("of exactly 1 MiB is read", async () => {
    const shell = JSON.stringify({ ...INPUT, pad: "" });
    const pad = "x".repeat(HOOK_INPUT_MAX_BYTES - shell.length);
    const text = JSON.stringify({ ...INPUT, pad });
    expect(Buffer.byteLength(text)).toBe(HOOK_INPUT_MAX_BYTES);
    let size = 0;
    const outcome = await runHook("PreToolUse", {
      ...options(undefined),
      stdin: chunks(text.slice(0, 1000), text.slice(1000)),
      handlers: every(async ({ input }) => {
        size = String(input.pad).length;
        return {};
      }),
    });
    expect(outcome.stderr).toBe("");
    expect(size).toBe(pad.length);
  });

  test("over 1 MiB fails at once, without reading the rest", async () => {
    let read = 0;
    async function* endless() {
      for (;;) {
        read += 1;
        yield new Uint8Array(64 * 1024).fill(0x20);
      }
    }
    let ran = false;
    const outcome = await runHook("PreToolUse", {
      ...options(undefined),
      stdin: endless(),
      handlers: every(async () => {
        ran = true;
        return {};
      }),
    });
    expect(ran).toBe(false);
    expect(read).toBe(17);
    expect(outcome.stdout).toBe("");
    oneLine(outcome.stderr);
    expect(outcome.stderr).toContain("over 1 MiB");
  });

  test.each([
    ["not JSON", "{tool_name: AskUserQuestion"],
    ["an array", "[1, 2]"],
    ["a string", '"PreToolUse"'],
    ["null", "null"],
    ["empty", ""],
  ])("that is %s fails with a line that quotes none of it", async (_case, text) => {
    const outcome = await runHook("PreToolUse", { ...options(undefined), stdin: chunks(text) });
    expect(outcome.stdout).toBe("");
    oneLine(outcome.stderr);
    expect(outcome.stderr).toContain("the hook input is not a JSON object");
    expect(outcome.stderr).not.toContain("AskUserQuestion");
  });
});

describe("the session file", () => {
  test("is the one named by the parent's PID", async () => {
    const first = await started({ key: 4242, token: "Aaaaaaaaaaaaaaaaaaaaaa" });
    const second = await started({ key: 4343, env: first.env, token: "Bbbbbbbbbbbbbbbbbbbbbb" });
    second.reply(() => ({ json: RULE }));
    const outcome = await runHook("PreToolUse", options(second));
    expect(outcome).toEqual({ stdout: `${JSON.stringify({ rule: "always" })}\n`, stderr: "" });
    expect(first.requests).toHaveLength(0);
    expect(second.requests).toHaveLength(1);
    expect(second.requests[0]?.headers[SESSION_TOKEN_HEADER.toLowerCase()]).toBe(
      "Bbbbbbbbbbbbbbbbbbbbbb",
    );
  });

  test("missing leaves the hook with no output and one line", async () => {
    const api = await started({ key: 4242 });
    const outcome = await runHook("PreToolUse", { ...options(api), ppid: 4343 });
    expect(outcome.stdout).toBe("");
    oneLine(outcome.stderr);
    expect(outcome.stderr).toContain("no session file for this Claude Code process");
    expect(api.requests).toHaveLength(0);
  });

  test.each([
    ["not JSON", "{", "is not a session file"],
    ["outside its schema", { sessionToken: "short" }, "is not a session file"],
    ["with a field it does not define", { extra: true }, "is not a session file"],
    ["of another format major", { format: "2.0" }, "version 2.0, which is not supported"],
  ])("%s is no session", async (_case, content, why) => {
    const api = await started({ key: 4242 });
    const text =
      typeof content === "string"
        ? content
        : JSON.stringify({ ...api.session, ...(content as object) });
    writeFileSync(api.file, text);
    const outcome = await runHook("PreToolUse", options(api));
    expect(outcome.stdout).toBe("");
    oneLine(outcome.stderr);
    expect(outcome.stderr).toContain(why);
    expect(api.requests).toHaveLength(0);
  });

  test("naming another key or socket is no session", async () => {
    const api = await started({ key: 4242 });
    writeSession(api.folder, 4242, { ...api.session, key: 4343 });
    const keyed = await runHook("PreToolUse", options(api));
    expect(keyed.stderr).toContain("does not match its name");
    writeSession(api.folder, 4242, { ...api.session, apiAddress: "/tmp/elsewhere.sock" });
    const socketed = await runHook("PreToolUse", options(api));
    expect(socketed.stderr).toContain("does not match its name");
    expect(api.requests).toHaveLength(0);
  });

  test("readable by others, or in a folder others can enter, is not trusted", async () => {
    const api = await started({ key: 4242 });
    chmodSync(api.file, 0o644);
    const file = await runHook("PreToolUse", options(api));
    expect(file.stdout).toBe("");
    expect(file.stderr).toContain("is not private to this user");
    chmodSync(api.file, 0o600);
    chmodSync(api.folder, 0o755);
    const folder = await runHook("PreToolUse", options(api));
    expect(folder.stderr).toContain("is not private to this user");
    expect(api.requests).toHaveLength(0);
  });

  test("with no parent process is not looked for", async () => {
    const outcome = await runHook("PreToolUse", { ...options(undefined), ppid: 0 });
    expect(outcome.stdout).toBe("");
    expect(outcome.stderr).toContain("no session file for this Claude Code process");
  });
});

describe("the local API request", () => {
  test("goes over the socket with the Host, the token and no Origin", async () => {
    const api = await started();
    const posted: HookHandler = async ({ localApi }) => {
      await localApi.exchange(
        { method: "POST", path: LOCAL_API_ROUTES.records.path, body: { a: "é" } },
        "recordsResponse",
      );
      return {};
    };
    const outcome = await runHook("PreToolUse", { ...options(api), handlers: every(posted) });
    expect(outcome).toEqual({ stdout: "", stderr: "" });
    const [request] = api.requests;
    expect(request).toMatchObject({ method: "POST", url: "/v1/records", body: '{"a":"é"}' });
    expect(request?.headers.host).toBe(LOCAL_API_HOST);
    expect(request?.headers[SESSION_TOKEN_HEADER.toLowerCase()]).toBe(api.session.sessionToken);
    expect(request?.headers.origin).toBeUndefined();
    expect(request?.headers["content-type"]).toBe("application/json");
    expect(request?.headers["content-length"]).toBe(String(Buffer.byteLength('{"a":"é"}')));
  });

  test("is one per hook", async () => {
    const api = await started();
    api.reply(() => ({ json: RULE }));
    const twice: HookHandler = async (context) => {
      await asksTheRule(context);
      return asksTheRule(context);
    };
    const outcome = await runHook("PreToolUse", { ...options(api), handlers: every(twice) });
    expect(outcome.stdout).toBe("");
    oneLine(outcome.stderr);
    expect(outcome.stderr).toContain("one local API request");
    expect(api.requests).toHaveLength(1);
  });

  test(
    "unanswered gives up after 2 s",
    async () => {
      const api = await started();
      api.reply(() => "hang");
      const start = performance.now();
      const outcome = await runHook("PreToolUse", options(api));
      const elapsed = performance.now() - start;
      expect(HOOK_REQUEST_TIMEOUT_MS).toBe(2_000);
      expect(elapsed).toBeGreaterThanOrEqual(HOOK_REQUEST_TIMEOUT_MS - 50);
      expect(elapsed).toBeLessThan(HOOK_REQUEST_TIMEOUT_MS + 1_500);
      expect(outcome.stdout).toBe("");
      oneLine(outcome.stderr);
      expect(outcome.stderr).toContain("did not answer within 2 s");
    },
    { timeout: 5_000 },
  );

  test("to a socket no one listens on fails", async () => {
    const api = await started();
    await api.close();
    rmSync(api.socket, { force: true });
    const outcome = await runHook("PreToolUse", options(api));
    expect(outcome.stdout).toBe("");
    oneLine(outcome.stderr);
    expect(outcome.stderr).toContain("could not reach the session process");
  });

  test.each([
    [403, "answered 403"],
    [404, "answered 404"],
    [500, "answered 500"],
  ])("refused with %d fails, naming the status and no more", async (status, why) => {
    const api = await started();
    api.reply(() => ({
      status,
      text: `Refused\n- the session token ${api.session.sessionToken}\n`,
    }));
    const outcome = await runHook("PreToolUse", options(api));
    expect(outcome.stdout).toBe("");
    oneLine(outcome.stderr);
    expect(outcome.stderr).toContain(why);
    expect(outcome.stderr).not.toContain(api.session.sessionToken);
  });

  test("answered with another major fails, naming it", async () => {
    const api = await started();
    api.reply(() => ({ json: { ...RULE, version: "2.0" } }));
    const outcome = await runHook("PreToolUse", options(api));
    expect(outcome.stdout).toBe("");
    oneLine(outcome.stderr);
    expect(outcome.stderr).toContain("2.0");
  });

  test.each([
    ["outside its schema", { json: { ...RULE, rule: "sometimes" } }],
    ["not JSON", { status: 200, text: "{rule" }],
  ])("answered %s fails", async (_case, reply) => {
    const api = await started();
    api.reply(() => reply);
    const outcome = await runHook("PreToolUse", options(api));
    expect(outcome.stdout).toBe("");
    oneLine(outcome.stderr);
    expect(outcome.stderr).toContain("an answer that is not the contract's");
    expect(outcome.stderr).not.toContain("sometimes");
  });

  test("answered with more than 1 MiB fails", async () => {
    const api = await started();
    api.reply(() => ({ status: 200, text: "x".repeat(1024 * 1024 + 1) }));
    const outcome = await runHook("PreToolUse", options(api));
    expect(outcome.stdout).toBe("");
    expect(outcome.stderr).toContain("over 1 MiB");
  });
});

describe("the outcome", () => {
  test("of a handler with output is its JSON on stdout", async () => {
    const outcome = await runHook("SubagentStop", {
      ...options(undefined),
      handlers: every(async () => ({ output: { decision: "block", reason: "AskBoard: …" } })),
    });
    expect(outcome).toEqual({
      stdout: `${JSON.stringify({ decision: "block", reason: "AskBoard: …" })}\n`,
      stderr: "",
    });
  });

  test("of a handler with output and a problem holds both", async () => {
    const outcome = await runHook("PostToolUse", {
      ...options(undefined),
      handlers: every(async () => ({ output: { systemMessage: "AskBoard · x" }, problem: "why" })),
    });
    expect(outcome).toEqual({
      stdout: `${JSON.stringify({ systemMessage: "AskBoard · x" })}\n`,
      stderr: "askboard hook PostToolUse: why\n",
    });
  });

  test("of a handler that throws is one line naming only the error's kind", async () => {
    const outcome = await runHook("PreToolUse", {
      ...options(undefined),
      handlers: every(async () => {
        throw new TypeError("agent text\nover two lines");
      }),
    });
    expect(outcome.stdout).toBe("");
    oneLine(outcome.stderr);
    expect(outcome.stderr).toContain("TypeError");
    expect(outcome.stderr).not.toContain("agent text");
  });

  test.each(["Stop", "preToolUse", "", "UserPromptSubmit\nx"])(
    "of the unknown event %p is one line, with stdin left unread",
    async (event) => {
      let read = false;
      async function* untouched() {
        read = true;
        yield new Uint8Array(0);
      }
      const outcome = await runHook(event, { ...options(undefined), stdin: untouched() });
      expect(read).toBe(false);
      expect(outcome.stdout).toBe("");
      expect(outcome.stderr).toStartWith("askboard hook: ");
      expect(outcome.stderr.slice(0, -1)).not.toContain("\n");
      expect(outcome.stderr).toContain("no hook for the event");
    },
  );

  test("names the three events of hooks.json", () => {
    expect([...HOOK_EVENTS]).toEqual(["PreToolUse", "PostToolUse", "SubagentStop"]);
  });
});

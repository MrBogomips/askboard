import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { request as httpRequest } from "node:http";
import { LOCAL_API_ROUTES, LOCAL_API_VERSION, SESSION_TOKEN_HEADER } from "@askboard/contract";
import { mainAgentRecord } from "@askboard/contract/fixtures";
import { sameToken } from "../../../src/board-host/tokens.ts";
import {
  localRequest,
  post,
  removeRuntimeFolders,
  type TestApi,
  TOKEN,
  testApi,
} from "./helpers.ts";

// Board-host spec, Local API requests (design decision 2, task 4.3): every request carries the
// session token and no `Origin`, a JSON body under 64 KiB valid against its schema at a supported
// major; anything else is refused, and no diagnostic holds a token or agent text.

const BOARD_TOKEN = "pV3xK9qLmT2wR7nB4cYh8A";
const { records, rule, poll } = LOCAL_API_ROUTES;

let run: TestApi;
beforeAll(async () => {
  run = testApi();
  await run.api.start();
});
afterAll(async () => {
  await run.api.close();
  removeRuntimeFolders();
});

const lastDiagnostic = () => run.diagnosed.at(-1) ?? "";

describe("who may ask", () => {
  test("a request with the session token and no Origin is answered", async () => {
    const answer = await localRequest(run.socket, rule.path);
    expect(answer.status).toBe(200);
    expect(answer.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(answer.headers["cache-control"]).toBe("no-store");
  });

  test("a request that carries Origin is refused, even with the right token", async () => {
    for (const origin of ["http://127.0.0.1:47213", "null", ""]) {
      const answer = await localRequest(run.socket, rule.path, { headers: { Origin: origin } });
      expect(answer.status).toBe(403);
    }
    expect(lastDiagnostic()).toBe(`local API ${rule.method} ${rule.path} answered 403`);
  });

  test("a request without the token, with a wrong one or with a board's token is refused", async () => {
    for (const token of [null, "", `${TOKEN}x`, TOKEN.slice(1), BOARD_TOKEN, TOKEN.toLowerCase()]) {
      const answer = await localRequest(run.socket, poll.path, { token });
      expect(answer.status).toBe(403);
      expect(answer.text).not.toContain("pending");
    }
  });

  test("the token is checked before the route, so an unknown route without it is 403", async () => {
    expect((await localRequest(run.socket, "/v1/nothing", { token: null })).status).toBe(403);
    const answer = await localRequest(run.socket, "/v1/nothing");
    expect(answer.status).toBe(404);
    expect(lastDiagnostic()).toBe("local API a request to an unknown route answered 404");
  });

  test("a route asked with another method is unknown", async () => {
    expect((await localRequest(run.socket, records.path)).status).toBe(404);
    expect((await post(run.socket, rule.path, {})).status).toBe(404);
  });

  test("targets that are not a plain path name no route", async () => {
    for (const target of ["//v1/rule", "/v1\\rule", "/v1/rule/"]) {
      expect((await localRequest(run.socket, target)).status).toBe(404);
    }
  });
});

describe("the body", () => {
  test("a valid record is taken", async () => {
    const answer = await post(run.socket, records.path, mainAgentRecord);
    expect(answer.status).toBe(200);
    expect(answer.json()).toEqual({ version: LOCAL_API_VERSION });
  });

  test("a body over 64 KiB is refused without being read to its end", async () => {
    const big = { ...mainAgentRecord, cwd: `/${"a".repeat(64 * 1024)}` };
    const answer = await post(run.socket, records.path, big);
    expect(answer.status).toBe(400);
    expect(answer.text).toContain("64 KiB");
  });

  test("a body over 64 KiB with no length given is refused as it arrives", async () => {
    const answer = await new Promise<number>((resolve, reject) => {
      const sent = httpRequest(
        {
          socketPath: run.socket,
          path: records.path,
          method: "POST",
          headers: { [SESSION_TOKEN_HEADER]: TOKEN, "Transfer-Encoding": "chunked" },
        },
        (response) => {
          response.resume();
          resolve(response.statusCode ?? 0);
        },
      );
      sent.on("error", reject);
      for (let chunk = 0; chunk < 80; chunk += 1) sent.write("x".repeat(1024));
      sent.end();
    });
    expect(answer).toBe(400);
  });

  test("a body that is not JSON is refused", async () => {
    const answer = await localRequest(run.socket, records.path, { method: "POST", raw: "{" });
    expect(answer.status).toBe(400);
    expect(answer.text).toContain("not JSON");
  });

  test("a body outside its schema is refused, naming the problems", async () => {
    const answer = await post(run.socket, records.path, {
      ...mainAgentRecord,
      extra: 1,
      cwd: "rel",
    });
    expect(answer.status).toBe(400);
    expect(answer.text).toContain('unknown field "extra"');
    expect(answer.text).toContain("/cwd");
  });

  test("a body of another major is refused, naming the version supported", async () => {
    const answer = await post(run.socket, records.path, { ...mainAgentRecord, version: "2.0" });
    expect(answer.status).toBe(400);
    expect(answer.text).toContain("supports version 1 (1.0)");
  });
});

describe("diagnostics", () => {
  test("name the route and the status, never a token or agent text", async () => {
    const secret = "toolu_secretText";
    await post(run.socket, records.path, { ...mainAgentRecord, tool_use_id: secret, extra: 1 });
    await localRequest(run.socket, `/v1/${secret}`);
    await localRequest(run.socket, rule.path, { token: BOARD_TOKEN });
    const all = run.diagnosed.join("\n");
    for (const hidden of [TOKEN, BOARD_TOKEN, secret, mainAgentRecord.cwd]) {
      expect(all).not.toContain(hidden);
    }
  });
});

describe("tokens", () => {
  test("are compared in constant time, by length first", () => {
    expect(sameToken(TOKEN, TOKEN)).toBe(true);
    expect(sameToken(TOKEN.slice(1), TOKEN)).toBe(false);
    expect(sameToken(`${TOKEN.slice(0, -1)}B`, TOKEN)).toBe(false);
  });

  test("the session token is 22 base64url characters, fresh for each local API", async () => {
    const { createLocalApi } = await import("../../../src/board-host/index.ts");
    const { newSessionToken } = await import("../../../src/board-host/local-api/index.ts");
    expect(typeof createLocalApi).toBe("function");
    const [a, b] = [newSessionToken(), newSessionToken()];
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(a).not.toBe(b);
  });
});

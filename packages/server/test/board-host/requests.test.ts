import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { connect } from "node:net";
import {
  BOARD_CLOSE_CODES,
  BOARD_PROTOCOL_VERSION,
  BOARD_RESPONSES,
  BOARD_TOKEN_HEADER,
} from "@askboard/contract";
import { fixtureViewManifest } from "@askboard/contract/fixtures";
import {
  type Answer,
  freeRange,
  openSocket,
  QUESTION_TEXT,
  removeViews,
  request,
  startHost,
  type TestHost,
  upgradeStatus,
} from "./helpers.ts";

// Board-host spec: a token per board, the Host and Origin checks and the invalid-link page, plus the
// headers every response carries (task 6.2; AD-11, AD-21, NFR-4).

const version = BOARD_PROTOCOL_VERSION;
const TOKENS = ["aaaaaaaaaaaaaaaaaaaaaA", "bbbbbbbbbbbbbbbbbbbbbB", "cccccccccccccccccccccC"];
const CHUNK = fixtureViewManifest.chunks.shell?.script.sha256 ?? "";

let fixture: TestHost;
let port: number;
let one: { port: number; askId: string; token: string };
let two: { askId: string; token: string };
// A second session process whose asks were discarded at exit, its listener still open.
let ended: TestHost;
let gone: { port: number; askId: string; token: string };

beforeAll(async () => {
  fixture = startHost({ ports: await freeRange(1), tokens: TOKENS.slice(0, 2) });
  one = await fixture.ask("ask-one");
  two = await fixture.ask("ask-two");
  port = one.port;
  ended = startHost({ ports: await freeRange(1), tokens: TOKENS.slice(2) });
  gone = await ended.ask("ask-gone");
  ended.core.discardAll("session-exit");
});

afterAll(async () => {
  await Promise.all([fixture.host.close(), ended.host.close()]);
  removeViews();
});

const boardPath = (askId: string, token?: string) =>
  token === undefined ? `/b/${askId}` : `/b/${askId}?t=${token}`;

const showsNothingOf = (answer: Answer) => {
  expect(answer.body).not.toContain(QUESTION_TEXT);
  expect(answer.body).not.toContain("PostgreSQL");
  expect(answer.body).not.toContain("data-askboard");
  for (const token of TOKENS) expect(answer.body).not.toContain(token);
};

const isAnswer = (answer: Answer, expected: { status: number; contentType: string }) => {
  expect(answer.status).toBe(expected.status);
  expect(answer.headers["content-type"]).toBe(expected.contentType);
};

describe("a token per board", () => {
  test("the link with its own token opens the board page", async () => {
    isAnswer(await request(port, boardPath(one.askId, one.token)), BOARD_RESPONSES.boardPage);
  });

  test("a board page with another ask's token is refused, showing neither ask", async () => {
    const answer = await request(port, boardPath(one.askId, two.token));
    isAnswer(answer, BOARD_RESPONSES.invalidLink);
    showsNothingOf(answer);
  });

  test("a WebSocket with another ask's token is refused and closed, receiving nothing of either ask", async () => {
    const socket = await openSocket(port, one.askId);
    socket.send({ version, type: "connect", token: two.token });
    expect(await socket.next()).toMatchObject({ type: "refused", reason: "token" });
    expect(await socket.closed()).toBe(BOARD_CLOSE_CODES.refused);
    expect(socket.pending).toEqual([]);
  });

  for (const path of ["/m", `/c/${CHUNK}`]) {
    test(`${path} without the token header is refused with 403`, async () => {
      const answer = await request(port, path);
      isAnswer(answer, BOARD_RESPONSES.tokenRefused);
      expect(answer.body).not.toContain("chunks");
      expect(answer.body).not.toContain("askboardShell");
    });

    test(`${path} with a token that opens no board of this session is refused with 403`, async () => {
      for (const token of ["zzzzzzzzzzzzzzzzzzzzzZ", gone.token, ""]) {
        const answer = await request(port, path, { headers: { [BOARD_TOKEN_HEADER]: token } });
        isAnswer(answer, BOARD_RESPONSES.tokenRefused);
        expect(answer.body).not.toContain("chunks");
      }
    });

    test(`${path} with a discarded board's token is refused with 403`, async () => {
      const answer = await request(gone.port, path, {
        headers: { [BOARD_TOKEN_HEADER]: gone.token },
      });
      isAnswer(answer, BOARD_RESPONSES.tokenRefused);
      expect(answer.body).not.toContain("chunks");
    });

    test(`${path} with the token of any open board is served`, async () => {
      for (const token of [one.token, two.token]) {
        const answer = await request(port, path, { headers: { [BOARD_TOKEN_HEADER]: token } });
        expect(answer.status).toBe(200);
      }
    });
  }

  test("no response sets a cookie", async () => {
    const answers = await everyKindOfAnswer();
    for (const answer of answers) expect(answer.headers["set-cookie"]).toBeUndefined();
  });
});

describe("Host and Origin", () => {
  test("a request with a Host that is not a loopback name is refused (DNS rebinding)", async () => {
    for (const host of ["attacker.example", `attacker.example:${port}`, "127.0.0.2", "", "a:b:c"]) {
      const answer = await request(port, boardPath(one.askId, one.token), { host });
      expect(answer.status).toBe(403);
      showsNothingOf(answer);
    }
  });

  test("a request the gate refuses gets the contract's answer for it", async () => {
    for (const options of [
      { host: "attacker.example" },
      { headers: { Origin: "http://attacker.example" } },
      { method: "POST" },
    ]) {
      isAnswer(
        await request(port, boardPath(one.askId, one.token), options),
        BOARD_RESPONSES.refused,
      );
    }
    const path = `/ws/${one.askId}`;
    expect(await upgradeStatus(port, path, { Host: "attacker.example" })).toBe(
      BOARD_RESPONSES.refused.status,
    );
  });

  test("a request without Host is refused", async () => {
    const answer = await request(port, boardPath(one.askId, one.token), { host: null });
    expect(answer.status).not.toBe(200);
    showsNothingOf(answer);
  });

  test("loopback names on any port are served", async () => {
    for (const host of [`localhost:${port}`, "LOCALHOST:9", `[::1]:${port}`, "127.0.0.1"]) {
      const answer = await request(port, boardPath(one.askId, one.token), { host });
      expect(answer.status).toBe(200);
    }
  });

  test("a request whose Origin is not http:// plus its Host is refused", async () => {
    for (const origin of [
      "http://attacker.example",
      `https://127.0.0.1:${port}`,
      `http://localhost:${port}`,
      "null",
    ]) {
      const answer = await request(port, boardPath(one.askId, one.token), {
        headers: { Origin: origin },
      });
      expect(answer.status).toBe(403);
      showsNothingOf(answer);
    }
  });

  test("a GET whose Origin matches its Host is served", async () => {
    const answer = await request(port, boardPath(one.askId, one.token), {
      headers: { Origin: `http://127.0.0.1:${port}` },
    });
    expect(answer.status).toBe(200);
  });

  test("a request other than GET or HEAD without Origin is refused", async () => {
    const answer = await request(port, boardPath(one.askId, one.token), { method: "POST" });
    expect(answer.status).toBe(403);
    showsNothingOf(answer);
  });

  test("a request other than GET or HEAD names no route, even with its Origin", async () => {
    const answer = await request(port, boardPath(one.askId, one.token), {
      method: "POST",
      headers: { Origin: `http://127.0.0.1:${port}` },
    });
    isAnswer(answer, BOARD_RESPONSES.notFound);
    showsNothingOf(answer);
  });

  test("a cross-site WebSocket is refused before any message", async () => {
    const path = `/ws/${one.askId}`;
    const host = `127.0.0.1:${port}`;
    expect(await upgradeStatus(port, path, { Host: host, Origin: "http://attacker.example" })).toBe(
      403,
    );
    expect(await upgradeStatus(port, path, { Host: host })).toBe(403);
    expect(
      await upgradeStatus(port, path, {
        Host: "attacker.example",
        Origin: "http://attacker.example",
      }),
    ).toBe(403);
    expect(await upgradeStatus(port, path, { Host: host, Origin: `http://${host}` })).toBe("open");
  });

  test("an upgrade at a path that is not a board socket is refused", async () => {
    const host = `127.0.0.1:${port}`;
    for (const path of ["/ws/", "/ws/bad id", `/b/${one.askId}`, "/m"]) {
      expect(await upgradeStatus(port, path, { Host: host, Origin: `http://${host}` })).toBe(404);
    }
  });
});

describe("the invalid-link page", () => {
  test("a link without its token says the link is incomplete, showing nothing of the ask", async () => {
    for (const path of [boardPath(one.askId), `${boardPath(one.askId)}?t=`]) {
      const answer = await request(port, path);
      isAnswer(answer, BOARD_RESPONSES.invalidLink);
      expect(answer.body).toContain("incomplete");
      showsNothingOf(answer);
    }
  });

  test("a link with a wrong token or an unknown ask says it opens no board", async () => {
    for (const path of [
      boardPath(one.askId, "zzzzzzzzzzzzzzzzzzzzzZ"),
      boardPath("never-asked", one.token),
    ]) {
      const answer = await request(port, path);
      isAnswer(answer, BOARD_RESPONSES.invalidLink);
      expect(answer.body).toContain("opens no board");
      showsNothingOf(answer);
    }
  });

  test("a discarded ask's link says only that the ask was discarded", async () => {
    const answer = await request(gone.port, boardPath(gone.askId, gone.token));
    isAnswer(answer, BOARD_RESPONSES.discardedLink);
    expect(answer.body).toContain("discarded");
    showsNothingOf(answer);
  });

  test("a discarded ask's link with a wrong token opens no board", async () => {
    const answer = await request(gone.port, boardPath(gone.askId, one.token));
    isAnswer(answer, BOARD_RESPONSES.invalidLink);
    showsNothingOf(answer);
  });

  test("a discarded ask's token no longer opens its socket", async () => {
    const socket = await openSocket(gone.port, gone.askId);
    socket.send({ version, type: "connect", token: gone.token });
    expect(await socket.next()).toMatchObject({ type: "refused", reason: "token" });
    expect(await socket.closed()).toBe(BOARD_CLOSE_CODES.refused);
  });
});

describe("every response", () => {
  test("sends no-referrer and nosniff", async () => {
    for (const answer of await everyKindOfAnswer()) {
      expect(answer.headers["referrer-policy"]).toBe("no-referrer");
      expect(answer.headers["x-content-type-options"]).toBe("nosniff");
    }
  });
});

// One answer of every kind the listener gives, refusals included.
const everyKindOfAnswer = async (): Promise<Answer[]> => [
  await request(port, boardPath(two.askId, two.token)),
  await request(port, boardPath(two.askId, two.token), { method: "HEAD" }),
  await request(port, boardPath(two.askId)),
  await request(port, boardPath(two.askId, one.token)),
  await request(gone.port, boardPath(gone.askId, gone.token)),
  await request(port, "/m", { headers: { [BOARD_TOKEN_HEADER]: two.token } }),
  await request(port, "/m"),
  await request(port, `/c/${CHUNK}`, { headers: { [BOARD_TOKEN_HEADER]: two.token } }),
  await request(port, `/c/${"0".repeat(64)}`, { headers: { [BOARD_TOKEN_HEADER]: two.token } }),
  await request(port, "/nowhere"),
  await request(port, "/", { host: "attacker.example" }),
  await request(port, "/m", { method: "POST" }),
];

describe("request targets that are not URLs", () => {
  // `new URL` throws on these: a backslash is a slash to it, and `[` starts an IPv6 host.
  const targets = ["/\\[", "/\\\\[x", "/b/\\[?t=x"];

  test("name no route over HTTP, and fail nothing", async () => {
    for (const target of targets) {
      const answer = await request(port, target);
      expect(answer.status).toBe(BOARD_RESPONSES.notFound.status);
    }
    expect(fixture.reported).toEqual([]);
  });

  test("are refused as upgrades, and the listener keeps serving", async () => {
    for (const target of targets) {
      expect(await rawUpgradeStatus(port, target)).toBe(404);
    }
    expect((await request(port, boardPath(one.askId, one.token))).status).toBe(200);
    expect(fixture.reported).toEqual([]);
  });
});

// The status line of an upgrade sent byte for byte, so the request target reaches the host as is.
const rawUpgradeStatus = (to: number, target: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const host = `127.0.0.1:${to}`;
    const socket = connect({ host: "127.0.0.1", port: to }, () => {
      socket.write(
        [
          `GET ${target} HTTP/1.1`,
          `Host: ${host}`,
          `Origin: http://${host}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
          "Sec-WebSocket-Version: 13",
          "",
          "",
        ].join("\r\n"),
      );
    });
    socket.once("data", (data) => {
      socket.destroy();
      resolve(Number(/^HTTP\/1\.1 (\d{3})/.exec(String(data))?.[1] ?? 0));
    });
    socket.once("error", reject);
  });

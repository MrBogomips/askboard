import { describe, expect, test } from "bun:test";
import {
  ASK_TITLE_MAX_CHARS,
  BOARD_CLOSE_CODES,
  BOARD_HOST,
  BOARD_PORT_RANGE,
  BOARD_RESPONSES,
  BOARD_ROUTES,
  BOARD_TOKEN_BYTES,
  BOARD_TOKEN_HEADER,
  BOARD_TOKEN_MAX_CHARS,
  BOARD_TOKEN_MIN_BITS,
  BOARD_TOKEN_PATTERN,
  BOARD_TOKEN_QUERY,
  boardLink,
  boardPath,
  COLLECT_MAX_WAIT_MS,
  COLLECT_PROGRESS_INTERVAL_MS,
  chunkPath,
  cspHashSource,
  ERROR_TEXT_MAX_CHARS,
  ID_PATTERN,
  manifestPath,
  parseBoardRoute,
  REFUSAL_DETAIL_MAX_CHARS,
  RESULT_MAX_CHARS,
  socketPath,
  TITLE_MAX_CHARS,
  UTC_TIME_PATTERN,
  VIEW_DIRECTORY,
  VIEW_ID_PREFIX,
  VIEW_MANIFEST_FILE,
} from "../src/index.ts";
import boardDocument from "../src/schemas/board-document/board-document.json";
import connect from "../src/schemas/board-protocol/connect.json";
import refused from "../src/schemas/board-protocol/refused.json";
import time from "../src/schemas/board-protocol/time.json";
import id from "../src/schemas/input/id.json";

// From the approved example results/plain-choice.json.
const EXAMPLE_LINK = "http://127.0.0.1:47213/b/order-db-choice-x7k2?t=pV3xK9qLmT2wR7nB4cYh8A";
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("shared constants (contract spec; design decisions 2 and 5)", () => {
  test("collect waits at most 20 minutes and sends progress every 60 s", () => {
    expect(COLLECT_MAX_WAIT_MS).toBe(20 * 60 * 1000);
    expect(COLLECT_PROGRESS_INTERVAL_MS).toBe(60 * 1000);
  });

  test("results stay within 30,000 characters and error texts within 4,000", () => {
    expect(RESULT_MAX_CHARS).toBe(30_000);
    expect(ERROR_TEXT_MAX_CHARS).toBe(4_000);
  });

  test("a derived title is cut at 80 characters", () => {
    expect(TITLE_MAX_CHARS).toBe(80);
  });

  test("the default port range is 47200 to 47299, which holds the examples' port", () => {
    expect(BOARD_PORT_RANGE).toEqual({ first: 47200, last: 47299 });
    expect(47213).toBeGreaterThanOrEqual(BOARD_PORT_RANGE.first);
    expect(47213).toBeLessThanOrEqual(BOARD_PORT_RANGE.last);
    expect(BOARD_HOST).toBe("127.0.0.1");
  });

  test("a token draws at least 128 bits, as 22 base64url characters", () => {
    expect(BOARD_TOKEN_MIN_BITS).toBe(128);
    expect(BOARD_TOKEN_BYTES * 8).toBeGreaterThanOrEqual(BOARD_TOKEN_MIN_BITS);
    const drawn = Buffer.from(new Uint8Array(BOARD_TOKEN_BYTES).fill(255)).toString("base64url");
    expect(drawn).toHaveLength(22);
    expect(new RegExp(BOARD_TOKEN_PATTERN).test(drawn)).toBe(true);
    expect(new RegExp(BOARD_TOKEN_PATTERN).test("pV3xK9qLmT2wR7nB4cYh8A")).toBe(true);
    expect(new RegExp(BOARD_TOKEN_PATTERN).test("pV3xK9qLmT2wR7nB4cYh8")).toBe(false);
  });

  test("the schemas use the constants' patterns and limits", () => {
    expect(id.pattern).toBe(ID_PATTERN);
    expect(connect.properties.token.pattern).toBe(BOARD_TOKEN_PATTERN);
    expect(connect.properties.token.maxLength).toBe(BOARD_TOKEN_MAX_CHARS);
    expect(refused.properties.detail.maxLength).toBe(REFUSAL_DETAIL_MAX_CHARS);
    expect(boardDocument.properties.title.maxLength).toBe(ASK_TITLE_MAX_CHARS);
    expect(time.pattern).toBe(UTC_TIME_PATTERN);
  });

  test("a token is at most 256 characters, a refusal's detail 1,000 and a title 256", () => {
    expect(BOARD_TOKEN_MAX_CHARS).toBe(256);
    expect(REFUSAL_DETAIL_MAX_CHARS).toBe(1_000);
    expect(ASK_TITLE_MAX_CHARS).toBe(256);
    expect(ASK_TITLE_MAX_CHARS).toBeGreaterThanOrEqual(TITLE_MAX_CHARS);
  });

  test("a UTC time is RFC 3339 with Z, each field within its range", () => {
    const utc = new RegExp(UTC_TIME_PATTERN);
    for (const good of [
      "2026-10-29T09:41:27Z",
      "2026-10-29T09:41:27.123Z",
      "2026-01-01T00:00:00Z",
      "2026-12-31T23:59:59.999999999Z",
      new Date(0).toISOString(),
    ]) {
      expect({ good, ok: utc.test(good) }).toEqual({ good, ok: true });
    }
    for (const bad of [
      "2026-10-29T11:41:27+02:00",
      "2026-10-29 09:41:27Z",
      "2026-10-29t09:41:27z",
      "2026-00-29T09:41:27Z",
      "2026-13-29T09:41:27Z",
      "2026-10-00T09:41:27Z",
      "2026-10-32T09:41:27Z",
      "2026-10-29T24:00:00Z",
      "2026-10-29T09:60:27Z",
      "2026-10-29T09:41:60Z",
      "2026-10-29T09:41:27.Z",
      "2026-10-29T09:41:27.1234567890Z",
      "2026-10-29",
    ]) {
      expect({ bad, ok: utc.test(bad) }).toEqual({ bad, ok: false });
    }
  });

  test("view-made IDs start with u-, and the view build's manifest has a fixed place", () => {
    expect(VIEW_ID_PREFIX).toBe("u-");
    expect(`${VIEW_DIRECTORY}/${VIEW_MANIFEST_FILE}`).toBe("view/manifest.json");
  });
});

describe("board routes and the token header (design decision 5)", () => {
  test("the routes and the token's places", () => {
    expect(BOARD_ROUTES).toEqual({ board: "/b/", chunk: "/c/", manifest: "/m", socket: "/ws/" });
    expect(manifestPath()).toBe("/m");
    expect(BOARD_TOKEN_QUERY).toBe("t");
    expect(BOARD_TOKEN_HEADER).toBe("X-AskBoard-Token");
    expect(boardPath("order-db-choice-x7k2")).toBe("/b/order-db-choice-x7k2");
    expect(chunkPath(EMPTY_SHA256)).toBe(`/c/${EMPTY_SHA256}`);
    expect(socketPath("order-db-choice-x7k2")).toBe("/ws/order-db-choice-x7k2");
  });

  test("the board link is the approved example's", () => {
    const link = boardLink({
      port: 47213,
      askId: "order-db-choice-x7k2",
      token: "pV3xK9qLmT2wR7nB4cYh8A",
    });
    expect(link).toBe(EXAMPLE_LINK);
  });

  test("a request path names its route, or none", () => {
    expect(parseBoardRoute("/b/order-db-choice-x7k2")).toEqual({
      kind: "board",
      askId: "order-db-choice-x7k2",
    });
    expect(parseBoardRoute(`/c/${EMPTY_SHA256}`)).toEqual({ kind: "chunk", sha256: EMPTY_SHA256 });
    expect(parseBoardRoute("/ws/order-db-choice-x7k2")).toEqual({
      kind: "socket",
      askId: "order-db-choice-x7k2",
    });
    expect(parseBoardRoute("/m")).toEqual({ kind: "manifest" });
    for (const path of [
      "/",
      "/m/",
      "/mx",
      "/m/order-db-choice-x7k2",
      "/m?t=x",
      "/manifest.json",
      "/b/",
      "/b/order db",
      `/b/${"x".repeat(65)}`,
      "/b/a/b",
      "/c/ABC",
      `/c/${EMPTY_SHA256.toUpperCase()}`,
      "/ws/../b/x",
      "/x/order-db-choice-x7k2",
      "/b/order-db-choice-x7k2?t=x",
    ]) {
      expect({ path, route: parseBoardRoute(path) }).toEqual({ path, route: undefined });
    }
  });
});

describe("what each HTTP route answers (design decision 5)", () => {
  const html = "text/html; charset=utf-8";
  const text = "text/plain; charset=utf-8";

  test("the board page, the invalid-link page and a discarded ask's link", () => {
    expect(BOARD_RESPONSES.boardPage).toEqual({ status: 200, contentType: html });
    expect(BOARD_RESPONSES.invalidLink).toEqual({ status: 403, contentType: html });
    expect(BOARD_RESPONSES.discardedLink).toEqual({ status: 410, contentType: html });
  });

  test("the manifest as JSON, a chunk's script and styles, and the refusals", () => {
    expect(BOARD_RESPONSES.manifest).toEqual({
      status: 200,
      contentType: "application/json; charset=utf-8",
    });
    expect(BOARD_RESPONSES.script).toEqual({
      status: 200,
      contentType: "text/javascript; charset=utf-8",
    });
    expect(BOARD_RESPONSES.style).toEqual({ status: 200, contentType: "text/css; charset=utf-8" });
    expect(BOARD_RESPONSES.tokenRefused).toEqual({ status: 403, contentType: text });
    expect(BOARD_RESPONSES.notFound).toEqual({ status: 404, contentType: text });
  });

  test("a request the Host or Origin check refuses, on any route (Track A's request 1)", () => {
    expect(BOARD_RESPONSES.refused).toEqual({ status: 403, contentType: text });
  });
});

describe("WebSocket close codes (design decision 5)", () => {
  test("board-host closes after a refusal before connect, after moved and after discarded", () => {
    expect(BOARD_CLOSE_CODES).toEqual({ refused: 4403, moved: 4409, discarded: 4410 });
  });

  test("each is an application code, 4000 plus the HTTP status that says the same", () => {
    for (const code of Object.values(BOARD_CLOSE_CODES)) {
      expect(code).toBeGreaterThanOrEqual(4000);
      expect(code).toBeLessThanOrEqual(4999);
    }
    expect(BOARD_CLOSE_CODES.refused - 4000).toBe(BOARD_RESPONSES.tokenRefused.status);
    expect(BOARD_CLOSE_CODES.discarded - 4000).toBe(BOARD_RESPONSES.discardedLink.status);
  });
});

describe("CSP hash sources from the manifest's hex digests", () => {
  test("a digest becomes its base64 hash source", () => {
    expect(cspHashSource(EMPTY_SHA256)).toBe(
      "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
    );
    const digest = new Bun.CryptoHasher("sha256").update("console.log(1)").digest();
    const expected = `'sha256-${Buffer.from(digest).toString("base64")}'`;
    expect(cspHashSource(Buffer.from(digest).toString("hex"))).toBe(expected);
  });

  test("anything but 64 lowercase hex digits is refused", () => {
    for (const bad of ["", "abc", EMPTY_SHA256.toUpperCase(), `${EMPTY_SHA256}0`]) {
      expect(() => cspHashSource(bad)).toThrow("SHA-256");
    }
  });
});

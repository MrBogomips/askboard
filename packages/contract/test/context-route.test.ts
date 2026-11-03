import { describe, expect, test } from "bun:test";
import { fixtureViewManifest } from "../src/fixtures/index.ts";
import {
  BOARD_RESPONSES,
  BOARD_ROUTES,
  boardPagePolicy,
  cspHashSource,
  parseBoardRoute,
  SOURCE_SCHEME_QUERY,
  sourcePath,
  sourceViewPolicy,
} from "../src/index.ts";

// The source view's route, its answer and its policy, and the board page's frame source (excerpts,
// task 1.6; contract spec: The source view route, The source view's policy).
const ASK = "payment-retry-fix-q4m8";
const ITEM = "retry-src";
const STYLE = "a".repeat(64);

describe("the source view's route", () => {
  test("is GET /s/<askId>/<itemId>, its scheme in the query beside the token", () => {
    expect(BOARD_ROUTES.source).toBe("/s/");
    expect(SOURCE_SCHEME_QUERY).toBe("scheme");
    expect(sourcePath(ASK, ITEM)).toBe(`/s/${ASK}/${ITEM}`);
    expect(parseBoardRoute(sourcePath(ASK, ITEM))).toEqual({
      kind: "source",
      askId: ASK,
      itemId: ITEM,
    });
  });

  test.each([
    `/s/${ASK}/../m`,
    `/s/${ASK}`,
    `/s/${ASK}/`,
    `/s/${ASK}/${ITEM}/x`,
    `/s/%2e%2e/${ITEM}`,
    `/s/${ASK}/%2e%2e`,
    `/s//${ITEM}`,
    `/s/${ASK}/a%2fb`,
    `/s/${ASK}/${"x".repeat(65)}`,
    "/s/",
    "/s",
    `/source/${ASK}/${ITEM}`,
  ])("%s names no route", (path) => {
    expect(parseBoardRoute(path)).toBeUndefined();
  });

  test("E1's routes still parse as before", () => {
    expect(parseBoardRoute(`/b/${ASK}`)).toEqual({ kind: "board", askId: ASK });
    expect(parseBoardRoute(`/ws/${ASK}`)).toEqual({ kind: "socket", askId: ASK });
    expect(parseBoardRoute("/m")).toEqual({ kind: "manifest" });
  });

  test("answers the source view as HTML with 200; its refusals are E1's", () => {
    expect(BOARD_RESPONSES.sourceView).toEqual({
      status: 200,
      contentType: "text/html; charset=utf-8",
    });
    expect(BOARD_RESPONSES.tokenRefused.status).toBe(403);
    expect(BOARD_RESPONSES.discardedLink.status).toBe(410);
    expect(BOARD_RESPONSES.notFound.status).toBe(404);
  });
});

describe("the source view's policy", () => {
  test("is exactly AD-8's directives with base-uri and form-action 'none', its style by hash", () => {
    expect(sourceViewPolicy(STYLE)).toBe(
      `default-src 'none'; style-src ${cspHashSource(STYLE)}; img-src data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'`,
    );
  });

  test("names no script source, no unsafe keyword and no host", () => {
    const policy = sourceViewPolicy(STYLE);
    expect(policy).not.toContain("script-src");
    expect(policy).not.toContain("unsafe-");
    expect(policy).not.toMatch(/https?:|\*|localhost|127\.0\.0\.1/);
  });

  test("refuses a style hash that is not lowercase hex SHA-256", () => {
    expect(() => sourceViewPolicy("A".repeat(64))).toThrow();
    expect(() => sourceViewPolicy("abc")).toThrow();
  });
});

describe("the board page's policy", () => {
  test("frames only its own origin, the reading panel's source view, before base-uri", () => {
    const parts = boardPagePolicy(fixtureViewManifest).split("; ");
    expect(parts).toHaveLength(10);
    expect(parts.filter((part) => part.startsWith("frame-src"))).toEqual(["frame-src 'self'"]);
    expect(parts.indexOf("frame-src 'self'")).toBe(parts.indexOf("base-uri 'self'") - 1);
  });
});

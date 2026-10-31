import { describe, expect, test } from "bun:test";
import { BOARD_RESPONSES, BOARD_TOKEN_HEADER } from "@askboard/contract";
import { fixtureViewManifest, PLAIN_CHOICE } from "@askboard/contract/fixtures";
import { answerHttp, type BoardAccess, toResponse } from "./http.ts";
import { boardPagePolicy } from "./policy.ts";
import { fixtureViewBuild } from "./view-build.ts";

const view = fixtureViewBuild();
const { askId, token } = PLAIN_CHOICE;
const open: BoardAccess = { askId, token, state: "open" };
const shell = fixtureViewManifest.chunks.shell;
if (shell === undefined) throw new Error("the fixture manifest has no shell");
const style = shell.styles[0];
if (style === undefined) throw new Error("the fixture shell has no styles");

const get = (
  path: string,
  options: { token?: string; method?: string; access?: BoardAccess } = {},
) =>
  answerHttp(
    {
      method: options.method ?? "GET",
      url: `http://127.0.0.1:47213${path}`,
      headers: new Headers(
        options.token === undefined ? {} : { [BOARD_TOKEN_HEADER]: options.token },
      ),
    },
    view,
    options.access ?? open,
  );

const kind = (answer: ReturnType<typeof get>) => ({
  status: answer.status,
  contentType: answer.headers["Content-Type"],
});

describe("answerHttp: each route answers as BOARD_RESPONSES says", () => {
  test("the board page, for the board's link with its token, under its policy", () => {
    const answer = get(`/b/${askId}?t=${token}`);
    expect(kind(answer)).toEqual(BOARD_RESPONSES.boardPage);
    expect(answer.body).toBe(view.files.get(fixtureViewManifest.boardPage.html.path) ?? "");
    expect(answer.headers["Content-Security-Policy"]).toBe(boardPagePolicy(view.manifest));
  });

  test.each([
    ["without t", `/b/${askId}`],
    ["with a wrong token", `/b/${askId}?t=${"x".repeat(22)}`],
    ["for another ask", `/b/another-ask?t=${token}`],
  ])("the invalid-link page %s", (_, path) => {
    const answer = get(path);
    expect(kind(answer)).toEqual(BOARD_RESPONSES.invalidLink);
    expect(answer.body).not.toContain(askId);
  });

  test("the discarded page for the link once the session has exited", () => {
    const answer = get(`/b/${askId}?t=${token}`, { access: { ...open, state: "discarded" } });
    expect(kind(answer)).toEqual(BOARD_RESPONSES.discardedLink);
    expect(answer.body).toContain("discarded");
  });

  test("the invalid-link page once a restart has forgotten the token", () => {
    const answer = get(`/b/${askId}?t=${token}`, { access: { ...open, state: "unknown" } });
    expect(kind(answer)).toEqual(BOARD_RESPONSES.invalidLink);
  });

  test("the manifest's bytes as written, with the token header", () => {
    const answer = get("/m", { token });
    expect(kind(answer)).toEqual(BOARD_RESPONSES.manifest);
    expect(answer.body).toBe(view.manifestText);
  });

  test("a chunk's script and a chunk's style by their SHA-256, with the token header", () => {
    const script = get(`/c/${shell.script.sha256}`, { token });
    expect(kind(script)).toEqual(BOARD_RESPONSES.script);
    expect(script.body).toBe(view.files.get(shell.script.path) ?? "");
    const css = get(`/c/${style.sha256}`, { token });
    expect(kind(css)).toEqual(BOARD_RESPONSES.style);
    expect(css.body).toBe(view.files.get(style.path) ?? "");
  });

  test.each([
    ["the manifest without the token header", "/m", undefined, open],
    ["the manifest with another token", "/m", "x".repeat(22), open],
    ["a chunk without the token header", `/c/${shell.script.sha256}`, undefined, open],
    ["an unknown hash without the token header", `/c/${"0".repeat(64)}`, undefined, open],
    ["the manifest after the session exited", "/m", token, { ...open, state: "discarded" }],
    ["a chunk after a restart", `/c/${shell.script.sha256}`, token, { ...open, state: "unknown" }],
  ] as const)("403 for %s, checked first", (_, path, presented, access) => {
    const answer = get(path, { token: presented, access });
    expect(kind(answer)).toEqual(BOARD_RESPONSES.tokenRefused);
    expect(answer.body).not.toContain("chunks");
  });

  test.each([
    ["an unknown hash", `/c/${"0".repeat(64)}`],
    ["a path that names no route", "/favicon.ico"],
    ["the socket route without an upgrade", `/ws/${askId}`],
    ["a hash that is not lowercase hex", `/c/${shell.script.sha256.toUpperCase()}`],
  ])("404 for %s", (_, path) => {
    expect(kind(get(path, { token }))).toEqual(BOARD_RESPONSES.notFound);
  });

  test("404 for a method other than GET and HEAD", () => {
    expect(kind(get(`/b/${askId}?t=${token}`, { method: "POST" }))).toEqual(
      BOARD_RESPONSES.notFound,
    );
  });

  test("every answer says nosniff and no-referrer, and none sets a cookie", () => {
    const answers = [
      get(`/b/${askId}?t=${token}`),
      get(`/b/${askId}`),
      get("/m", { token }),
      get("/m"),
      get(`/c/${shell.script.sha256}`, { token }),
      get("/nothing"),
    ];
    for (const answer of answers) {
      expect(answer.headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(answer.headers["Referrer-Policy"]).toBe("no-referrer");
      expect(Object.keys(answer.headers).map((name) => name.toLowerCase())).not.toContain(
        "set-cookie",
      );
    }
  });
});

describe("toResponse", () => {
  test("carries the status, the headers and the body, and no body for HEAD", async () => {
    const answer = get("/m", { token });
    const response = toResponse(answer, "GET");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(BOARD_RESPONSES.manifest.contentType);
    expect(await response.text()).toBe(view.manifestText);
    expect(await toResponse(answer, "HEAD").text()).toBe("");
  });
});

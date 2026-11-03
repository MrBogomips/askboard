import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  BOARD_RESPONSES,
  BOARD_TOKEN_HEADER,
  type LifecycleBoardDocument,
  sourcePath,
} from "@askboard/contract";
import { contextBoardDocument } from "@askboard/contract/fixtures";
import type { Source, SourceText } from "@askboard/core";
import { type BoardHost, createBoardHost } from "../../src/board-host/index.ts";
import { PLAIN_POLICY } from "../../src/board-host/pages.ts";
import { SOURCE_VIEW_POLICY } from "../../src/board-host/source-view.ts";
import { fakeHostCore, type OpenView } from "./fake-core.ts";
import { type Answer, freeRange, removeViews, request, writeView } from "./helpers.ts";

// The source view's route (excerpts, task 5.2; design decision 5, Route; board-host spec, "The
// source view", "Without the board's token", "An item that is not a pointer", "A missing or binary
// file"), against a fake core whose two pointer items have a source.

const ASK = contextBoardDocument.askId;
const OTHER = "other-ask-k2m9";
const TOKEN = "source-view-token-aaaaa";
const OTHER_TOKEN = "other-ask-token-bbbbbbb";

const contextView: OpenView = {
  askId: ASK,
  state: "waiting",
  document: contextBoardDocument as unknown as LifecycleBoardDocument,
  questions: contextBoardDocument.items.map(({ id }) => ({
    itemId: id,
    rev: 1,
    state: "open",
    thread: [],
  })),
};

const fake = fakeHostCore({ view: contextView });
const asked: string[] = [];
const reported: unknown[] = [];
let current: SourceText | (() => Promise<SourceText>) = { status: "available", text: "" };

// The excerpt and the file reference of the fixture's first question have a source.
const PATHS: Readonly<Record<string, string>> = {
  "retry-adr": "docs/adr/0012-payment-retries.md",
  "retry-src": "src/retry.ts",
};

const sourceOf = (askId: string, itemId: string): Source | undefined => {
  asked.push(`${askId}/${itemId}`);
  const path = askId === ASK ? PATHS[itemId] : undefined;
  if (path === undefined) return undefined;
  return {
    path,
    state: async () => ({ status: "available" }),
    text: async () => (typeof current === "function" ? current() : current),
  };
};

let host: BoardHost;
let port: number;

beforeAll(async () => {
  const tokens = [TOKEN, OTHER_TOKEN];
  host = createBoardHost({
    core: () => ({ ...fake.core, sourceOf }),
    view: writeView(),
    report: (error) => reported.push(error),
    ports: await freeRange(1),
    token: () => tokens.shift() ?? "spare-token-ccccccccccc",
  });
  port = Number(new URL(await host.address.link(ASK)).port);
  await host.address.link(OTHER);
});

afterAll(async () => {
  await host.close();
  removeViews();
});

beforeEach(() => {
  fake.view = contextView;
  current = { status: "available", text: "" };
  asked.length = 0;
  reported.length = 0;
});

const get = (itemId: string, query = `?t=${TOKEN}`, options: Parameters<typeof request>[2] = {}) =>
  request(port, `${sourcePath(ASK, itemId)}${query}`, options);

const common = (answer: Answer) => {
  expect(answer.headers["x-content-type-options"]).toBe("nosniff");
  expect(answer.headers["referrer-policy"]).toBe("no-referrer");
  expect(answer.headers["cache-control"]).toBe("no-store");
  expect(answer.headers["set-cookie"]).toBeUndefined();
};

const plain = (answer: Answer, status: number) => {
  expect(answer.status).toBe(status);
  expect(answer.headers["content-type"]).toBe("text/plain; charset=utf-8");
  expect(answer.headers["content-security-policy"]).toBe(PLAIN_POLICY);
  common(answer);
};

describe("a pointer item of the ask the token opens", () => {
  test("the page, with the source view's policy", async () => {
    current = {
      status: "available",
      text: "## Decision\n<script>x</script>",
      hit: { start: 1, end: 1 },
    };
    const answer = await get("retry-adr");
    expect(answer.status).toBe(BOARD_RESPONSES.sourceView.status);
    expect(answer.headers["content-type"]).toBe(BOARD_RESPONSES.sourceView.contentType);
    expect(answer.headers["content-security-policy"]).toBe(SOURCE_VIEW_POLICY);
    common(answer);
    expect(answer.body).toContain("<title>docs/adr/0012-payment-retries.md</title>");
    expect(answer.body).toContain('<span id="L1" class="line hit">');
    expect(answer.body).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(asked).toEqual([`${ASK}/retry-adr`]);
  });

  test.each([
    [{ status: "missing" }, "This file is not available: src/retry.ts"],
    [{ status: "outside-root" }, "This file is not available: src/retry.ts"],
    [{ status: "not-text" }, "This file cannot be shown as text: src/retry.ts"],
    [{ status: "too-large", size: 4_000_000 }, "too large to show here: src/retry.ts"],
  ] as const)("%o: the page says so with the path", async (source, line) => {
    current = source;
    const answer = await get("retry-src");
    expect(answer.status).toBe(200);
    expect(answer.headers["content-security-policy"]).toBe(SOURCE_VIEW_POLICY);
    expect(answer.body.replace(/<[^>]*>/g, "")).toContain(line);
    expect(answer.body).not.toContain('class="line');
  });

  test.each([
    ["light", ' data-scheme="light"'],
    ["dark", ' data-scheme="dark"'],
    ["blue", ""],
  ])("scheme=%s", async (scheme, attribute) => {
    const answer = await get("retry-adr", `?t=${TOKEN}&scheme=${scheme}`);
    expect(answer.body).toContain(`<html lang="en"${attribute}>`);
  });

  test("HEAD: the same headers, and no body", async () => {
    current = { status: "available", text: "one\ntwo" };
    const whole = await get("retry-adr");
    const head = await get("retry-adr", `?t=${TOKEN}`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.body).toBe("");
    expect(head.headers["content-length"]).toBe(whole.headers["content-length"]);
    expect(head.headers["content-security-policy"]).toBe(SOURCE_VIEW_POLICY);
    common(head);
  });

  test("a read that fails is reported and answered 500 with nothing of the file", async () => {
    current = () => Promise.reject(new Error("EIO"));
    const answer = await get("retry-adr");
    plain(answer, 500);
    expect(reported).toEqual([new Error("EIO")]);
  });
});

describe("refusals, as plain text with nothing of the file", () => {
  test.each([
    ["no t", ""],
    ["an empty t", "?t="],
    ["another ask's token", `?t=${OTHER_TOKEN}`],
    ["a made-up token", "?t=made-up-token-dddddddd"],
  ])("%s: 403", async (_, query) => {
    const answer = await get("retry-adr", query);
    plain(answer, BOARD_RESPONSES.tokenRefused.status);
    expect(asked).toEqual([]);
  });

  test("the token in the header only: 403", async () => {
    const answer = await get("retry-adr", "", { headers: { [BOARD_TOKEN_HEADER]: TOKEN } });
    plain(answer, 403);
  });

  test("a discarded ask: 410", async () => {
    fake.view = { askId: ASK, state: "discarded" };
    plain(await get("retry-adr"), BOARD_RESPONSES.discardedLink.status);
    expect(asked).toEqual([]);
  });

  test.each([
    ["an image", "shot"],
    ["an agent-written excerpt", "settings-note"],
    ["a web reference", "pr"],
    ["an unknown item", "nope"],
  ])("%s: 404", async (_, itemId) => {
    plain(await get(itemId), BOARD_RESPONSES.notFound.status);
  });

  test.each([
    ["a third segment", `${sourcePath(ASK, "retry-adr")}/x`],
    ["an encoded ID", `/s/${ASK}/%72etry-adr`],
    ["a dot segment", `/s/${ASK}/%2e%2e`],
  ])("%s names no route: 404", async (_, path) => {
    plain(await request(port, `${path}?t=${TOKEN}`), 404);
    expect(asked).toEqual([]);
  });

  test.each([
    ["a non-loopback Host", (at: number) => ({ host: `evil.example:${at}` })],
    ["a foreign Origin", (at: number) => ({ headers: { Origin: `http://localhost:${at}` } })],
  ])("%s: the gate refuses it before anything", async (_, options) => {
    plain(await get("retry-adr", `?t=${TOKEN}`, options(port)), BOARD_RESPONSES.refused.status);
    expect(asked).toEqual([]);
  });
});

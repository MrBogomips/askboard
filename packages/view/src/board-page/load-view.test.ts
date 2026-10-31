import { describe, expect, test } from "bun:test";
import {
  BOARD_TOKEN_HEADER,
  type BoardState,
  VIEW_MANIFEST_FILE,
  type ViewManifest,
} from "@askboard/contract";
import {
  fixtureViewFiles,
  fixtureViewManifest,
  PLAIN_CHOICE,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import { assemble, selectChunks, sourcesToFetch } from "../assemble/index.ts";
import { type FetchText, loadView } from "./load-view.ts";

const waiting: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};
const data = { document: plainChoiceBoardDocument, state: waiting };
const { token } = PLAIN_CHOICE;

const byHash = (manifest: ViewManifest) =>
  new Map(
    Object.values(manifest.chunks)
      .flatMap((chunk) => [chunk.script, ...chunk.styles])
      .map((file) => [file.sha256, file.path]),
  );

type Request = { readonly url: string; readonly token: string | undefined };

// `board-host` as the board page sees it: the manifest at /m and each file by its hash at /c/.
const fakeHost = (manifestText = fixtureViewFiles[VIEW_MANIFEST_FILE] ?? "") => {
  const requests: Request[] = [];
  const paths = byHash(fixtureViewManifest);
  const fetchText: FetchText = async (url, headers) => {
    requests.push({ url, token: headers[BOARD_TOKEN_HEADER] });
    if (url === "/m") return { status: 200, text: manifestText };
    const path = paths.get(url.slice("/c/".length));
    const text = path === undefined ? undefined : fixtureViewFiles[path];
    return text === undefined ? { status: 404, text: "" } : { status: 200, text };
  };
  return { requests, fetchText };
};

describe("loading the view: the manifest, the chunks a board needs, assemble (design decision 8)", () => {
  test("fetches the manifest, then each needed file once, and assembles the srcdoc", async () => {
    const { requests, fetchText } = fakeHost();
    const loaded = await loadView(data, token, fetchText);
    const files = sourcesToFetch(selectChunks(plainChoiceBoardDocument, fixtureViewManifest));
    const sources = Object.fromEntries(
      files.map((file) => [file.sha256, fixtureViewFiles[file.path] ?? ""]),
    );
    expect(loaded).toEqual(assemble(data, fixtureViewManifest, sources));
    expect(requests.map(({ url }) => url)).toEqual([
      "/m",
      ...files.map((file) => `/c/${file.sha256}`),
    ]);
  });

  test("every request carries the token header (AD-11)", async () => {
    const { requests, fetchText } = fakeHost();
    await loadView(data, token, fetchText);
    expect(requests.every((request) => request.token === token)).toBe(true);
  });

  test("a refused manifest fails, naming the route and the status", async () => {
    const fetchText: FetchText = async () => ({ status: 403, text: "no" });
    expect(loadView(data, token, fetchText)).rejects.toThrow("/m answered 403");
  });

  test("a missing chunk file fails, naming its route", async () => {
    const { fetchText } = fakeHost();
    const missing: FetchText = async (url, headers) =>
      url.startsWith("/c/") ? { status: 404, text: "" } : fetchText(url, headers);
    expect(loadView(data, token, missing)).rejects.toThrow(/\/c\/[0-9a-f]{64} answered 404/);
  });

  test("a manifest that is not JSON, or not an object, fails", async () => {
    for (const text of ["{", "[]", "null"]) {
      const { fetchText } = fakeHost(text);
      expect(loadView(data, token, fetchText)).rejects.toThrow("view manifest");
    }
  });

  test("a manifest of another major fails, saying which version is supported", async () => {
    const { fetchText } = fakeHost(JSON.stringify({ ...fixtureViewManifest, version: "2.0" }));
    expect(loadView(data, token, fetchText)).rejects.toThrow("supports version 1");
  });

  test("a manifest without chunks fails", async () => {
    const { fetchText } = fakeHost(JSON.stringify({ version: "1.0", boardPage: {} }));
    expect(loadView(data, token, fetchText)).rejects.toThrow("no chunks");
  });
});

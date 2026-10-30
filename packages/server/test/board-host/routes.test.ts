import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  BOARD_RESPONSES,
  BOARD_TOKEN_HEADER,
  cspHashSource,
  VIEW_MANIFEST_FILE,
} from "@askboard/contract";
import { fixtureViewFiles, fixtureViewManifest } from "@askboard/contract/fixtures";
import { boardPagePolicy, loadView } from "../../src/board-host/view.ts";
import { freeRange, removeViews, request, startHost, type TestHost, writeView } from "./helpers.ts";

// Board-host spec, The board page and its policy, and the routes of the view's files (task 6.3):
// served from Track 0's fixture view build, each answer with the contract's status and type.

const manifest = fixtureViewManifest;
const chunks = Object.values(manifest.chunks);
const scripts = chunks.map((chunk) => chunk.script);
const styles = chunks.flatMap((chunk) => chunk.styles);

let fixture: TestHost;
let port: number;
let token: string;
let askId: string;

beforeAll(async () => {
  fixture = startHost({ ports: await freeRange(1) });
  ({ port, token, askId } = await fixture.ask());
});

afterAll(async () => {
  await fixture.host.close();
  removeViews();
});

const withToken = (value = token) => ({ headers: { [BOARD_TOKEN_HEADER]: value } });

const directives = (policy: string): Map<string, string[]> =>
  new Map(
    policy.split(";").map((part) => {
      const [name = "", ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );

describe("the board page", () => {
  test("is the view build's page, served as HTML with nosniff", async () => {
    const answer = await request(port, `/b/${askId}?t=${token}`);
    expect(answer.status).toBe(BOARD_RESPONSES.boardPage.status);
    expect(answer.headers["content-type"]).toBe(BOARD_RESPONSES.boardPage.contentType);
    expect(answer.headers["x-content-type-options"]).toBe("nosniff");
    expect(answer.body).toBe(fixtureViewFiles[manifest.boardPage.html.path] ?? "");
  });

  test("HEAD gives the same headers and no body", async () => {
    const get = await request(port, `/b/${askId}?t=${token}`);
    const head = await request(port, `/b/${askId}?t=${token}`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.body).toBe("");
    expect(head.headers["content-security-policy"]).toBe(get.headers["content-security-policy"]);
    expect(head.headers["content-length"]).toBe(get.headers["content-length"]);
  });

  test("its policy names the board page's and every chunk's hashes, and nothing unsafe", async () => {
    const answer = await request(port, `/b/${askId}?t=${token}`);
    const policy = String(answer.headers["content-security-policy"]);
    const parts = directives(policy);
    const hashes = (files: readonly { sha256: string }[]) =>
      files.map((file) => cspHashSource(file.sha256)).sort();
    expect([...(parts.get("script-src") ?? [])].sort()).toEqual(
      hashes([manifest.boardPage.script, ...scripts]),
    );
    expect([...(parts.get("style-src") ?? [])].sort()).toEqual(
      hashes([...manifest.boardPage.styles, ...styles]),
    );
    expect(parts.get("default-src")).toEqual(["'none'"]);
    expect(parts.get("connect-src")).toEqual(["'self'"]);
    expect(parts.get("img-src")).toEqual(["data:", "blob:"]);
    expect(parts.get("font-src")).toEqual(["data:"]);
    // Only restrictions besides: what the page may not be framed by, post to or base on.
    expect([...parts.keys()].sort()).toEqual(
      [
        "base-uri",
        "connect-src",
        "default-src",
        "font-src",
        "form-action",
        "frame-ancestors",
        "img-src",
        "script-src",
        "style-src",
      ].sort(),
    );
    for (const name of ["base-uri", "form-action", "frame-ancestors"]) {
      expect(parts.get(name)).toEqual(["'none'"]);
    }
    expect(policy).not.toContain("unsafe-");
    expect(policy).not.toContain("*");
  });

  test("a policy with no style names 'none' for styles", () => {
    const bare = {
      ...manifest,
      boardPage: { ...manifest.boardPage, styles: [] },
      chunks: Object.fromEntries(
        Object.entries(manifest.chunks).map(([name, chunk]) => [name, { ...chunk, styles: [] }]),
      ),
    };
    expect(directives(boardPagePolicy(bare)).get("style-src")).toEqual(["'none'"]);
  });
});

describe("the manifest at /m", () => {
  test("is the manifest file's bytes, as JSON, with the token header", async () => {
    const answer = await request(port, "/m", withToken());
    expect(answer.status).toBe(BOARD_RESPONSES.manifest.status);
    expect(answer.headers["content-type"]).toBe(BOARD_RESPONSES.manifest.contentType);
    expect(answer.body).toBe(fixtureViewFiles[VIEW_MANIFEST_FILE] ?? "");
  });

  test("is refused without the token header, and with one that opens no board", async () => {
    for (const options of [{}, withToken("zzzzzzzzzzzzzzzzzzzzzZ")]) {
      const answer = await request(port, "/m", options);
      expect(answer.status).toBe(BOARD_RESPONSES.tokenRefused.status);
      expect(answer.headers["content-type"]).toBe(BOARD_RESPONSES.tokenRefused.contentType);
    }
  });

  test("does not take the token in the query", async () => {
    const answer = await request(port, `/m?t=${token}`);
    expect(answer.status).toBe(BOARD_RESPONSES.tokenRefused.status);
  });
});

describe("the chunks at /c/<sha256>", () => {
  test("serve each chunk's script as JavaScript and each style as CSS", async () => {
    for (const [files, expected] of [
      [scripts, BOARD_RESPONSES.script],
      [styles, BOARD_RESPONSES.style],
    ] as const) {
      for (const file of files) {
        const answer = await request(port, `/c/${file.sha256}`, withToken());
        expect(answer.status).toBe(expected.status);
        expect(answer.headers["content-type"]).toBe(expected.contentType);
        expect(answer.body).toBe(fixtureViewFiles[file.path] ?? "");
      }
    }
  });

  test("answer 404 for a hash no chunk lists, the board page's own files included", async () => {
    const unlisted = [
      "0".repeat(64),
      manifest.boardPage.script.sha256,
      manifest.boardPage.html.sha256,
    ];
    for (const hash of unlisted) {
      const answer = await request(port, `/c/${hash}`, withToken());
      expect(answer.status).toBe(BOARD_RESPONSES.notFound.status);
      expect(answer.headers["content-type"]).toBe(BOARD_RESPONSES.notFound.contentType);
    }
  });

  test("check the token before the hash", async () => {
    for (const hash of [scripts[0]?.sha256 ?? "", "0".repeat(64)]) {
      const answer = await request(port, `/c/${hash}`);
      expect(answer.status).toBe(BOARD_RESPONSES.tokenRefused.status);
    }
  });
});

describe("any other path", () => {
  test("answers 404 as plain text", async () => {
    for (const path of [
      "/",
      "/nowhere",
      "/c/ABC",
      "/b/",
      "/b/bad%20id?t=x",
      `/ws/${askId}`,
      "//127.0.0.1/m",
      "/m/",
    ]) {
      const answer = await request(port, path, withToken());
      expect(answer.status).toBe(BOARD_RESPONSES.notFound.status);
      expect(answer.headers["content-type"]).toBe(BOARD_RESPONSES.notFound.contentType);
    }
  });

  test("an absolute-form request target names no route", async () => {
    const answer = await request(port, `http://127.0.0.1:${port}/m`, withToken());
    expect(answer.status).toBe(BOARD_RESPONSES.notFound.status);
  });
});

describe("loading the view build", () => {
  const without = (path: string) =>
    Object.fromEntries(Object.entries(fixtureViewFiles).filter(([name]) => name !== path));

  test("reads Track 0's fixture build", async () => {
    const view = await loadView(writeView());
    expect(view.chunks.size).toBe(scripts.length + styles.length);
    expect(view.boardPage.toString()).toBe(fixtureViewFiles[manifest.boardPage.html.path] ?? "");
  });

  test("fails on a missing manifest, a manifest that is not JSON or not valid", async () => {
    const cases = [
      without(VIEW_MANIFEST_FILE),
      { ...fixtureViewFiles, [VIEW_MANIFEST_FILE]: "{" },
      { ...fixtureViewFiles, [VIEW_MANIFEST_FILE]: JSON.stringify({ version: "1.0" }) },
      {
        ...fixtureViewFiles,
        [VIEW_MANIFEST_FILE]: JSON.stringify({ ...manifest, version: "2.0" }),
      },
    ];
    const codes = [];
    for (const files of cases) {
      const failed = await loadView(writeView(files)).catch((error: unknown) => error);
      codes.push((failed as { code?: string }).code);
    }
    expect(codes).toEqual([
      "VIEW_MANIFEST_UNREADABLE",
      "VIEW_MANIFEST_INVALID",
      "VIEW_MANIFEST_INVALID",
      "VIEW_MANIFEST_INVALID",
    ]);
  });

  test("fails on a file that is missing or does not match its digest or size", async () => {
    const shell = manifest.chunks.shell?.script.path ?? "";
    const cases = [
      without(shell),
      { ...fixtureViewFiles, [shell]: `${fixtureViewFiles[shell]}// changed\n` },
      { ...fixtureViewFiles, [shell]: (fixtureViewFiles[shell] ?? "").replace("shell", "SHELL") },
    ];
    for (const files of cases) {
      const failed = await loadView(writeView(files)).catch((error: unknown) => error);
      expect((failed as { code?: string }).code).toBe("VIEW_FILE_INVALID");
    }
  });

  test("fails when the board page does not hold its script inline", async () => {
    const page = manifest.boardPage.html.path;
    const changed = (fixtureViewFiles[page] ?? "").replace('"use strict"', "'use strict'");
    const sha256 = new Bun.CryptoHasher("sha256").update(changed).digest("hex");
    const edited = {
      ...manifest,
      boardPage: {
        ...manifest.boardPage,
        html: { path: page, sha256, bytes: Buffer.byteLength(changed) },
      },
    };
    const files = {
      ...fixtureViewFiles,
      [page]: changed,
      [VIEW_MANIFEST_FILE]: JSON.stringify(edited),
    };
    const failed = await loadView(writeView(files)).catch((error: unknown) => error);
    expect((failed as { code?: string }).code).toBe("VIEW_FILE_INVALID");
  });
});

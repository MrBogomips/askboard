import { describe, expect, test } from "bun:test";
import { cspHashSource } from "@askboard/contract";
import { fixtureViewManifest } from "@askboard/contract/fixtures";
import { boardPagePolicy, isCspConsoleLine, parsePolicy, policyDirectives } from "./policy.ts";

const manifest = fixtureViewManifest;
// The chunks by name, the order the policy lists them in.
const chunks = Object.entries(manifest.chunks)
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([, chunk]) => chunk);
const directives = parsePolicy(boardPagePolicy(manifest));

describe("the board page's CSP (AD-8, design decision 5)", () => {
  test("names exactly the directives the board-host spec lists, frame-src left out in E1", () => {
    expect([...directives.keys()]).toEqual([
      "default-src",
      "script-src",
      "style-src",
      "connect-src",
      "img-src",
      "font-src",
      "base-uri",
      "form-action",
      "frame-ancestors",
    ]);
    expect(directives.get("default-src")).toEqual(["'none'"]);
    expect(directives.get("connect-src")).toEqual(["'self'"]);
    expect(directives.get("img-src")).toEqual(["data:", "blob:"]);
    expect(directives.get("font-src")).toEqual(["data:"]);
  });

  test("sets a base URL only on its own origin, posts no form and is framed by no page (AD-11)", () => {
    expect(directives.get("base-uri")).toEqual(["'self'"]);
    expect(directives.get("form-action")).toEqual(["'none'"]);
    expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
  });

  test("allows scripts by the board page script's hash first, then every chunk's by name", () => {
    const scripts = [manifest.boardPage.script, ...chunks.map((chunk) => chunk.script)];
    expect(directives.get("script-src")).toEqual(scripts.map((file) => cspHashSource(file.sha256)));
  });

  test("allows styles by the board page's and every chunk's style hashes", () => {
    const styles = [...manifest.boardPage.styles, ...chunks.flatMap((chunk) => chunk.styles)];
    expect(directives.get("style-src")).toEqual(styles.map((file) => cspHashSource(file.sha256)));
  });

  test("holds no unsafe keyword, wildcard or scheme beyond the media sources", () => {
    const policy = boardPagePolicy(manifest);
    expect(policy).not.toMatch(/unsafe-|\*|https?:|ws:/);
  });

  test("says 'none' for styles when nothing has any, and names a shared hash once", () => {
    const shell = manifest.chunks.shell;
    if (shell === undefined) throw new Error("the fixture manifest has no shell");
    const bare = {
      ...manifest,
      boardPage: { ...manifest.boardPage, styles: [] },
      chunks: { shell: { ...shell, styles: [] }, again: { ...shell, styles: [] } },
    };
    const parsed = parsePolicy(boardPagePolicy(bare));
    expect(parsed.get("style-src")).toEqual(["'none'"]);
    expect(parsed.get("script-src")).toEqual([
      cspHashSource(manifest.boardPage.script.sha256),
      cspHashSource(shell.script.sha256),
    ]);
  });
});

describe("parsePolicy", () => {
  test("reads directives in order, with their sources, ignoring empty parts", () => {
    expect([...parsePolicy("default-src 'none';  img-src data: blob: ;;").entries()]).toEqual([
      ["default-src", ["'none'"]],
      ["img-src", ["data:", "blob:"]],
    ]);
  });
});

describe("policyDirectives", () => {
  test("reads a policy as its directives and sources, whatever their order", () => {
    const one = "default-src 'none'; script-src 'sha256-b' 'sha256-a'; connect-src 'self'";
    const other = "connect-src 'self';script-src 'sha256-a' 'sha256-b';  default-src 'none'";
    expect(policyDirectives(one)).toEqual(policyDirectives(other));
    expect(policyDirectives(one)).toEqual({
      "connect-src": ["'self'"],
      "default-src": ["'none'"],
      "script-src": ["'sha256-a'", "'sha256-b'"],
    });
    expect(policyDirectives(one)).not.toEqual(policyDirectives(`${one}; frame-src 'self'`));
  });
});

describe("isCspConsoleLine", () => {
  // What each engine logs when the policy blocks something (renderer spike, row 17).
  test.each([
    "Refused to execute a script because its hash, its nonce, or 'unsafe-inline' does not appear in the script-src directive of the Content Security Policy.",
    "Executing inline script violates the following Content Security Policy directive 'script-src 'sha256-x''.",
    "Content-Security-Policy: The page’s settings blocked a JavaScript eval (script-src) from being executed",
    '[JavaScript Error: "Content-Security-Policy: The page\'s settings blocked the loading of a resource"]',
    "EvalError: Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source",
  ])("counts %p", (line) => {
    expect(isCspConsoleLine(line)).toBe(true);
  });

  test("leaves other lines alone", () => {
    expect(
      isCspConsoleLine("Download the React DevTools for a better development experience"),
    ).toBe(false);
    expect(isCspConsoleLine("WebSocket connection to 'ws://127.0.0.1/ws/a' failed")).toBe(false);
  });
});

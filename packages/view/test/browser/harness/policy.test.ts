import { describe, expect, test } from "bun:test";
import { isCspConsoleLine, parsePolicy, policyDirectives } from "./policy.ts";

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

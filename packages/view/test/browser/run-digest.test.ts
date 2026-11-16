import { describe, expect, test } from "bun:test";
import {
  DIGEST_LIMIT,
  type DigestInput,
  digestPassed,
  formatDigest,
  parseFailures,
} from "./run-digest.ts";

// Real `bun test --parallel` output (Bun 1.4.4), piped: no `(pass)` lines, each failure's error
// before its `(fail)` line, except a thrown non-Error, whose error follows it.
const OUTPUT = `bun test v1.4.4 (38afee6c8) 2x PARALLEL

packages/view/test/browser/a.browser.ts:
4 |   test("fails here", () => { expect(1).toBe(2); });
                                           ^
error: expect(received).toBe(expected)

Expected: 2
Received: 1

      at <anonymous> (/repo/packages/view/test/browser/a.browser.ts:4:40)
(fail) chromium: group a > fails here [0.12ms]

packages/view/test/browser/b.browser.ts:
2 | test("b throws", () => { throw new Error("boom in b\\nsecond line"); });
                                                                     ^
TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
      at <anonymous> (/repo/packages/view/test/browser/b.browser.ts:2:66)
(fail) b throws [0.05ms]
(fail) b times out [51.31ms]
  ^ this test timed out after 50ms.
(fail) c string [0.03ms]
4 | test("c string", () => { throw "plain string"; });
                                   ^
error: plain string
      at <anonymous> (/repo/packages/view/test/browser/b.browser.ts:4:32)

packages/view/test/browser/d.browser.ts:

# Unhandled error between tests
-------------------------------
2 | throw new Error("load failure");
              ^
error: load failure
      at /repo/packages/view/test/browser/d.browser.ts:2:11
-------------------------------


 2 pass
 4 fail
 1 error
Ran 6 tests across 3 files. [64.00ms]
`;

describe("parseFailures: one entry per failing test, from bun test's output", () => {
  test("each (fail) line with its file, its full name and the first line of its error", () => {
    expect(parseFailures(OUTPUT)).toEqual([
      {
        file: "a.browser.ts",
        test: "chromium: group a > fails here",
        error: "error: expect(received).toBe(expected)",
      },
      {
        file: "b.browser.ts",
        test: "b throws",
        error: "TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.",
      },
      { file: "b.browser.ts", test: "b times out", error: "this test timed out after 50ms." },
      { file: "b.browser.ts", test: "c string", error: "error: plain string" },
      {
        file: "d.browser.ts",
        test: "(unhandled error between tests)",
        error: "error: load failure",
      },
    ]);
  });

  test("a clean run has no failure", () => {
    expect(parseFailures("bun test v1.4.4\n\n 12 pass\n 0 fail\nRan 12 tests.\n")).toEqual([]);
  });

  test("a failure with no error line says so instead of inventing one", () => {
    expect(parseFailures("x.browser.ts:\n(fail) lonely [1ms]\n")).toEqual([
      { file: "x.browser.ts", test: "lonely", error: "(no error line)" },
    ]);
  });
});

const input = (over: Partial<DigestInput> = {}): DigestInput => ({
  heading: "browser tests against the session process on bun",
  log: "/tmp/askboard-browser.log",
  passes: [
    { set: "full", engine: "chromium", pass: 140, fail: 1, seconds: 312.44 },
    { set: "full", engine: "firefox", pass: 120, fail: 2, seconds: 401 },
  ],
  failures: [
    {
      set: "full",
      engine: "firefox",
      file: "gantt-axis.browser.ts",
      test: "firefox, en-US: the Gantt plan's axis labels > do not overlap at day zoom",
      error: "error: expect(received).toBeLessThanOrEqual(expected)",
      verdict: "known",
      issue: 144,
    },
    {
      set: "full",
      engine: "chromium",
      file: "board.browser.ts",
      test: "a board > shows the card",
      error: "TimeoutError: locator.click: Timeout 30000ms exceeded.",
      verdict: "new",
    },
    {
      set: "full",
      engine: "firefox",
      file: "table.browser.ts",
      test: "a table > sorts",
      error: "error: expect(received).toBe(expected)",
      verdict: "flaky",
    },
  ],
  ...over,
});

describe("formatDigest: what an agent reads instead of the log", () => {
  test("the counts per pass, then new, flaky and known failures, the verdict and the log", () => {
    const digest = formatDigest(input());
    expect(digest.split("\n")).toEqual([
      "browser tests against the session process on bun: FAIL, 1 new, 1 flaky, 1 known",
      "  full  chromium 140 pass, 1 fail in 312.4 s",
      "  full  firefox  120 pass, 2 fail in 401.0 s",
      "  new   chromium board.browser.ts > a board > shows the card: TimeoutError: locator.click: Timeout 30000ms exceeded.",
      "  flaky firefox  table.browser.ts > a table > sorts: error: expect(received).toBe(expected)",
      "  known firefox  gantt-axis.browser.ts > firefox, en-US: the Gantt plan's axis labels > do not overlap at day zoom: error: expect(received).toBeLessThanOrEqual(expected) (#144)",
      "full log: /tmp/askboard-browser.log",
    ]);
  });

  test("no new failure passes, and says so", () => {
    const failures = input().failures.filter((failure) => failure.verdict !== "new");
    expect(formatDigest(input({ failures })).split("\n")[0]).toBe(
      "browser tests against the session process on bun: PASS, 0 new, 1 flaky, 1 known",
    );
    expect(digestPassed(input({ failures }))).toBe(true);
    expect(digestPassed(input())).toBe(false);
  });

  test("a pass that failed with no failure parsed is a new failure of its own", () => {
    const digest = formatDigest(
      input({
        failures: [],
        passes: [{ set: "smoke", engine: "webkit", pass: 0, fail: 0, seconds: 1, code: 1 }],
      }),
    );
    expect(digest).toContain(": FAIL, 1 new");
    expect(
      digestPassed(
        input({
          failures: [],
          passes: [{ set: "smoke", engine: "webkit", pass: 0, fail: 0, seconds: 1, code: 1 }],
        }),
      ),
    ).toBe(false);
    expect(digest).toContain("  new   webkit   the smoke pass exited 1 with no failing test named");
  });

  test("stays within the limit: long lines are cut and the rest counted", () => {
    const many = Array.from({ length: 80 }, (_, at) => ({
      set: "full" as const,
      engine: "webkit" as const,
      file: `file-${at}.browser.ts`,
      test: `a test with a long name ${"x".repeat(200)}`,
      error: `error: ${"y".repeat(300)}`,
      verdict: "new" as const,
    }));
    const digest = formatDigest(input({ failures: many }));
    expect(new TextEncoder().encode(digest).length).toBeLessThanOrEqual(DIGEST_LIMIT);
    expect(digest).toMatch(/and \d+ more failures in the log/);
    expect(digest.split("\n").at(-1)).toBe("full log: /tmp/askboard-browser.log");
    for (const line of digest.split("\n")) expect(line.length).toBeLessThanOrEqual(200);
  });
});

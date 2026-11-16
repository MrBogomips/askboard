import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BROWSER_FILES } from "./harness/suites.ts";
import {
  judgeFailures,
  KNOWN_FAILURES_FILE,
  knownIssueOf,
  parseKnownFailures,
} from "./run-quarantine.ts";

const ROOT = join(import.meta.dir, "..", "..", "..", "..");

const known = parseKnownFailures({
  version: 1,
  issues: {
    "144": {
      title: "Firefox: axis labels overlap",
      failures: [
        { file: "gantt-axis.browser.ts", test: "do not overlap at day zoom", engines: ["firefox"] },
      ],
    },
    "174": {
      title: "Firefox crashes",
      failures: [{ file: "toggles.browser.ts", engines: ["firefox"] }],
    },
    "300": { title: "Every engine", failures: [{ file: "board.browser.ts", test: "shows" }] },
  },
});

describe("parseKnownFailures: the quarantine file, keyed by Issue number", () => {
  test("one entry per failure, with its Issue", () => {
    expect(known).toEqual([
      {
        issue: 144,
        file: "gantt-axis.browser.ts",
        test: "do not overlap at day zoom",
        engines: ["firefox"],
      },
      { issue: 174, file: "toggles.browser.ts", engines: ["firefox"] },
      { issue: 300, file: "board.browser.ts", test: "shows" },
    ]);
  });

  test.each([
    ["not an object", 3, "an object"],
    ["another version", { version: 2, issues: {} }, "version 1"],
    [
      "an Issue key that is no number",
      { version: 1, issues: { abc: { title: "t", failures: [] } } },
      '"abc"',
    ],
    [
      "no title",
      { version: 1, issues: { "1": { failures: [{ file: "a.browser.ts" }] } } },
      "title",
    ],
    ["no failure", { version: 1, issues: { "1": { title: "t", failures: [] } } }, "at least one"],
    [
      "a file that is no browser file",
      { version: 1, issues: { "1": { title: "t", failures: [{ file: "../x.ts" }] } } },
      "browser file",
    ],
    [
      "an unknown engine",
      {
        version: 1,
        issues: { "1": { title: "t", failures: [{ file: "a.browser.ts", engines: ["edge"] }] } },
      },
      "engine",
    ],
    [
      "an empty test matcher",
      {
        version: 1,
        issues: { "1": { title: "t", failures: [{ file: "a.browser.ts", test: "" }] } },
      },
      "test",
    ],
    [
      "an unknown field",
      {
        version: 1,
        issues: { "1": { title: "t", failures: [{ file: "a.browser.ts", name: "x" }] } },
      },
      '"name"',
    ],
  ])("refuses %s", (_, json, reason) => {
    expect(() => parseKnownFailures(json)).toThrow(reason);
  });
});

describe("knownIssueOf: whether a failure is quarantined, and by which Issue", () => {
  test("file, a part of the test's name and the engine must all match", () => {
    const axis = {
      file: "gantt-axis.browser.ts",
      test: "firefox, en-US: labels > do not overlap at day zoom",
    };
    expect(knownIssueOf(known, "firefox", axis)).toBe(144);
    expect(knownIssueOf(known, "webkit", axis)).toBeUndefined();
    expect(knownIssueOf(known, "firefox", { ...axis, test: "something else" })).toBeUndefined();
  });

  test("no test matcher takes the whole file; no engines takes every engine", () => {
    expect(knownIssueOf(known, "firefox", { file: "toggles.browser.ts", test: "any" })).toBe(174);
    expect(knownIssueOf(known, "chromium", { file: "board.browser.ts", test: "it shows" })).toBe(
      300,
    );
  });
});

describe("judgeFailures: new, known or flaky", () => {
  const failure = (file: string, name: string) => ({ file, test: name, error: "error: x" });

  test("known first; then a test that passed when its file ran again alone is flaky; the rest new", () => {
    const judged = judgeFailures({
      set: "full",
      engine: "firefox",
      failures: [
        failure("toggles.browser.ts", "a toggle"),
        failure("a.browser.ts", "passes again"),
        failure("a.browser.ts", "fails again"),
        failure("b.browser.ts", "never rerun"),
      ],
      reruns: { "a.browser.ts": [{ code: 1, failures: [failure("a.browser.ts", "fails again")] }] },
      known,
    });
    expect(judged.map(({ test: name, verdict, issue }) => [name, verdict, issue])).toEqual([
      ["a toggle", "known", 174],
      ["passes again", "flaky", undefined],
      ["fails again", "new", undefined],
      ["never rerun", "new", undefined],
    ]);
    expect(judged.every((one) => one.set === "full" && one.engine === "firefox")).toBe(true);
  });

  test("a rerun that failed with no failing test named proves nothing: the failure stays new", () => {
    const judged = judgeFailures({
      set: "smoke",
      engine: "webkit",
      failures: [failure("a.browser.ts", "crashed")],
      reruns: { "a.browser.ts": [{ code: 1, failures: [] }] },
      known: [],
    });
    expect(judged[0]?.verdict).toBe("new");
  });

  test("passing in any of several reruns is flaky", () => {
    const judged = judgeFailures({
      set: "full",
      engine: "chromium",
      failures: [failure("a.browser.ts", "slow")],
      reruns: {
        "a.browser.ts": [
          { code: 1, failures: [failure("a.browser.ts", "slow")] },
          { code: 0, failures: [] },
        ],
      },
      known: [],
    });
    expect(judged[0]?.verdict).toBe("flaky");
  });
});

describe("the committed quarantine file", () => {
  const committed = parseKnownFailures(
    JSON.parse(readFileSync(join(ROOT, KNOWN_FAILURES_FILE), "utf8")) as unknown,
  );

  test("parses, and names only browser files the manifest lists", () => {
    expect(committed.length).toBeGreaterThan(0);
    for (const entry of committed) expect(Object.keys(BROWSER_FILES)).toContain(entry.file);
  });
});

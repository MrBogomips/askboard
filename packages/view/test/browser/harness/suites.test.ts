import { afterEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ENGINES } from "./engines.ts";
import {
  BROWSER_FILES,
  type BrowserFileEntry,
  enginesFor,
  SPINE_CHECKS,
  type SpineCheck,
  suitesProblems,
} from "./suites.ts";

const BROWSER_DIR = join(import.meta.dir, "..");

const browserFiles = (): Record<string, string> =>
  Object.fromEntries(
    readdirSync(BROWSER_DIR)
      .filter((name) => name.endsWith(".browser.ts"))
      .map((name) => [name, readFileSync(join(BROWSER_DIR, name), "utf8")]),
  );

describe("the manifest of browser files, against the files on disk", () => {
  test("has an entry for every *.browser.ts file and a file for every entry, and no other problem", () => {
    expect(suitesProblems(BROWSER_FILES, browserFiles(), SPINE_CHECKS)).toEqual([]);
  });

  test("lists the files by name, never by path", () => {
    for (const name of Object.keys(BROWSER_FILES)) {
      expect(name).toMatch(/^[a-z0-9-]+\.browser\.ts$/);
    }
  });

  test("keeps the smoke set within 25 files and the four bounded-work files in the perf set", () => {
    const smoke = Object.entries(BROWSER_FILES).filter(([, entry]) => entry.smoke);
    expect(smoke.length).toBeGreaterThan(0);
    expect(smoke.length).toBeLessThanOrEqual(25);
    const perf = Object.entries(BROWSER_FILES)
      .filter(([, entry]) => entry.perf)
      .map(([name]) => name)
      .sort();
    expect(perf).toEqual(
      expect.arrayContaining([
        "latex-bounds.browser.ts",
        "markdown-bounds.browser.ts",
        "markdown-total.browser.ts",
        "table-bounds.browser.ts",
      ]),
    );
  });

  test("lists the Document review's cost of placing as a Chromium-only perf file, with its reason", () => {
    const entry = BROWSER_FILES["document-review-cost.browser.ts"];
    expect(entry?.perf).toBe(true);
    expect(entry?.engines).toEqual(["chromium"]);
    // The spine's rule: the entry cites the requirement that names fewer engines (review S-3).
    expect(entry?.why).toMatch(/Timed bounds judged in the perf pass/);
    expect(entry?.why).toMatch(/The Document review's cost of placing/);
    expect(entry?.why).toMatch(/task 6\.4/);
  });

  test("narrows the two Markdown bounded-work files to Chromium and WebKit, with a reason", () => {
    const narrowed = Object.entries(BROWSER_FILES)
      .filter(([, entry]) => entry.engines !== undefined)
      .map(([name]) => name)
      .sort();
    for (const name of ["markdown-bounds.browser.ts", "markdown-total.browser.ts"]) {
      expect(narrowed).toContain(name);
      expect(BROWSER_FILES[name]?.engines).toEqual(["chromium", "webkit"]);
      expect(BROWSER_FILES[name]?.why).toMatch(/Markdown bounded work/);
    }
  });

  test("names, for every spine check, smoke files that hold the test, or why no file can", () => {
    expect(SPINE_CHECKS.length).toBeGreaterThanOrEqual(10);
    const unmapped = SPINE_CHECKS.filter((spine) => spine.covers === undefined);
    expect(unmapped.map((spine) => spine.check)).toEqual(["PlantUML images"]);
  });
});

const ONE: Record<string, BrowserFileEntry> = {
  "a.browser.ts": {},
  "b.browser.ts": { smoke: true },
};
const TEXTS = { "a.browser.ts": "test('x')", "b.browser.ts": 'test("the title")' };
const SPINE: SpineCheck[] = [
  { check: "cold load", covers: [{ file: "b.browser.ts", title: "the title" }] },
];

describe("suitesProblems", () => {
  test("accepts a consistent manifest", () => {
    expect(suitesProblems(ONE, TEXTS, SPINE)).toEqual([]);
  });

  test("fails a file with no entry, naming it", () => {
    const problems = suitesProblems(ONE, { ...TEXTS, "c.browser.ts": "" }, SPINE);
    expect(problems).toEqual([expect.stringContaining("c.browser.ts has no entry")]);
  });

  test("fails an entry with no file, naming it", () => {
    const problems = suitesProblems({ ...ONE, "gone.browser.ts": {} }, TEXTS, SPINE);
    expect(problems).toEqual([expect.stringContaining("gone.browser.ts has no file")]);
  });

  test("fails a narrowed entry without a reason", () => {
    const entries = { ...ONE, "a.browser.ts": { engines: ["chromium"] as const } };
    const texts = { ...TEXTS, "a.browser.ts": "enginesFor(import.meta.path)" };
    expect(suitesProblems(entries, texts, SPINE)).toEqual([
      expect.stringContaining("a.browser.ts narrows its engines without a why"),
    ]);
  });

  test("fails a narrowed entry whose file does not call enginesFor", () => {
    const entries = { ...ONE, "a.browser.ts": { engines: ["chromium"] as const, why: "r" } };
    expect(suitesProblems(entries, TEXTS, SPINE)).toEqual([
      expect.stringContaining("a.browser.ts narrows its engines but does not call enginesFor"),
    ]);
  });

  test("fails an entry that lists no engine, or one the harness does not know", () => {
    const empty = { ...ONE, "a.browser.ts": { engines: [] as const, why: "r" } };
    const texts = { ...TEXTS, "a.browser.ts": "enginesFor(import.meta.path)" };
    expect(suitesProblems(empty, texts, SPINE).join("\n")).toContain("lists no engine");
    const unknown = { ...ONE, "a.browser.ts": { engines: ["edge"], why: "r" } };
    // biome-ignore lint/suspicious/noExplicitAny: a deliberately wrong entry
    expect(suitesProblems(unknown as any, texts, SPINE).join("\n")).toContain(
      'unknown engine "edge"',
    );
  });

  test("fails an inline enginesFrom(...).filter(, on one line or several", () => {
    for (const text of [
      "for (const e of enginesFrom(process.env.X).filter((n) => n !== 'firefox')) {}",
      "for (const e of enginesFrom(process.env.ASKBOARD_E2E_ENGINES).filter(\n  (n) => n)) {}",
    ]) {
      expect(suitesProblems(ONE, { ...TEXTS, "a.browser.ts": text }, SPINE)).toEqual([
        expect.stringContaining("a.browser.ts filters enginesFrom(...) inline"),
      ]);
    }
  });

  test("fails any other inline narrowing of the engines: includes, some, a variable, a literal list, ENGINES", () => {
    for (const text of [
      'if (enginesFrom(process.env.ASKBOARD_E2E_ENGINES).includes("chromium")) {}',
      'if (enginesFrom(process.env.X).some((e) => e === "chromium")) {}',
      "const wanted = enginesFrom(process.env.ASKBOARD_E2E_ENGINES);\nfor (const e of wanted) {}",
      'for (const engine of ["chromium", "webkit"]) {}',
      'for (const engine of (["webkit"] as const)) {}',
      'for (const engine of ENGINES.filter((e) => e !== "firefox")) {}',
      "for (const engine of enginesFrom(process.env.X).slice(1)) {}",
    ]) {
      expect(suitesProblems(ONE, { ...TEXTS, "a.browser.ts": text }, SPINE).join("\n")).toContain(
        "a.browser.ts filters enginesFrom(...) inline",
      );
    }
  });

  test("accepts the one loop over every engine, its import, and a comment that names enginesFrom", () => {
    const text = [
      'import { enginesFrom } from "./harness/engines.ts";',
      "// enginesFrom(x).includes is what a narrowed file must not write",
      "for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {",
      '  if (engine === "chromium") { /* an in-test branch, not a narrowing */ }',
      "}",
    ].join("\n");
    expect(suitesProblems(ONE, { ...TEXTS, "a.browser.ts": text }, SPINE)).toEqual([]);
  });

  test("fails a timeout exemption whose reason names no timeout, and one on a perf file", () => {
    const vague = { ...ONE, "a.browser.ts": { timeout: "it is slow" } };
    expect(suitesProblems(vague, TEXTS, SPINE)).toEqual([
      expect.stringContaining("a.browser.ts has a timeout exemption whose reason names no timeout"),
    ]);
    const perf = { ...ONE, "a.browser.ts": { timeout: "the load timeout", perf: true as const } };
    expect(suitesProblems(perf, TEXTS, SPINE).join("\n")).toContain("is both perf and exempt");
    const fine = { ...ONE, "a.browser.ts": { timeout: "waits no longer than the load timeout" } };
    expect(suitesProblems(fine, TEXTS, SPINE)).toEqual([]);
  });

  test("fails an entry that is both smoke and perf", () => {
    const entries = { ...ONE, "b.browser.ts": { smoke: true, perf: true } as const };
    expect(suitesProblems(entries, TEXTS, SPINE).join("\n")).toContain("both smoke and perf");
  });

  test("fails a spine check outside the smoke set", () => {
    const spine = [{ check: "cold load", covers: [{ file: "a.browser.ts", title: "x" }] }];
    expect(suitesProblems(ONE, TEXTS, spine)).toEqual([
      expect.stringContaining("cold load: a.browser.ts is not in the smoke set"),
    ]);
  });

  test("fails a spine check whose title is not in its file, or whose file does not exist", () => {
    const missing = [{ check: "reload", covers: [{ file: "b.browser.ts", title: "other" }] }];
    expect(suitesProblems(ONE, TEXTS, missing)).toEqual([
      expect.stringContaining('reload: "other" is not a title in b.browser.ts'),
    ]);
    const nofile = [{ check: "reload", covers: [{ file: "z.browser.ts", title: "t" }] }];
    expect(suitesProblems(ONE, TEXTS, nofile)).toEqual([
      expect.stringContaining("reload: z.browser.ts is not in the smoke set"),
    ]);
  });

  test("fails a spine check with neither a covering test nor a reason", () => {
    expect(suitesProblems(ONE, TEXTS, [{ check: "takeover" }])).toEqual([
      expect.stringContaining("takeover: neither covers nor why"),
    ]);
    expect(suitesProblems(ONE, TEXTS, [{ check: "takeover", why: "no widget" }])).toEqual([]);
  });
});

describe("enginesFor", () => {
  const saved = process.env.ASKBOARD_E2E_ENGINES;
  afterEach(() => {
    if (saved === undefined) delete process.env.ASKBOARD_E2E_ENGINES;
    else process.env.ASKBOARD_E2E_ENGINES = saved;
  });

  test("returns the manifest's engines for a path or a name, every engine for an unnarrowed file", () => {
    delete process.env.ASKBOARD_E2E_ENGINES;
    expect(enginesFor(join(BROWSER_DIR, "markdown-total.browser.ts"))).toEqual([
      "chromium",
      "webkit",
    ]);
    expect(enginesFor("markdown-bounds.browser.ts")).toEqual(["chromium", "webkit"]);
    expect(enginesFor("board.browser.ts")).toEqual([...ENGINES]);
  });

  test("intersects with ASKBOARD_E2E_ENGINES, in the harness's order", () => {
    process.env.ASKBOARD_E2E_ENGINES = "webkit,firefox";
    expect(enginesFor("board.browser.ts")).toEqual(["firefox", "webkit"]);
    expect(enginesFor("markdown-total.browser.ts")).toEqual(["webkit"]);
    process.env.ASKBOARD_E2E_ENGINES = "firefox";
    expect(enginesFor("markdown-total.browser.ts")).toEqual([]);
  });

  test("fails on a file the manifest does not list", () => {
    expect(() => enginesFor("nope.browser.ts")).toThrow("nope.browser.ts is not in BROWSER_FILES");
  });
});

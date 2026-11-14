import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BROWSER_FILES } from "./suites.ts";

// Decision 6 (requirement Timed bounds judged in the perf pass): the perf files are exactly the files
// that import `harness/perf.ts`, and no other browser file asserts a bound on a measured time.

const BROWSER_DIR = join(import.meta.dir, "..");

const browserFiles = (): Record<string, string> =>
  Object.fromEntries(
    readdirSync(BROWSER_DIR)
      .filter((name) => name.endsWith(".browser.ts"))
      .map((name) => [name, readFileSync(join(BROWSER_DIR, name), "utf8")]),
  );

const IMPORTS_PERF = /from\s+"\.\/harness\/perf\.ts"/;

const TIME_SOURCE = /\b(?:performance|Date)\.now\(\)/;
// A name that is not a property of something else.
const WORD = (name: string) => new RegExp(`(?<![.\\w$])${name.replace(/\$/g, "\\$")}(?![\\w$])`);
// A value the harness times for us: `settled.ms`, `elapsedMs`.
const MEASURED_FIELD = /\.ms\b|(?<![.\w$])(?:ms|[a-z]\w*Ms)(?![\w$])/;

/** The text with every comment, and the inside of every string, blanked out (newlines and length kept). */
const masked = (text: string): string => {
  const out = text.split("");
  const blank = (from: number, to: number) => {
    for (let at = from; at < to; at += 1) if (out[at] !== "\n") out[at] = " ";
  };
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at] as string;
    const next = text[at + 1];
    if (char === "/" && next === "/") {
      const end = text.indexOf("\n", at);
      blank(at, end < 0 ? text.length : end);
      at = end < 0 ? text.length : end;
    } else if (char === "/" && next === "*") {
      const end = text.indexOf("*/", at + 2);
      blank(at, end < 0 ? text.length : end + 2);
      at = end < 0 ? text.length : end + 1;
    } else if (char === '"' || char === "'" || char === "`") {
      let end = at + 1;
      while (end < text.length && text[end] !== char) end += text[end] === "\\" ? 2 : 1;
      blank(at + 1, end);
      at = end;
    }
  }
  return out.join("");
};

/** The index of the bracket that closes the one at `open` in masked text; -1 if none. */
const closing = (text: string, open: number): number => {
  let depth = 0;
  for (let at = open; at < text.length; at += 1) {
    const char = text[at] as string;
    if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return -1;
};

/** The text of the statement that starts at `from`, to its `;` outside brackets. */
const statementFrom = (text: string, from: number): string => {
  for (let at = from; at < text.length; at += 1) {
    const char = text[at] as string;
    if ("([{".includes(char)) {
      const end = closing(text, at);
      if (end < 0) break;
      at = end;
    } else if (char === ";") return text.slice(from, at);
  }
  return text.slice(from);
};

/** The first argument of a call's argument text: up to the first comma outside brackets. */
const firstArgument = (args: string): string => {
  let depth = 0;
  for (let at = 0; at < args.length; at += 1) {
    const char = args[at] as string;
    if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) depth -= 1;
    else if (char === "," && depth === 0) return args.slice(0, at);
  }
  return args;
};

/** The names a text binds to a time, or to anything computed from one, or to a function returning one. */
const timedNames = (text: string): Set<string> => {
  const names = new Set<string>();
  const bindings: { name: string; body: string }[] = [];
  for (const found of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=/g)) {
    const start = (found.index ?? 0) + found[0].length;
    bindings.push({ name: found[1] as string, body: statementFrom(text, start) });
  }
  for (const found of text.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    const params = (found.index ?? 0) + found[0].length - 1;
    const brace = text.indexOf("{", closing(text, params));
    if (brace >= 0) {
      bindings.push({ name: found[1] as string, body: text.slice(brace, closing(text, brace)) });
    }
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (const { name, body } of bindings) {
      if (names.has(name)) continue;
      const timed = TIME_SOURCE.test(body) || [...names].some((known) => WORD(known).test(body));
      if (timed) {
        names.add(name);
        changed = true;
      }
    }
  }
  return names;
};

export type TimedBound = { readonly subject: string; readonly bound: string };

/**
 * Every `expect(<a measured time>).toBeLessThan(...)` or `.toBeLessThanOrEqual(...)` of a text: a
 * time is a `performance.now()` or `Date.now()`, a name computed from one, a function that returns
 * one, or a field the harness names `ms` or `...Ms`.
 */
export const timedBounds = (source: string): TimedBound[] => {
  const text = masked(source);
  const names = timedNames(text);
  const found: TimedBound[] = [];
  for (const call of text.matchAll(/\bexpect\(/g)) {
    const open = (call.index ?? 0) + call[0].length - 1;
    const end = closing(text, open);
    if (end < 0) continue;
    const subject = text.slice(open + 1, end);
    const after = /^\s*\.(?:not\s*\.)?\s*(?:toBeLessThanOrEqual|toBeLessThan)\s*\(/.exec(
      text.slice(end + 1),
    );
    if (after === null) continue;
    const boundOpen = end + 1 + after[0].length - 1;
    const bound = text.slice(boundOpen + 1, closing(text, boundOpen));
    const value = firstArgument(subject);
    const timed =
      TIME_SOURCE.test(value) ||
      MEASURED_FIELD.test(value) ||
      [...names].some((name) => WORD(name).test(value));
    if (timed) {
      found.push({
        subject: source.slice(open + 1, open + 1 + value.length).trim(),
        bound: source.slice(boundOpen + 1, boundOpen + 1 + bound.length).trim(),
      });
    }
  }
  return found;
};

const isTimeout = (bound: TimedBound): boolean => /TIMEOUT/.test(bound.bound);

describe("timedBounds", () => {
  test("finds a bound on a Date.now() or performance.now() difference, directly", () => {
    expect(timedBounds("expect(Date.now() - started).toBeLessThan(2_000);")).toEqual([
      { subject: "Date.now() - started", bound: "2_000" },
    ]);
    expect(timedBounds("expect(performance.now() - t).toBeLessThanOrEqual(5)")).toHaveLength(1);
  });

  test("finds one through a variable, through a variable computed from it, and through a helper", () => {
    const viaVariable =
      "const from = Date.now();\nawait go();\nconst took = Date.now() - from;\nexpect(took).toBeLessThan(10);";
    expect(timedBounds(viaVariable)).toHaveLength(1);
    const chained =
      "const a = performance.now();\nconst b = Math.round(a / 2);\nexpect(b).toBeLessThan(10);";
    expect(timedBounds(chained)).toHaveLength(1);
    const helper = [
      "const typing = async (run: Run): Promise<number> => {",
      "  const began = Date.now();",
      "  await run.type();",
      "  return (Date.now() - began) / 30;",
      "};",
      "const perKey = await typing(run);",
      "expect(perKey).toBeLessThan(150);",
    ].join("\n");
    expect(timedBounds(helper)).toEqual([{ subject: "perKey", bound: "150" }]);
    const declared =
      "function took() { return Date.now(); }\nconst t = took();\nexpect(t).toBeLessThan(3);";
    expect(timedBounds(declared)).toHaveLength(1);
  });

  test("finds a bound on a field the harness names ms, and on one with a message", () => {
    expect(timedBounds("expect(result.ms, where).toBeLessThan(RENDER_BOUND_MS);")).toHaveLength(1);
    expect(timedBounds("expect(await height()).toBeLessThan(5)")).toHaveLength(0);
    expect(
      timedBounds("const took = Date.now();\nexpect(took, 'took a while').toBeLessThan(5);"),
    ).toHaveLength(1);
  });

  test("finds a bound in the forms a bound is written: not, and over several lines", () => {
    expect(timedBounds("const t = Date.now();\nexpect(t).not.toBeLessThan(5);")).toHaveLength(1);
    expect(timedBounds("const t = Date.now();\nexpect(t)\n  .toBeLessThan(\n 5);")).toHaveLength(1);
  });

  test("leaves layout and size checks, and unrelated names, alone", () => {
    const text = [
      "const box = await measure();",
      "expect(box.height).toBeLessThanOrEqual(MAX_HEIGHT);",
      "expect(Math.abs(a.x - b.x)).toBeLessThan(2);",
      "const when = Date.parse(answer.when);",
      "expect(when).toBeGreaterThanOrEqual(pressed);",
      "const rows = Array.from({ length: 3 });",
      "expect(rows.length).toBeLessThan(4);",
    ].join("\n");
    expect(timedBounds(text)).toEqual([]);
  });

  test("a name used as a property or inside a longer name is not the time", () => {
    const text =
      "const from = Date.now();\nexpect(Array.from(x).length).toBeLessThan(2);\nexpect(fromage).toBeLessThan(2);";
    expect(timedBounds(text)).toEqual([]);
  });

  test("ignores a bound written in a comment or a string", () => {
    const text =
      '// expect(Date.now() - a).toBeLessThan(1)\nconst s = "expect(Date.now()).toBeLessThan(1)";';
    expect(timedBounds(text)).toEqual([]);
  });
});

describe("the perf files", () => {
  test("are exactly the files the manifest flags as perf, each importing harness/perf.ts", () => {
    const importing = Object.entries(browserFiles())
      .filter(([, text]) => IMPORTS_PERF.test(text))
      .map(([name]) => name)
      .sort();
    const flagged = Object.entries(BROWSER_FILES)
      .filter(([, entry]) => entry.perf)
      .map(([name]) => name)
      .sort();
    expect(importing).toEqual(flagged);
  });

  test("include the four bounded-work files and the Document review's cost of placing", () => {
    for (const name of [
      "table-bounds.browser.ts",
      "markdown-total.browser.ts",
      "markdown-bounds.browser.ts",
      "latex-bounds.browser.ts",
      "document-review-cost.browser.ts",
    ]) {
      expect(BROWSER_FILES[name]?.perf, name).toBe(true);
    }
  });
});

describe("no bound on a measured time outside the perf files", () => {
  const files = Object.entries(browserFiles()).filter(([name]) => !BROWSER_FILES[name]?.perf);

  test("holds in every other browser file, but a bound that is a timeout", () => {
    const problems: string[] = [];
    for (const [name, text] of files) {
      const exempt = BROWSER_FILES[name]?.timeout !== undefined;
      for (const bound of timedBounds(text)) {
        if (exempt && isTimeout(bound)) continue;
        problems.push(
          `${name}: expect(${bound.subject}) is bounded by ${bound.bound}, a time bound outside the perf pass`,
        );
      }
    }
    expect(problems).toEqual([]);
  });

  test("every timeout exemption is used, so none outlives the bound it excuses", () => {
    const stale = Object.entries(BROWSER_FILES)
      .filter(([, entry]) => entry.timeout !== undefined)
      .map(([name]) => name)
      .filter((name) => !timedBounds(browserFiles()[name] ?? "").some(isTimeout));
    expect(stale).toEqual([]);
  });

  test("document-review.browser.ts and latex.browser.ts hold none", () => {
    const all = browserFiles();
    expect(timedBounds(all["document-review.browser.ts"] ?? "")).toEqual([]);
    expect(timedBounds(all["latex.browser.ts"] ?? "")).toEqual([]);
  });
});

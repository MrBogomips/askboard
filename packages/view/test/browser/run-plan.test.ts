import { describe, expect, test } from "bun:test";
import { ENGINES, type Engine } from "./harness/engines.ts";
import { BROWSER_FILES, type BrowserFileEntry } from "./harness/suites.ts";
import type { Options } from "./run-options.ts";
import { type Pass, planPasses, TIMINGS_DIR, timingsFile } from "./run-plan.ts";

const DIR = "./packages/view/test/browser";
const manifest: Record<string, BrowserFileEntry> = {
  "a.browser.ts": { smoke: true },
  "b.browser.ts": {},
  "c.browser.ts": { smoke: true, engines: ["chromium"], why: "a requirement" },
  "d.browser.ts": { perf: true },
  "e.browser.ts": { perf: true, engines: ["chromium", "webkit"], why: "a requirement" },
  "f.browser.ts": { engines: ["firefox", "webkit"], why: "a requirement" },
};

const base: Options = {
  engines: [...ENGINES],
  target: "session-process",
  runtime: "bun",
  build: false,
  serial: false,
  set: "all",
  workers: 8,
  updateTimings: false,
  extra: [],
};
const plan = (
  options: Partial<Options> = {},
  timings: (engine: Engine) => boolean = () => false,
  files = manifest,
) => planPasses({ ...base, ...options }, files, timings);
const names = (pass: Pass) => pass.files.map((file) => file.slice(DIR.length + 1));
const summary = (passes: Pass[]) => passes.map((pass) => `${pass.set}:${pass.engine}`);

describe("planPasses: which files each pass runs", () => {
  test("smoke: the smoke files of each engine, the manifest's engines applied", () => {
    const passes = plan({ set: "smoke" });
    expect(summary(passes)).toEqual(["smoke:chromium", "smoke:firefox", "smoke:webkit"]);
    expect(names(passes[0] as Pass)).toEqual(["a.browser.ts", "c.browser.ts"]);
    expect(names(passes[1] as Pass)).toEqual(["a.browser.ts"]);
  });

  test("full: every file that is not a perf file, narrowed per engine", () => {
    const passes = plan({ set: "full" });
    expect(summary(passes)).toEqual(["full:chromium", "full:firefox", "full:webkit"]);
    expect(names(passes[0] as Pass)).toEqual(["a.browser.ts", "b.browser.ts", "c.browser.ts"]);
    expect(names(passes[1] as Pass)).toEqual(["a.browser.ts", "b.browser.ts", "f.browser.ts"]);
    expect(names(passes[2] as Pass)).toEqual(["a.browser.ts", "b.browser.ts", "f.browser.ts"]);
  });

  test("perf: the perf files only, narrowed per engine", () => {
    const passes = plan({ set: "perf" });
    expect(summary(passes)).toEqual(["perf:chromium", "perf:firefox", "perf:webkit"]);
    expect(names(passes[0] as Pass)).toEqual(["d.browser.ts", "e.browser.ts"]);
    expect(names(passes[1] as Pass)).toEqual(["d.browser.ts"]);
    expect(names(passes[2] as Pass)).toEqual(["d.browser.ts", "e.browser.ts"]);
  });

  test("all: the full pass of every engine, then the perf pass of every engine", () => {
    expect(summary(plan({ set: "all" }))).toEqual([
      "full:chromium",
      "full:firefox",
      "full:webkit",
      "perf:chromium",
      "perf:firefox",
      "perf:webkit",
    ]);
  });

  test("no pass starts a file that has no tests for its engine, and none starts with no file", () => {
    const only = { "g.browser.ts": { engines: ["chromium"], why: "x" } } as const;
    const passes = plan({ set: "full" }, () => false, only);
    expect(summary(passes)).toEqual(["full:chromium"]);
    expect(plan({ set: "perf" }, () => false, only)).toEqual([]);
  });

  test("runs only the engines it is given, in the harness's order, one pass each, never two at once", () => {
    const passes = plan({ set: "full", engines: ["webkit", "chromium"] });
    expect(summary(passes)).toEqual(["full:webkit", "full:chromium"]);
    for (const set of ["smoke", "full", "perf", "all"] as const) {
      const all = plan({ set });
      for (const engine of ENGINES) {
        for (const kind of ["smoke", "full", "perf"] as const) {
          expect(
            all.filter((pass) => pass.set === kind && pass.engine === engine).length,
          ).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  test("files are paths from the repository root, sorted by name", () => {
    const [first] = plan({ set: "full" });
    expect(first?.files.every((file) => file.startsWith(`${DIR}/`))).toBe(true);
    expect(first?.files).toEqual([...(first?.files ?? [])].sort());
  });

  test("on the real manifest, smoke and perf are what the manifest flags, and perf is never in full", () => {
    const smoke = planPasses(
      { ...base, set: "smoke", engines: ["chromium"] },
      BROWSER_FILES,
      () => false,
    );
    const flagged = Object.entries(BROWSER_FILES)
      .filter(([, entry]) => entry.smoke)
      .map(([name]) => name)
      .sort();
    expect(names(smoke[0] as Pass)).toEqual(flagged);
    const perfNames = Object.entries(BROWSER_FILES)
      .filter(([, entry]) => entry.perf)
      .map(([name]) => name);
    for (const pass of planPasses({ ...base, set: "full" }, BROWSER_FILES, () => false)) {
      for (const name of perfNames) expect(names(pass)).not.toContain(name);
    }
  });
});

describe("planPasses: the bun test arguments", () => {
  const argsOf = (options: Partial<Options>, timings?: (engine: Engine) => boolean) =>
    plan(options, timings)[0]?.args ?? [];

  test("a smoke or full pass is parallel over the workers, with the timeout and the files", () => {
    for (const set of ["smoke", "full"] as const) {
      const [pass] = plan({ set, workers: 5 });
      expect(pass?.args.slice(0, 4)).toEqual(["test", "--timeout", "60000", "--parallel=5"]);
      for (const file of pass?.files ?? []) expect(pass?.args).toContain(file);
    }
  });

  test("a perf pass has no --parallel, no --shard and no --timings, whatever the options", () => {
    const passes = plan(
      { set: "perf", workers: 9, shard: { k: 1, n: 4 }, updateTimings: true },
      () => true,
    );
    expect(passes.length).toBeGreaterThan(0);
    for (const { args } of passes) {
      expect(args.join(" ")).not.toMatch(/--parallel|--shard|--timings|--update-timings/);
    }
  });

  test("all gives the full pass its workers and shard, and the perf pass neither", () => {
    const passes = plan({ set: "all", workers: 3, shard: { k: 2, n: 3 } });
    for (const pass of passes) {
      const text = pass.args.join(" ");
      if (pass.set === "full") expect(text).toContain("--parallel=3 --shard=2/3");
      else expect(text).not.toMatch(/--parallel|--shard/);
    }
  });

  test("--shard gives bun test --shard=k/n", () => {
    expect(argsOf({ set: "full", shard: { k: 3, n: 4 } })).toContain("--shard=3/4");
    expect(argsOf({ set: "full" }).join(" ")).not.toContain("--shard");
  });

  test("--timings is added only when the engine's file exists, with or without a shard", () => {
    const has = (engine: Engine) => engine === "firefox";
    for (const shard of [undefined, { k: 1, n: 2 }]) {
      const passes = plan({ set: "full", ...(shard === undefined ? {} : { shard }) }, has);
      const timings = (engine: Engine) => {
        const args = passes.find((pass) => pass.engine === engine)?.args ?? [];
        return args.includes("--timings") ? args[args.indexOf("--timings") + 1] : undefined;
      };
      expect(timings("chromium")).toBeUndefined();
      expect(timings("firefox")).toBe(timingsFile("firefox"));
      expect(timings("webkit")).toBeUndefined();
    }
    expect(timingsFile("webkit")).toBe(`${TIMINGS_DIR}/webkit.json`);
    expect(TIMINGS_DIR).toBe("packages/view/test/browser/timings");
  });

  test("--update-timings writes each engine's file, naming it even before it exists", () => {
    const [pass] = plan({ set: "full", updateTimings: true }, () => false);
    expect(pass?.args).toContain("--update-timings");
    expect(pass?.args[(pass?.args.indexOf("--timings") ?? -1) + 1]).toBe(timingsFile("chromium"));
    expect(plan({ set: "full" })[0]?.args).not.toContain("--update-timings");
  });

  // --timings-out (C5): the pass writes to the file it is given and never to the committed one; the
  // runner seeds that file from the committed one, so the shard is still balanced by it.
  describe("--timings-out", () => {
    const out = "timings-out/chromium-2of4.json";
    const sharded = {
      set: "full",
      engines: ["chromium"],
      timingsOut: out,
      shard: { k: 2, n: 4 },
    } as const;

    test("gives bun test --timings <file> --update-timings, with the shard, and not the committed file", () => {
      const [pass] = plan(sharded, () => true);
      expect(pass?.args).toContain("--shard=2/4");
      expect(pass?.args[(pass?.args.indexOf("--timings") ?? -1) + 1]).toBe(out);
      expect(pass?.args).toContain("--update-timings");
      expect(pass?.args).not.toContain(timingsFile("chromium"));
      expect(pass?.args.filter((arg) => arg === "--timings")).toHaveLength(1);
    });

    test("seeds the file from the committed one when it exists, else from nothing", () => {
      expect(plan(sharded, () => true)[0]?.timingsOut).toEqual({
        file: out,
        base: timingsFile("chromium"),
      });
      expect(plan(sharded, () => false)[0]?.timingsOut).toEqual({ file: out, base: undefined });
    });

    test("works unsharded, and the timings come first in the arguments' order of use", () => {
      const [pass] = plan({ set: "full", engines: ["firefox"], timingsOut: out }, () => true);
      expect(pass?.args.join(" ")).not.toContain("--shard");
      expect(pass?.args).toContain("--update-timings");
      expect(pass?.timingsOut?.file).toBe(out);
      expect(pass?.args.indexOf("--timings")).toBeLessThan(
        pass?.args.indexOf("--update-timings") ?? 0,
      );
    });

    test("a pass without it has no seed, and the committed file stays named for --update-timings", () => {
      for (const pass of plan({ set: "full" }, () => true)) expect(pass.timingsOut).toBeUndefined();
      expect("timingsOut" in (plan({ set: "smoke" })[0] ?? {})).toBe(false);
    });
  });

  test("no pass carries --no-isolate", () => {
    for (const set of ["smoke", "full", "perf", "all"] as const) {
      for (const pass of plan({ set }, () => true)) expect(pass.args).not.toContain("--no-isolate");
    }
  });

  test("the extra arguments come last, after the files", () => {
    const [pass] = plan({ set: "smoke", extra: ["-t", "reload"] });
    expect(pass?.args.slice(-2)).toEqual(["-t", "reload"]);
    expect(pass?.args.indexOf("-t")).toBeGreaterThan(pass?.args.indexOf(pass?.files[0] ?? "") ?? 0);
  });

  test("--workers 1 still gives --parallel=1, so the files run in argument order", () => {
    expect(argsOf({ set: "full", workers: 1 })).toContain("--parallel=1");
  });
});

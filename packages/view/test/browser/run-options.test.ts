import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs, USAGE } from "./run-options.ts";

const defaults = { env: {}, cores: 14 };
const parse = (...args: string[]) => parseArgs(args, defaults);

describe("parseArgs", () => {
  test("defaults: every engine, the session process on Bun, a build, the set `all`, one worker per core", () => {
    expect(parse()).toEqual({
      engines: ["chromium", "firefox", "webkit"],
      target: "test-server",
      runtime: "bun",
      build: true,
      serial: false,
      set: "all",
      workers: 14,
      updateTimings: false,
      rerunFailed: 0,
      extra: [],
    });
    expect(parseArgs([], { env: {}, cores: 0 }).workers).toBe(1);
  });

  // #227 point 2: a failing file runs again alone, to tell load timeouts from real failures; the
  // full output goes to a log file and the console gets the digest.
  test("parses --rerun-failed and --log", () => {
    expect(parse("--rerun-failed", "1", "--log", "out/browser.log")).toMatchObject({
      rerunFailed: 1,
      log: "out/browser.log",
    });
    expect(parse("--rerun-failed", "0").rerunFailed).toBe(0);
    expect(() => parse("--rerun-failed", "-1")).toThrow("--rerun-failed takes a whole number");
    expect(() => parse("--rerun-failed", "4")).toThrow("at most 3");
    expect(() => parse("--log", "")).toThrow("--log takes a file name");
  });

  test("reads the engines, the target and the runtime from the environment, as before", () => {
    const env = {
      ASKBOARD_E2E_ENGINES: "webkit",
      ASKBOARD_E2E_TARGET: "session-process",
      ASKBOARD_E2E_RUNTIME: "node",
    };
    expect(parseArgs([], { env, cores: 4 })).toMatchObject({
      engines: ["webkit"],
      target: "session-process",
      runtime: "node",
    });
  });

  test("parses --set, --workers and --shard beside the existing options", () => {
    const options = parse(
      "--no-build",
      "--target",
      "session-process",
      "--set",
      "full",
      "--engines",
      "firefox,chromium",
      "--workers",
      "6",
      "--shard",
      "2/4",
      "--runtime",
      "node",
    );
    expect(options).toMatchObject({
      build: false,
      target: "session-process",
      runtime: "node",
      engines: ["chromium", "firefox"],
      set: "full",
      workers: 6,
      shard: { k: 2, n: 4 },
      updateTimings: false,
    });
  });

  // `bun test --update-timings` replaces the file, so only an unsharded run of every non-perf file
  // may write it (review 2.5, S-1); a shard is for the smoke and full passes alone.
  test("takes --update-timings on the full and all sets, unsharded, and --shard on smoke and full", () => {
    for (const set of ["full", "all"]) {
      expect(parse("--set", set, "--update-timings").updateTimings).toBe(true);
      expect(parse("--update-timings", "--set", set).updateTimings).toBe(true);
    }
    expect(parse("--update-timings").set).toBe("all");
    for (const set of ["smoke", "full"]) {
      expect(parse("--set", set, "--shard", "1/4").shard).toEqual({ k: 1, n: 4 });
    }
  });

  // `--timings-out <file>` (decision 5, C5): a shard job writes its timings to a file of its own, so
  // it takes the full set and one engine, sharded or not, and never the committed engine file.
  test("takes --timings-out with the full set and one engine, with or without --shard", () => {
    const withOut = (...args: string[]) =>
      parse("--set", "full", "--engines", "chromium", "--timings-out", "out/c-1of4.json", ...args);
    expect(withOut().timingsOut).toBe("out/c-1of4.json");
    expect(withOut("--shard", "1/4")).toMatchObject({
      timingsOut: "out/c-1of4.json",
      shard: { k: 1, n: 4 },
    });
    expect(parse("--set", "full", "--engines", "webkit").timingsOut).toBeUndefined();
    expect("timingsOut" in parse("--set", "full", "--engines", "webkit")).toBe(false);
    // The order of the options does not matter.
    expect(
      parse("--timings-out", "t.json", "--engines", "firefox", "--set", "full").timingsOut,
    ).toBe("t.json");
  });

  test("accepts each set and --serial, which changes nothing", () => {
    for (const set of ["smoke", "full", "perf", "all"] as const) {
      expect(parse("--set", set).set).toBe(set);
    }
    expect(parse("--serial").serial).toBe(true);
  });

  test("takes what follows `--` as more bun test arguments, whatever it holds", () => {
    expect(parse("--set", "smoke", "--", "-t", "reload", "--set").extra).toEqual([
      "-t",
      "reload",
      "--set",
    ]);
    expect(parse("--no-build", "--", "-t", "x")).toMatchObject({ build: false, set: "all" });
  });

  const refusals: [string, string[], RegExp][] = [
    ["an unknown set", ["--set", "quick"], /set "quick"/],
    ["a set with no value", ["--set"], /usage:/],
    ["zero workers", ["--workers", "0"], /workers/],
    ["negative workers", ["--workers", "-2"], /workers/],
    ["fractional workers", ["--workers", "1.5"], /workers/],
    ["workers that are not a number", ["--workers", "many"], /workers/],
    ["a shard with k above n", ["--shard", "5/4"], /shard/],
    ["a shard of zero", ["--shard", "0/4"], /shard/],
    ["a shard with n of zero", ["--shard", "1/0"], /shard/],
    ["a shard with no slash", ["--shard", "3"], /shard/],
    ["a malformed shard", ["--shard", "a/b"], /shard/],
    ["a shard with extra parts", ["--shard", "1/2/3"], /shard/],
    [
      "--update-timings with --shard",
      ["--set", "full", "--update-timings", "--shard", "1/2"],
      /update-timings.*shard/,
    ],
    [
      "--update-timings with --shard, in the other order",
      ["--shard", "1/2", "--set", "full", "--update-timings"],
      /update-timings.*shard/,
    ],
    [
      "--update-timings with the smoke set",
      ["--set", "smoke", "--update-timings"],
      /update-timings.*smoke/,
    ],
    [
      "--update-timings with the perf set",
      ["--set", "perf", "--update-timings"],
      /update-timings.*perf/,
    ],
    [
      "--timings-out with the smoke set",
      ["--set", "smoke", "--engines", "chromium", "--timings-out", "t.json"],
      /timings-out.*smoke/,
    ],
    [
      "--timings-out with the perf set",
      ["--set", "perf", "--engines", "chromium", "--timings-out", "t.json"],
      /timings-out.*perf/,
    ],
    [
      "--timings-out with the all set, by default",
      ["--engines", "chromium", "--timings-out", "t.json"],
      /timings-out.*all/,
    ],
    [
      "--timings-out with two engines",
      ["--set", "full", "--engines", "chromium,webkit", "--timings-out", "t.json"],
      /timings-out.*one engine/,
    ],
    [
      "--timings-out with every engine, by default",
      ["--set", "full", "--timings-out", "t.json"],
      /timings-out.*one engine/,
    ],
    [
      "--timings-out with --update-timings",
      ["--set", "full", "--engines", "chromium", "--timings-out", "t.json", "--update-timings"],
      /timings-out.*update-timings/,
    ],
    ["--timings-out with no value", ["--timings-out"], /usage:/],
    ["--timings-out with an empty value", ["--timings-out", ""], /timings-out/],
    ["--shard with the all set, by default", ["--shard", "1/2"], /shard.*all/],
    ["--shard with the all set", ["--set", "all", "--shard", "1/2"], /shard.*all/],
    ["--shard with the perf set", ["--set", "perf", "--shard", "1/2"], /shard.*perf/],
    ["an unknown option", ["--fast"], /usage:/],
    ["an unknown target", ["--target", "mars"], /target "mars"/],
  ];
  for (const [what, args, message] of refusals) {
    test(`refuses ${what}`, () => {
      expect(() => parse(...args)).toThrow(message);
    });
  }

  test("names the usage line in a refusal, and the usage line names every option", () => {
    expect(() => parse("--workers", "0")).toThrow(USAGE);
    expect(() => parse("--set", "all", "--shard", "1/2")).toThrow(USAGE);
    expect(() => parse("--set", "smoke", "--update-timings")).toThrow(USAGE);
    expect(() => parse("--set", "perf", "--timings-out", "t.json")).toThrow(USAGE);
    for (const option of [
      "--engines",
      "--target",
      "--runtime",
      "--no-build",
      "--serial",
      "--set",
      "--workers",
      "--shard",
      "--update-timings",
      "--timings-out",
    ]) {
      expect(USAGE).toContain(option);
    }
  });
});

describe("package.json", () => {
  const scripts: Record<string, string> = JSON.parse(
    readFileSync(join(import.meta.dir, "..", "..", "..", "..", "package.json"), "utf8"),
  ).scripts;

  // The arguments the browser runner receives in a script: the `&&` part that runs it.
  const runnerArgs = (name: string): string[] => {
    const part = (scripts[name] ?? "")
      .split("&&")
      .map((piece) => piece.trim().split(/\s+/))
      .find((words) => words.some((word) => word.endsWith("browser/run.ts")));
    expect(part).toBeDefined();
    return (part ?? []).slice(
      (part ?? []).findIndex((word) => word.endsWith("browser/run.ts")) + 1,
    );
  };

  test("test:e2e keeps its command, which now runs the set `all`, then conformance on Bun", () => {
    const options = parseArgs(runnerArgs("test:e2e"), defaults);
    expect(options).toMatchObject({ build: false, target: "session-process", set: "all" });
    expect(scripts["test:e2e"]).toEndWith(
      "&& bun packages/server/test/conformance/run.ts --runtime bun",
    );
  });

  test("test:e2e:smoke runs the smoke set in Chromium, then conformance on Bun (D1, D4)", () => {
    const options = parseArgs(runnerArgs("test:e2e:smoke"), defaults);
    expect(options).toMatchObject({
      build: false,
      target: "session-process",
      set: "smoke",
      engines: ["chromium"],
    });
    expect(scripts["test:e2e:smoke"]).toEndWith(
      "&& bun packages/server/test/conformance/run.ts --runtime bun",
    );
  });
});

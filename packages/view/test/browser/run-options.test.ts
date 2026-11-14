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
      extra: [],
    });
    expect(parseArgs([], { env: {}, cores: 0 }).workers).toBe(1);
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

  test("parses --set, --workers, --shard and --update-timings beside the existing options", () => {
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
      "--update-timings",
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
      updateTimings: true,
    });
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

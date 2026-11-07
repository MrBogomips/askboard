import { describe, expect, test } from "bun:test";
import { resultHoldsNothing } from "../src/index.ts";
import { EMPTY_RESULTS } from "../src/widgets/registry-check.ts";

describe("resultHoldsNothing (widget-registry, one definition)", () => {
  test.each([
    ["null", null],
    ["an empty string", ""],
    ["{}", {}],
    ["[]", []],
    ["nested empties", { a: [[], {}, [{ b: null }]], c: "" }],
    ["an array of nulls and empty strings", [null, ""]],
  ])("%s holds nothing", (_, value) => {
    expect(resultHoldsNothing(value)).toBe(true);
  });

  test.each([
    ["false", false],
    ["0", 0],
    ["a string", "a"],
    ["a blank string", " "],
    ["a number deep inside", { a: [{ b: [1] }] }],
    ["false beside empties", { a: [], b: { c: false } }],
  ])("%s is content", (_, value) => {
    expect(resultHoldsNothing(value)).toBe(false);
  });

  test("reads a very deep value without recursing", () => {
    let deep: unknown = [];
    for (let i = 0; i < 100000; i++) deep = [deep];
    expect(resultHoldsNothing(deep)).toBe(true);
  });

  test("every sample the registry's result-empty rule tries holds nothing", () => {
    expect(EMPTY_RESULTS.length).toBeGreaterThanOrEqual(8);
    for (const [shown, value] of EMPTY_RESULTS) {
      expect([shown, resultHoldsNothing(value)]).toEqual([shown, true]);
    }
  });

  test("reads an object it reaches twice once, so a chain of shared objects ends", () => {
    let reads = 0;
    const shared = {
      get leaf() {
        reads += 1;
        return "";
      },
    };
    expect(resultHoldsNothing({ a: shared, b: [shared, shared] })).toBe(true);
    expect(reads).toBe(1);
    let chain: unknown = "";
    for (let i = 0; i < 60; i++) chain = [chain, chain];
    expect(settles(`let c = ""; for (let i = 0; i < 60; i++) c = [c, c]; return c;`)).toBe("true");
  });
});

// A value that holds itself never returns from a loop that has no visited set, and a synchronous
// loop cannot be timed out from inside the test: the check runs in a process that is killed after
// one second (widget-registry task 5.14, deferred U-1; contract spec, "A result that holds itself").
const SOURCE = new URL("../src/widgets/result-content.ts", import.meta.url).pathname;
const settles = (build: string): string => {
  const script = `import { resultHoldsNothing } from ${JSON.stringify(SOURCE)};
const value = (() => { ${build} })();
console.log(String(resultHoldsNothing(value)));`;
  const ran = Bun.spawnSync([process.execPath, "-e", script], { timeout: 1000 });
  return ran.exitCode === 0 ? ran.stdout.toString().trim() : "did not return in one second";
};

describe("resultHoldsNothing on a value that holds itself (U-1)", () => {
  test("an object whose field holds the object returns, saying it holds nothing", () => {
    expect(settles("const a = {}; a.self = a; return a;")).toBe("true");
  });

  test("an array holding itself beside an empty string returns, saying it holds nothing", () => {
    expect(settles('const a = []; a.push(a, ""); return a;')).toBe("true");
  });

  test("two objects that hold each other return", () => {
    expect(settles("const a = {}; const b = { a }; a.b = b; return a;")).toBe("true");
  });

  test("a value that holds itself beside content still holds something", () => {
    expect(settles("const a = { n: 1 }; a.self = a; return a;")).toBe("false");
  });

  test("an array nested a million levels with 1 at the bottom returns, saying it holds something", () => {
    expect(settles("let v = 1; for (let i = 0; i < 1000000; i++) v = [v]; return v;")).toBe(
      "false",
    );
  });

  test("an array nested a million levels with nothing at the bottom holds nothing", () => {
    expect(settles('let v = ""; for (let i = 0; i < 1000000; i++) v = [v]; return v;')).toBe(
      "true",
    );
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, mergeTimings, type Timings } from "./merge-timings.ts";

// tools/ci/merge-timings.ts combines the per-shard timings files of one engine's full set into one
// file in tools/test-timings.json's format (e2e-cadence, decision 5, C5). Bun 1.4.4 under --shard
// DROPS the entries of the files a shard did not run (the probe of task 5.2), so a shard file holds
// only its own files; a Bun that kept them would give every shard file the base's value for the
// rest. The merge reads either: per path, the one shard value that differs from the base.

const timings = (files: Record<string, number>): Timings => ({ version: 1, files });
const BASE = timings({ "a.ts": 100, "b.ts": 200, "c.ts": 300, "d.ts": 400 });

describe("mergeTimings", () => {
  test("shards that drop the files they did not run: each path comes from the shard that ran it", () => {
    const merged = mergeTimings(BASE, [
      timings({ "a.ts": 111, "b.ts": 222 }),
      timings({ "c.ts": 333, "d.ts": 444 }),
    ]);
    expect(merged.files).toEqual({ "a.ts": 111, "b.ts": 222, "c.ts": 333, "d.ts": 444 });
  });

  test("shards that keep the files they did not run: the one value that differs from the base wins", () => {
    const merged = mergeTimings(BASE, [
      timings({ "a.ts": 111, "b.ts": 200, "c.ts": 300, "d.ts": 400 }),
      timings({ "a.ts": 100, "b.ts": 222, "c.ts": 300, "d.ts": 400 }),
      timings({ "a.ts": 100, "b.ts": 200, "c.ts": 333, "d.ts": 444 }),
    ]);
    expect(merged.files).toEqual({ "a.ts": 111, "b.ts": 222, "c.ts": 333, "d.ts": 444 });
  });

  test("a path no shard changed keeps the base's value, and a path the base lacks comes from its shard", () => {
    const merged = mergeTimings(BASE, [
      timings({ "a.ts": 100, "new.ts": 55 }),
      timings({ "b.ts": 200 }),
    ]);
    expect(merged.files).toEqual({
      "a.ts": 100,
      "b.ts": 200,
      "c.ts": 300,
      "d.ts": 400,
      "new.ts": 55,
    });
  });

  test("an empty base takes every shard value; the same new value in two shards is not a conflict", () => {
    const merged = mergeTimings(timings({}), [
      timings({ "a.ts": 5, "b.ts": 6 }),
      timings({ "c.ts": 7, "b.ts": 6 }),
    ]);
    expect(merged.files).toEqual({ "a.ts": 5, "b.ts": 6, "c.ts": 7 });
  });

  test("two shards that differ on one path, from the base and from each other, are an error naming it", () => {
    expect(() => mergeTimings(BASE, [timings({ "a.ts": 111 }), timings({ "a.ts": 122 })])).toThrow(
      /a\.ts/,
    );
    expect(() =>
      mergeTimings(timings({}), [timings({ "z.ts": 1 }), timings({ "z.ts": 2 })]),
    ).toThrow(/z\.ts/);
  });

  test("no shard file gives the base back; the output is ordered slowest first, then by path", () => {
    expect(mergeTimings(BASE, []).files).toEqual(BASE.files);
    const merged = mergeTimings(timings({ "x.ts": 1, "b.ts": 9, "a.ts": 9 }), []);
    expect(Object.keys(merged.files)).toEqual(["a.ts", "b.ts", "x.ts"]);
    expect(merged.version).toBe(1);
  });

  test("does not change its inputs", () => {
    const shard = timings({ "a.ts": 111 });
    const before = JSON.stringify([BASE, shard]);
    mergeTimings(BASE, [shard]);
    expect(JSON.stringify([BASE, shard])).toBe(before);
  });
});

describe("main", () => {
  let dir: string;
  const path = (name: string) => join(dir, name);
  const write = (name: string, value: unknown) =>
    writeFileSync(path(name), typeof value === "string" ? value : JSON.stringify(value));
  const read = (name: string) => JSON.parse(readFileSync(path(name), "utf8")) as Timings;
  const run = (...args: string[]) => {
    const messages: string[] = [];
    const code = main(args, (line) => messages.push(line));
    return { code, text: messages.join("\n") };
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "merge-timings-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("reads the base and the shard files, and writes the merged file in the committed format", () => {
    write("base.json", BASE);
    write("s1.json", timings({ "a.ts": 111 }));
    write("s2.json", timings({ "d.ts": 444 }));
    const { code } = run(
      path("base.json"),
      path("s1.json"),
      path("s2.json"),
      "--out",
      path("out.json"),
    );
    expect(code).toBe(0);
    expect(read("out.json").files).toEqual({ "a.ts": 111, "b.ts": 200, "c.ts": 300, "d.ts": 444 });
    const text = readFileSync(path("out.json"), "utf8");
    expect(text.endsWith("}\n")).toBe(true);
    expect(text).toContain('\n  "version": 1,\n  "files": {\n    "d.ts": 444,');
  });

  test("an empty base, and the output may be named before the inputs", () => {
    write("base.json", timings({}));
    write("s1.json", timings({ "a.ts": 5 }));
    expect(run("--out", path("out.json"), path("base.json"), path("s1.json")).code).toBe(0);
    expect(read("out.json").files).toEqual({ "a.ts": 5 });
  });

  test("a conflict exits 1, names the path, and writes nothing", () => {
    write("base.json", BASE);
    write("s1.json", timings({ "a.ts": 111 }));
    write("s2.json", timings({ "a.ts": 122 }));
    const { code, text } = run(
      path("base.json"),
      path("s1.json"),
      path("s2.json"),
      "--out",
      path("out.json"),
    );
    expect(code).toBe(1);
    expect(text).toContain("a.ts");
    expect(Bun.file(path("out.json")).size).toBe(0);
  });

  test("refuses a missing --out, a missing base, a missing or malformed file", () => {
    write("base.json", BASE);
    write("bad.json", "{ not json");
    write("version.json", { version: 2, files: {} });
    write("shape.json", { version: 1, files: { "a.ts": "slow" } });
    write("nan.json", { version: 1, files: { "a.ts": -1 } });
    expect(run(path("base.json")).code).toBe(2);
    expect(run("--out", path("out.json")).code).toBe(2);
    expect(run("--out").code).toBe(2);
    expect(run(path("nope.json"), "--out", path("out.json")).code).toBe(1);
    expect(run(path("base.json"), path("nope.json"), "--out", path("out.json")).code).toBe(1);
    for (const bad of ["bad.json", "version.json", "shape.json", "nan.json"]) {
      const { code, text } = run(path("base.json"), path(bad), "--out", path("out.json"));
      expect(code).toBe(1);
      expect(text).toContain(bad);
    }
    expect(run(path("base.json"), "--fast", "--out", path("out.json")).code).toBe(2);
    expect(Bun.file(path("out.json")).size).toBe(0);
  });
});

describe("mergeTimings reads own keys only (X-2)", () => {
  // JSON.parse makes `__proto__` an own key, as a file read from disk does.
  const parse = (text: string): Timings => JSON.parse(text) as Timings;
  const own = (value: Timings): [string, number][] => Object.entries(value.files);

  test("names that Object.prototype holds, in the base only, stay numbers and stay", () => {
    const base = parse(
      '{"version":1,"files":{"__proto__":5,"constructor":7,"toString":9,"a.ts":3}}',
    );
    const merged = mergeTimings(base, [timings({ "a.ts": 4 })]);
    expect(own(merged)).toEqual([
      ["toString", 9],
      ["constructor", 7],
      ["__proto__", 5],
      ["a.ts", 4],
    ]);
    expect(JSON.stringify(merged)).toContain('"__proto__":5');
  });

  test("in a shard only, they come from the shard as numbers", () => {
    const shard = parse('{"version":1,"files":{"__proto__":5,"constructor":7,"toString":9}}');
    const merged = mergeTimings(timings({ "a.ts": 3 }), [shard]);
    expect(own(merged)).toEqual([
      ["toString", 9],
      ["constructor", 7],
      ["__proto__", 5],
      ["a.ts", 3],
    ]);
  });

  test("in both, an unchanged value is the base's and a changed one is the shard's", () => {
    const base = parse('{"version":1,"files":{"__proto__":5,"constructor":7}}');
    const shard = parse('{"version":1,"files":{"__proto__":5,"constructor":8}}');
    const merged = mergeTimings(base, [shard]);
    expect(own(merged)).toEqual([
      ["constructor", 8],
      ["__proto__", 5],
    ]);
  });

  test("a shard lacking the names does not turn them into the prototype's members", () => {
    const base = parse('{"version":1,"files":{"__proto__":5,"constructor":7,"a.ts":3}}');
    const merged = mergeTimings(base, [timings({ "a.ts": 4 }), timings({ "b.ts": 2 })]);
    for (const [, value] of own(merged)) expect(typeof value).toBe("number");
    expect(own(merged).length).toBe(4);
  });
});

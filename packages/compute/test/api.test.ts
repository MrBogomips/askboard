import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import * as compute from "../src/index.ts";

const SOURCES = join(import.meta.dir, "..", "src");

// Comments may name what the code must not do; only code counts.
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("compute's sources", () => {
  test("run no dynamic code and reach no prototype (AD-13)", async () => {
    const files = [...new Bun.Glob("**/*.ts").scanSync({ cwd: SOURCES })];
    expect(files.length).toBeGreaterThan(10);
    const forbidden =
      /\beval\b|new Function|\bFunction\(|\bwith\s*\(|Reflect\.|Object\.getPrototypeOf|\.prototype\b|__proto__/;
    for (const file of files) {
      const code = withoutComments(await Bun.file(join(SOURCES, file)).text());
      expect({ file, match: forbidden.exec(code)?.[0] }).toEqual({ file, match: undefined });
    }
  });
});

describe("the public API", () => {
  test("builds, evaluates, sets and recalculates by address", () => {
    const graph = compute.buildGraph({
      items: [
        {
          kind: "fields",
          id: "x",
          fields: { a: { type: "number", value: 2 }, b: { type: "number", formula: "[x.a]^2" } },
        },
      ],
    });
    expect(graph.warnings).toEqual([]);
    const values = compute.evaluateGraph(graph, compute.createOwnEngine());
    expect(values.read("x.b")).toBe(4);
    values.set("x.a", 3);
    expect(values.recalc()).toEqual(["x.b"]);
    expect(values.read("x.b")).toBe(9);
    expect(compute.isFormulaError(values.read("x.nope"))).toBe(true);
  });

  test("names the source error", () => {
    expect(() => compute.buildGraph({ items: [{ kind: "fields", id: "x y" }] })).toThrow(
      compute.GraphSourceError,
    );
  });
});

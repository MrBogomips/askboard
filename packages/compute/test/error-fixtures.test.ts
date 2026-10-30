import { describe, expect, test } from "bun:test";
import { buildGraph, compiledOf } from "../src/graph/build.ts";
import { ERROR_FIXTURES } from "./fixtures/index.ts";

const kindAt = (warning: { error: string; address: string }): string =>
  `${warning.error}@${warning.address}`;

describe("error fixtures, from buildGraph alone", () => {
  test("cover every probe error case and the generated hostile ones", () => {
    expect(ERROR_FIXTURES.map((fixture) => fixture.id)).toEqual([
      "missing-reference",
      "missing-item-wildcard",
      "flat-not-path",
      "cycle-direct",
      "cycle-indirect",
      "cycle-wildcard",
      "not-whitelisted",
      "syntax",
      "division-by-zero",
      "mixed-currencies",
      "hostile-ids",
      "hostile-size",
      "hostile-chain",
    ]);
  });

  test.each(ERROR_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    "%s: every listed warning, and only those",
    (_, fixture) => {
      const graph = buildGraph({ items: fixture.items });
      expect(graph.warnings.map(kindAt).sort()).toEqual(fixture.warnings.map(kindAt).sort());
      // A warned node reads as its error without any engine.
      const compiled = new Map(compiledOf(graph).nodes.map((node) => [node.address, node]));
      for (const warning of fixture.warnings) {
        expect(compiled.get(warning.address)?.error?.error).toBe(warning.error as never);
      }
    },
  );
});

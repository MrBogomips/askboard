import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { WIDGET_TYPES } from "@askboard/contract";

// Core spec: Values only for items that take edits (atoms, task 5.15). The board sends `values`
// from the draft, which only an item's own `onValueChange` or `onValuesChange` fills; so a shipped
// component of a type whose registry entry declares no `edits` must never call either of the
// port's callbacks, or `ask-core` would refuse its answer. A component hands the port's callbacks on
// by name; the Radix attribute `onValueChange={...}` of a slider or a group is a different prop.

const SOURCES = [
  new URL("../../widgets/src/", import.meta.url).pathname,
  new URL("../src/catalog/", import.meta.url).pathname,
];

const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

// The code of a file with the Radix `onValueChange={` attribute taken out.
const portUses = (path: string): string[] =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .map((line) => line.replace(/\bonValueChange=\{/g, ""))
    .filter((line) => /\bonValuesChange\b|\bonValueChange\b/.test(line));

const withoutEdits = WIDGET_TYPES.filter((entry) => entry.edits === undefined);

describe("no component of a type without edits sends a value", () => {
  test("the types without edits are the ones the registry says", () => {
    expect(withoutEdits.map((entry) => entry.type)).not.toContain("tree");
    expect(withoutEdits.length).toBeGreaterThanOrEqual(12);
  });

  for (const entry of withoutEdits) {
    test(`${entry.type}: its source calls neither onValueChange nor onValuesChange`, () => {
      const folders = SOURCES.map((root) => join(root, entry.type)).filter(existsSync);
      // A type with no source of its own (a probe) has nothing to check; the shipped ones all do.
      expect(folders.length).toBeGreaterThan(0);
      const uses = folders
        .flatMap(filesUnder)
        .flatMap((path) => portUses(path).map((l) => `${path}: ${l.trim()}`));
      expect(uses).toEqual([]);
    });
  }

  test("the scan finds the callbacks in a type that does take edits", () => {
    const tree = filesUnder(join(SOURCES[0] as string, "tree")).flatMap(portUses);
    expect(tree.length).toBeGreaterThan(0);
  });
});

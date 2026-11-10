// The override check's default tables without the registry (keyboard-shortcuts-help, task 10.7,
// review 10.5 S-43; design decisions 13, 18 and 19; contract spec: The override check's default
// tables). The check and the board page read one list of the registered key tables, which equals
// what the registry holds; nothing under `keys/` and no widget's `keys.ts` imports the registry.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type KeyOverrides,
  keyExitActions,
  keyOverridesProblems,
  REGISTERED_KEY_TABLES,
  WIDGET_TYPES,
} from "../src/index.ts";

const SRC = join(import.meta.dir, "..", "src");

describe("REGISTERED_KEY_TABLES", () => {
  test("is frozen", () => {
    expect(Object.isFrozen(REGISTERED_KEY_TABLES)).toBe(true);
  });

  test("holds each registered type with a key table, in the registry's order, and no other", () => {
    const derived = WIDGET_TYPES.filter((entry) => entry.keys !== undefined);
    expect(derived.length).toBeGreaterThan(0);
    expect(REGISTERED_KEY_TABLES.map((entry) => entry.type)).toEqual(
      derived.map((entry) => entry.type),
    );
    for (const [at, entry] of derived.entries()) {
      expect(REGISTERED_KEY_TABLES[at]?.keys).toBe(entry.keys as never);
    }
    // The other way: every listed type is a registered one.
    const registered = new Set(WIDGET_TYPES.map((entry) => entry.type));
    for (const entry of REGISTERED_KEY_TABLES) expect(registered.has(entry.type)).toBe(true);
  });
});

describe("the check's default is the registry's types", () => {
  const rules: readonly (readonly [string, unknown])[] = [
    ["{}", {}],
    [
      "the PO's example",
      { "move.top": ["Mod+Alt+ArrowUp"], "move.bottom": ["Mod+Alt+ArrowDown"], "select.all": [] },
    ],
    ["action", { "no.such": ["F2"] }],
    ["native", { "gantt.togglePredecessor": ["F2"] }],
    ["notation", { "move.up": ["Ctrl+"] }],
    ["hold", { "move.up": ["ArrowUp"] }],
    ["reserved", { "move.up": ["Mod+q"] }],
    ["conflict", { "move.up": ["ArrowDown"] }],
    ["exit", { "edit.cancel": [] }],
    ["keys.open", { "keys.open": ["Enter"] }],
    ["not an object", [] as unknown],
  ];

  test.each(rules)("keyOverridesProblems(x) equals the registry's on %s", (_name, given) => {
    const overrides = given as KeyOverrides;
    expect(keyOverridesProblems(overrides)).toEqual(keyOverridesProblems(overrides, WIDGET_TYPES));
  });

  test("the rules above each find a problem, so the comparison means something", () => {
    for (const [name, given] of rules.slice(2, 10)) {
      expect({ name, found: keyOverridesProblems(given as KeyOverrides).length > 0 }).toEqual({
        name,
        found: true,
      });
    }
  });

  test("keyExitActions() equals keyExitActions(WIDGET_TYPES)", () => {
    expect(keyExitActions()).toEqual(keyExitActions(WIDGET_TYPES));
    expect(keyExitActions()).toContain("edit.cancel");
  });
});

// The import lines of a module, read from its text.
const importsOf = (file: string): readonly string[] =>
  [...readFileSync(file, "utf8").matchAll(/^\s*(?:import|export)\b[^;]*?from\s+"([^"]+)"/gm)].map(
    (match) => match[1] as string,
  );

const keysModules = (): readonly string[] =>
  readdirSync(join(SRC, "keys")).filter((name) => name.endsWith(".ts"));

const widgetKeyModules = (): readonly string[] =>
  readdirSync(join(SRC, "widgets"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(SRC, "widgets", entry.name, "keys.ts"))
    .filter((file) => {
      try {
        readFileSync(file);
        return true;
      } catch {
        return false;
      }
    });

const reachesRegistry = (specifier: string): boolean =>
  /(^|\/)registry(-check)?\.ts$/.test(specifier) || /(^|\/)widget\.ts$/.test(specifier);

describe("no path to the registry from the keys", () => {
  test("every module under src/keys/ is read", () => {
    expect(keysModules().length).toBeGreaterThanOrEqual(9);
    expect(widgetKeyModules().length).toBe(6);
  });

  test.each(keysModules())("keys/%s imports neither the registry nor a widget.ts", (name) => {
    const found = importsOf(join(SRC, "keys", name)).filter(reachesRegistry);
    expect({ name, found }).toEqual({ name, found: [] });
  });

  test("a widget's keys.ts imports only keys/vocabulary.ts", () => {
    for (const file of widgetKeyModules()) {
      expect({ file, imports: importsOf(file) }).toEqual({
        file,
        imports: ["../../keys/vocabulary.ts"],
      });
    }
  });
});

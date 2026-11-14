// The effective key table (keyboard-shortcuts-help, task 8.2; contract spec: The effective key
// table; design decision 18): the table with each entry's keys replaced by its action's override,
// parsed. Total: whatever cannot apply changes nothing, so an action is never half-replaced.

import { describe, expect, test } from "bun:test";
import {
  changedKeyActions,
  effectiveKeys,
  type KeyBinding,
  type KeyEntry,
  type KeyOverrides,
  type KeyTable,
  keyBinding,
  ownEntry,
  RANKING_KEYS,
  REGISTERED_KEY_TABLES,
  sameBindings,
  vocabularyEntry,
} from "../src/index.ts";

const TABLE: KeyTable = [
  vocabularyEntry("move.top", "list", "tool"),
  vocabularyEntry("move.up", "list", "tool"),
  vocabularyEntry("select.all", "list", "tool"),
  vocabularyEntry("select.none", "list", "tool"),
  vocabularyEntry("edit.cancel", "editor", "navigation"),
  { ...vocabularyEntry("cursor.up", "list", "navigation"), shows: "native" },
  ownEntry("probe.keep", "list", [keyBinding("Enter")], "tool", { readOnly: false }),
  ownEntry("probe.loud", "list", [], "tool", { readOnly: false }),
  vocabularyEntry("move.top", "grid", "tool"),
];

const find = (table: readonly KeyEntry[], action: string, part = "list"): KeyEntry => {
  const found = table.find((entry) => entry.action === action && entry.part === part);
  if (found === undefined) throw new Error(`no ${action} in ${part}`);
  return found;
};

const keysOf = (table: readonly KeyEntry[], action: string, part = "list") =>
  find(table, action, part).keys;

describe("effectiveKeys replaces and removes", () => {
  test("an override replaces an action's keys in every part that has it", () => {
    const result = effectiveKeys(TABLE, { "move.top": ["Mod+Alt+ArrowUp"] });
    const wanted: readonly KeyBinding[] = [keyBinding("ArrowUp", "mod+alt")];
    expect(keysOf(result, "move.top", "list")).toEqual(wanted);
    expect(keysOf(result, "move.top", "grid")).toEqual(wanted);
  });

  test("keeps the part, label, shows, readOnly and when of the entry, and every other entry", () => {
    const result = effectiveKeys(TABLE, { "select.none": ["Shift+Escape"], "move.up": [] });
    const before = find(TABLE, "select.none");
    const after = find(result, "select.none");
    expect(after.part).toBe(before.part);
    expect(after.label).toBe(before.label);
    expect(after.shows).toBe(before.shows);
    expect(after.readOnly).toBe(before.readOnly);
    expect(after.when).toBe("selected");
    expect(after.keys).toEqual([keyBinding("Escape", "shift")]);
    expect({ ...find(result, "move.up"), keys: undefined }).toEqual({
      ...find(TABLE, "move.up"),
      keys: undefined,
    });
    for (const entry of TABLE) {
      if (entry.action === "select.none" || entry.action === "move.up") continue;
      expect(result.find((e) => e.action === entry.action && e.part === entry.part)).toEqual(entry);
    }
  });

  test("an empty list empties the keys and keeps the entry", () => {
    const result = effectiveKeys(TABLE, { "select.all": [], "probe.keep": [] });
    expect(keysOf(result, "select.all")).toEqual([]);
    expect(keysOf(result, "probe.keep")).toEqual([]);
    expect(result).toHaveLength(TABLE.length);
  });

  test("several combinations give several bindings, a repeated one once", () => {
    const result = effectiveKeys(TABLE, {
      "move.up": ["Mod+Alt+ArrowUp", "Shift+Home", "Mod+Alt+ArrowUp", "Shift+Alt+Home"],
    });
    expect(keysOf(result, "move.up")).toEqual([
      keyBinding("ArrowUp", "mod+alt"),
      keyBinding("Home", "shift"),
      keyBinding("Home", "alt+shift"),
    ]);
  });

  test("two spellings of one binding give it once, the first kept (review 8.6, S-26)", () => {
    const result = effectiveKeys(TABLE, { "move.top": ["Mod+Shift+ArrowUp", "Shift+Mod+ArrowUp"] });
    expect(keysOf(result, "move.top")).toEqual([keyBinding("ArrowUp", "mod+shift")]);
  });

  test("the PO's example on the Ranking's table (its select all arrives with group 4: select none stands in)", () => {
    const result = effectiveKeys(RANKING_KEYS, {
      "move.top": ["Mod+Alt+ArrowUp"],
      "move.bottom": ["Mod+Alt+ArrowDown"],
      "select.none": [],
    });
    expect(keysOf(result, "move.top")).toEqual([keyBinding("ArrowUp", "mod+alt")]);
    expect(keysOf(result, "move.bottom")).toEqual([keyBinding("ArrowDown", "mod+alt")]);
    expect(keysOf(result, "select.none")).toEqual([]);
    expect(keysOf(result, "move.up")).toEqual(keysOf(RANKING_KEYS, "move.up"));
  });
});

describe("effectiveKeys changes nothing it cannot apply", () => {
  test("a native entry, an action the table lacks", () => {
    const result = effectiveKeys(TABLE, {
      "cursor.up": ["Mod+Alt+ArrowUp"],
      "ranking.teleport": ["F2"],
    });
    expect(result).toEqual(TABLE);
    expect(keysOf(result, "cursor.up")).toEqual([keyBinding("ArrowUp")]);
  });

  test("an override with one combination that does not parse: no key of it applies", () => {
    for (const bad of ["Ctrl+Alt+ArrowUp", "", "Shift+?", "Alt+ArrowUp", "nonsense"]) {
      const result = effectiveKeys(TABLE, { "move.top": ["Mod+Alt+ArrowUp", bad] });
      expect(keysOf(result, "move.top", "list")).toEqual(keysOf(TABLE, "move.top", "list"));
      expect(keysOf(result, "move.top", "grid")).toEqual(keysOf(TABLE, "move.top", "grid"));
    }
  });

  test("a value that is no list of texts", () => {
    const wrong = [undefined, null, "Mod+Alt+ArrowUp", 1, {}, [1], [null], [["Home"]]];
    for (const value of wrong) {
      const result = effectiveKeys(TABLE, { "move.top": value } as unknown as KeyOverrides);
      expect(result).toEqual(TABLE);
    }
  });

  test("overrides that are no object give the table", () => {
    for (const value of [undefined, null, 1, "x", []]) {
      expect(effectiveKeys(TABLE, value as unknown as KeyOverrides)).toEqual(TABLE);
    }
  });

  test("__proto__, constructor and toString name no action", () => {
    const overrides: Record<string, readonly string[]> = JSON.parse(
      '{"__proto__": ["F2"], "constructor": ["F2"], "toString": ["F2"], "hasOwnProperty": []}',
    );
    expect(effectiveKeys(TABLE, overrides)).toEqual(TABLE);
    // The table's own entries named so are not reached through the prototype either.
    const odd: KeyTable = [
      ownEntry("probe.constructor", "list", [keyBinding("Enter")], "tool", { readOnly: false }),
    ];
    expect(effectiveKeys(odd, {})).toEqual(odd);
  });

  test("an inherited override is not an override", () => {
    const inherited = Object.create({ "move.top": ["F2"] }) as KeyOverrides;
    expect(effectiveKeys(TABLE, inherited)).toEqual(TABLE);
  });
});

describe("effectiveKeys is pure", () => {
  test("the inputs are unchanged and the result is frozen", () => {
    const overrides: KeyOverrides = Object.freeze({ "move.top": Object.freeze(["Mod+Alt+Home"]) });
    const before = JSON.stringify(TABLE);
    const result = effectiveKeys(TABLE, overrides);
    expect(JSON.stringify(TABLE)).toBe(before);
    expect(overrides).toEqual({ "move.top": ["Mod+Alt+Home"] });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(find(result, "move.top"))).toBe(true);
    expect(Object.isFrozen(keysOf(result, "move.top"))).toBe(true);
    expect(result).not.toBe(TABLE);
  });

  test("no overrides gives an equal table", () => {
    expect(effectiveKeys(TABLE, {})).toEqual(TABLE);
    expect(effectiveKeys(RANKING_KEYS, {})).toEqual(RANKING_KEYS);
  });
});

// Task 10.9 (review 10.5, S-42; design decision 19; view spec: The keys panel shows the user's
// changes, scenario "Keys equal to the defaults"): "customised" and "N actions changed" mean keys
// that differ from the defaults, never keys that are merely named in the file.
describe("sameBindings", () => {
  const up = keyBinding("ArrowUp", "mod+shift");
  const home = keyBinding("Home", "alt+shift");

  test("the same bindings in another order, or with one repeated, are the same", () => {
    expect(sameBindings([up, home], [home, up])).toBe(true);
    expect(sameBindings([up, home], [up, home, up])).toBe(true);
    expect(sameBindings([], [])).toBe(true);
  });

  test("a binding added, left out or with another hold is not the same", () => {
    expect(sameBindings([up], [up, home])).toBe(false);
    expect(sameBindings([up, home], [up])).toBe(false);
    expect(sameBindings([up], [])).toBe(false);
    expect(sameBindings([up], [keyBinding("ArrowUp", "mod+alt")])).toBe(false);
    expect(sameBindings([up], [keyBinding("ArrowDown", "mod+shift")])).toBe(false);
  });
});

describe("changedKeyActions", () => {
  const changed = (overrides: unknown, types?: Parameters<typeof changedKeyActions>[1]) =>
    changedKeyActions(overrides as KeyOverrides, types);

  test("{} changes nothing, and the result is sorted and frozen", () => {
    expect(changed({})).toEqual([]);
    const some = changed({ "select.all": [], "move.top": ["Mod+Alt+ArrowUp"] });
    expect(Object.isFrozen(some)).toBe(true);
    expect(some).toEqual([...some].sort());
  });

  test("an action given its default keys, in either order, changes nothing", () => {
    expect(changed({ "move.top": ["Alt+Shift+Home", "Mod+Shift+ArrowUp"] })).toEqual([]);
    expect(changed({ "move.top": ["Mod+Shift+ArrowUp", "Alt+Shift+Home"] })).toEqual([]);
    expect(
      changed({ "move.top": ["Alt+Shift+Home", "Mod+Shift+ArrowUp", "Alt+Shift+Home"] }),
    ).toEqual([]);
  });

  test("the PO's example changes move.bottom, move.top and select.all", () => {
    expect(
      changed({
        "move.top": ["Mod+Alt+ArrowUp"],
        "move.bottom": ["Mod+Alt+ArrowDown"],
        "select.all": [],
      }),
    ).toEqual(["move.bottom", "move.top", "select.all"]);
  });

  test("one of two default keys alone, or one more, is a change", () => {
    expect(changed({ "move.top": ["Alt+Shift+Home"] })).toEqual(["move.top"]);
    expect(changed({ "move.top": ["Alt+Shift+Home", "Mod+Shift+ArrowUp", "F2"] })).toEqual([
      "move.top",
    ]);
  });

  test("a vocabulary action no table binds is judged against the vocabulary's keys", () => {
    expect(changed({ "add.after": ["Alt+Shift+Enter"] })).toEqual([]);
    expect(changed({ "add.after": ["Mod+Alt+Enter"] })).toEqual(["add.after"]);
  });

  test("an own action is judged against its table's entry", () => {
    const ranking = REGISTERED_KEY_TABLES.find(({ type }) => type === "ranking");
    const keep = ranking?.keys.find((entry) => entry.action === "ranking.keep");
    expect(keep).toBeDefined();
    expect(changed({ "ranking.keep": [] })).toEqual(["ranking.keep"]);
    expect(changed({ "ranking.keep": ["F9"] })).toEqual(["ranking.keep"]);
  });

  test("a type given as the default is read from its own tables, not the registered ones", () => {
    const probe: KeyTable = [
      ownEntry("probe.keep", "list", [keyBinding("F2")], "tool", { readOnly: false }),
    ];
    const types = [{ type: "probe", keys: probe }];
    expect(changed({ "probe.keep": ["F2"] }, types)).toEqual([]);
    expect(changed({ "probe.keep": ["F3"] }, types)).toEqual(["probe.keep"]);
    expect(changed({ "ranking.keep": [] }, types)).toEqual([]);
  });

  test("an action that differs in any registered table's entry counts, though it equals another's", () => {
    const one: KeyTable = [
      ownEntry("probe.a", "list", [keyBinding("F2")], "tool", { readOnly: false }),
    ];
    const other: KeyTable = [
      ownEntry("probe.a", "list", [keyBinding("F3")], "tool", { readOnly: false }),
    ];
    const types = [
      { type: "one", keys: one },
      { type: "other", keys: other },
    ];
    expect(changed({ "probe.a": ["F2"] }, types)).toEqual(["probe.a"]);
  });

  test("a native entry, an unknown action and an override that does not parse change nothing", () => {
    expect(changed({ "gantt.togglePredecessor": [] })).toEqual([]);
    expect(changed({ "no.such": ["F2"] })).toEqual([]);
    expect(changed({ "move.top": ["Ctrl+Home"] })).toEqual([]);
    expect(changed({ "move.top": "Mod+Alt+ArrowUp" })).toEqual([]);
  });

  test("__proto__, constructor and toString give nothing", () => {
    const own = JSON.parse('{"__proto__": ["F2"], "constructor": [], "toString": ["F3"]}');
    expect(changed(own)).toEqual([]);
    expect(changed(Object.create({ "move.top": [] }))).toEqual([]);
  });

  test("whatever is not an object gives nothing", () => {
    for (const value of [null, undefined, 3, "move.top", ["move.top"]]) {
      expect(changed(value)).toEqual([]);
    }
  });
});

// The user's key overrides and their check (keyboard-shortcuts-help, task 8.3; contract spec: User
// key overrides and their check; design decision 18): every problem of the overrides against every
// registered key table once applied, each with its rule, the action and the combination, and the
// other action of a conflict. Pure and total: it never throws on a value the schema admits.

import { describe, expect, test } from "bun:test";
import {
  KEY_VOCABULARY,
  KEYS_OPEN_RESERVED_KEYS,
  type KeyOverrideProblem,
  type KeyOverrides,
  type KeyTable,
  keyBinding,
  keyExitActions,
  keyOverridesProblems,
  ownEntry,
  vocabularyEntry,
  WIDGET_TYPES,
  type WidgetType,
} from "../src/index.ts";

const check = (overrides: unknown, types?: readonly WidgetType[]): readonly KeyOverrideProblem[] =>
  keyOverridesProblems(overrides as KeyOverrides, types);

const only = (overrides: unknown, types?: readonly WidgetType[]): KeyOverrideProblem => {
  const problems = check(overrides, types);
  expect(problems).toHaveLength(1);
  return problems[0] as KeyOverrideProblem;
};

const typeOf = (name: string, keys: KeyTable): WidgetType =>
  ({ type: name, keys }) as unknown as WidgetType;

describe("what passes", () => {
  test("the PO's example, {} and a vocabulary action no table binds yet", () => {
    expect(
      check({
        "move.top": ["Mod+Alt+ArrowUp"],
        "move.bottom": ["Mod+Alt+ArrowDown"],
        "select.all": [],
      }),
    ).toEqual([]);
    expect(check({})).toEqual([]);
    expect(check({ "add.after": ["Alt+Shift+Enter"] })).toEqual([]);
  });

  test("moving a key and back, a letter in either case, a free key", () => {
    expect(check({ "move.up": ["Alt+Shift+ArrowUp"] })).toEqual([]);
    expect(check({ "keys.open": ["Mod+Alt+Home"], "cursor.first": ["Mod+Alt+End"] })).toEqual([]);
    expect(check({ "ranking.keep": ["Shift+Enter", "F2"] })).toEqual([]);
  });

  test("every shipped action with keys may be unbound, an exit apart", () => {
    for (const { keys } of WIDGET_TYPES) {
      for (const entry of keys ?? []) {
        if (entry.shows === "native" || entry.keys.length === 0) continue;
        const given = Object.fromEntries([[entry.action, []]]);
        const problems = check(given).filter((p) => p.rule !== "exit");
        expect({ action: entry.action, problems }).toEqual({ action: entry.action, problems: [] });
      }
    }
  });
});

describe("the action rule", () => {
  test("an action nobody binds, __proto__, and a keyless tool's own action", () => {
    expect(only({ "ranking.teleport": ["F2"] })).toEqual({
      rule: "action",
      action: "ranking.teleport",
    });
    const proto = JSON.parse('{"__proto__": ["F2"]}') as KeyOverrides;
    expect(only(proto)).toEqual({ rule: "action", action: "__proto__" });
    expect(only({ "tree.addAfter": ["Shift+F2"] })).toEqual({
      rule: "action",
      action: "tree.addAfter",
    });
  });

  test("names on Object's prototype are no action", () => {
    for (const name of ["constructor", "toString", "hasOwnProperty", "valueOf"]) {
      expect(only({ [name]: ["F2"] }).rule).toBe("action");
    }
  });
});

describe("the native rule", () => {
  test("keys a Radix or browser control takes", () => {
    expect(only({ "gantt.criticalPath": ["Mod+Alt+Enter"] })).toEqual({
      rule: "native",
      action: "gantt.criticalPath",
    });
    expect(only({ "gantt.togglePredecessor": [] }).rule).toBe("native");
  });
});

describe("the notation and hold rules, per combination", () => {
  test("a combination that does not parse is `notation`, naming it", () => {
    expect(only({ "move.up": ["Ctrl+Alt+ArrowUp"] })).toEqual({
      rule: "notation",
      action: "move.up",
      binding: "Ctrl+Alt+ArrowUp",
    });
    expect(only({ "move.up": [""] }).rule).toBe("notation");
    expect(only({ "move.up": [`Mod+${"a".repeat(40)}`] }).rule).toBe("notation");
  });

  test("a value that is no list of texts is `notation` and never throws", () => {
    for (const value of [null, "F2", 1, {}, [1], [null], [["F2"]], undefined]) {
      const problems = check({ "move.up": value });
      expect(problems.length).toBeGreaterThan(0);
      expect(problems[0]?.rule).toBe("notation");
      expect(problems[0]?.action).toBe("move.up");
    }
    for (const value of [null, 1, "x", [], undefined]) {
      expect(check(value).length).toBeGreaterThan(0);
    }
  });

  test("a hold no key has is `hold`", () => {
    expect(only({ "move.up": ["Alt+ArrowUp"] })).toEqual({
      rule: "hold",
      action: "move.up",
      binding: "Alt+ArrowUp",
    });
    expect(only({ "move.up": ["Shift+?"] }).rule).toBe("hold");
  });

  test("every combination is judged: one bad does not hide another", () => {
    const problems = check({ "move.up": ["Alt+ArrowUp", "Ctrl+Home", "Tab", "Mod+Alt+Home"] });
    expect(problems.map(({ rule, binding }) => `${rule}:${binding}`)).toEqual([
      "hold:Alt+ArrowUp",
      "notation:Ctrl+Home",
      "reserved:Tab",
    ]);
  });
});

describe("the reserved rule", () => {
  test("the keys the browser or the system needs", () => {
    expect(only({ "keys.open": ["F1"] })).toEqual({
      rule: "reserved",
      action: "keys.open",
      binding: "F1",
    });
    expect(only({ undo: ["Mod+w"] })).toEqual({
      rule: "reserved",
      action: "undo",
      binding: "Mod+w",
    });
    expect(only({ "move.up": ["Mod+Alt+ArrowLeft"] })).toEqual({
      rule: "reserved",
      action: "move.up",
      binding: "Mod+Alt+ArrowLeft",
    });
    expect(only({ "move.up": ["Tab"] }).rule).toBe("reserved");
  });

  test.each([
    "F3",
    "F12",
    "Shift+Tab",
    "Mod+s",
    "Mod+Home",
    "Mod+Shift+Home",
    "Mod+Alt+ArrowRight",
    "Mod+Alt+Delete",
    "Mod+Alt+a",
    "Mod+Alt+Space",
  ])("%s is reserved", (combination) => {
    expect(only({ "move.up": [combination] })).toEqual({
      rule: "reserved",
      action: "move.up",
      binding: combination,
    });
  });

  test.each([
    "F2",
    "Mod+z",
    "Mod+a",
    "Mod+Shift+ArrowUp",
    "Mod+Shift+Enter",
    "?",
    "%",
    "Mod+Alt+Enter",
    "Mod+Alt+End",
  ])("%s is not", (combination) => {
    expect(check({ "ranking.keep": [combination] }).filter((p) => p.rule === "reserved")).toEqual(
      [],
    );
  });
});

describe("keys a system composes or an editor types (decisions 2, 17 and 18)", () => {
  const reservedOf = (overrides: unknown) => check(overrides).filter((p) => p.rule === "reserved");

  test("Alt+Shift with a letter or Space is reserved", () => {
    expect(only({ "select.all": ["Alt+Shift+a"] })).toEqual({
      rule: "reserved",
      action: "select.all",
      binding: "Alt+Shift+a",
    });
    expect(only({ "ranking.keep": ["Alt+Shift+Space"] })).toEqual({
      rule: "reserved",
      action: "ranking.keep",
      binding: "Alt+Shift+Space",
    });
  });

  test("Alt+Shift with an arrow, Home, End, Enter, Delete or Backspace is not", () => {
    for (const key of ["ArrowLeft", "Home", "End", "Enter", "Delete", "Backspace"]) {
      expect(reservedOf({ "ranking.keep": [`Alt+Shift+${key}`] })).toEqual([]);
    }
  });

  test("Mod+Alt takes only ArrowUp, ArrowDown, Home, End and Enter: a letter is reserved", () => {
    expect(only({ "move.top": ["Mod+Alt+k"] })).toEqual({
      rule: "reserved",
      action: "move.top",
      binding: "Mod+Alt+k",
    });
  });

  test.each(["e", "Shift+e", "Space", "?"])(
    "edit.commit on %s is reserved, naming the action and the combination as written",
    (combination) => {
      expect(reservedOf({ "edit.commit": [combination] })).toEqual([
        { rule: "reserved", action: "edit.commit", binding: combination },
      ]);
    },
  );

  test("edit.commit on Mod+Alt+Enter, and on no key, passes", () => {
    expect(check({ "edit.commit": ["Mod+Alt+Enter"] })).toEqual([]);
    expect(check({ "edit.commit": [] })).toEqual([]);
  });

  test("a letter on an action no table has in an editor part is not reserved", () => {
    expect(reservedOf({ "ranking.keep": ["e", "Space", "Shift+e"] })).toEqual([]);
  });

  test("the editor rule reads the tables it is given", () => {
    const grid = typeOf("probe", [
      ownEntry("probe.a", "grid", [keyBinding("Enter")], "tool", { readOnly: false }),
    ]);
    const editor = typeOf("probe", [
      ownEntry("probe.a", "editor", [keyBinding("Enter")], "tool", { readOnly: false }),
    ]);
    expect(check({ "probe.a": ["e"] }, [grid])).toEqual([]);
    expect(check({ "probe.a": ["e"] }, [editor])).toEqual([
      { rule: "reserved", action: "probe.a", binding: "e" },
    ]);
  });

  test("a combination written twice, or in two spellings, is no problem", () => {
    expect(check({ "move.top": ["Mod+Alt+ArrowUp", "Mod+Alt+ArrowUp"] })).toEqual([]);
    expect(check({ "move.top": ["Mod+Shift+ArrowUp", "Shift+Mod+ArrowUp"] })).toEqual([]);
  });

  test("the PO's example still passes", () => {
    expect(
      check({
        "move.top": ["Mod+Alt+ArrowUp"],
        "move.bottom": ["Mod+Alt+ArrowDown"],
        "select.all": [],
      }),
    ).toEqual([]);
  });
});

describe("the conflict rule", () => {
  test("to the top on the key of move up, in the Ranking's list", () => {
    const found = check({ "move.top": ["Alt+Shift+ArrowUp"] });
    expect(found).toContainEqual({
      rule: "conflict",
      action: "move.top",
      binding: "Alt+Shift+ArrowUp",
      with: "move.up",
    });
    expect(found.every((p) => p.rule === "conflict")).toBe(true);
  });

  test("a printed character against the same plain key", () => {
    const type = typeOf("probe", [
      ownEntry("probe.a", "list", [keyBinding("Enter")], "tool", { readOnly: false }),
      ownEntry("probe.q", "list", [keyBinding("%")], "tool", { readOnly: false }),
      ownEntry("probe.z", "other", [keyBinding("%")], "tool", { readOnly: false }),
    ]);
    // `%`, not `?`: `?` is also keys.open's, which every item has in effect (task 8.9).
    expect(only({ "probe.a": ["%"] }, [type])).toEqual({
      rule: "conflict",
      action: "probe.a",
      binding: "%",
      with: "probe.q",
    });
  });

  test("a part's own: the same key in another part of a table is no conflict", () => {
    const type = typeOf("probe", [
      ownEntry("probe.a", "list", [keyBinding("Enter")], "tool", { readOnly: false }),
      ownEntry("probe.b", "editor", [keyBinding("F2")], "tool", { readOnly: false }),
    ]);
    expect(check({ "probe.a": ["F2"] }, [type])).toEqual([]);
  });

  test("two overridden actions on one key are reported once, naming both", () => {
    const type = typeOf("probe", [
      ownEntry("probe.a", "list", [keyBinding("Enter")], "tool", { readOnly: false }),
      ownEntry("probe.b", "list", [keyBinding("F2")], "tool", { readOnly: false }),
    ]);
    const found = check({ "probe.a": ["Space"], "probe.b": ["Space"] }, [type]);
    expect(found).toHaveLength(1);
    expect(found[0]).toEqual({
      rule: "conflict",
      action: "probe.b",
      binding: "Space",
      with: "probe.a",
    });
  });

  test("swapping two actions' keys is no conflict", () => {
    expect(
      check({
        "move.up": ["Alt+Shift+ArrowDown"],
        "move.down": ["Alt+Shift+ArrowUp"],
      }),
    ).toEqual([]);
  });

  test("the same combination twice in one action's list is no conflict with itself", () => {
    expect(
      check({ "ranking.keep": ["Space", "Space"] }).filter((p) => p.rule === "conflict"),
    ).toEqual([expect.objectContaining({ with: "select.toggle" })]);
    expect(check({ "ranking.keep": ["F2", "F2"] })).toEqual([]);
  });

  test("a conflict is found in a table whose action the override names, and nowhere else", () => {
    // `chart.highlight` is Space and Enter in the Chart; Enter is free in the Ranking's list only
    // as `ranking.keep`: moving the Chart's action to ArrowUp conflicts in the Chart alone.
    const found = check({ "chart.highlight": ["ArrowUp"] });
    expect(found).toEqual([
      { rule: "conflict", action: "chart.highlight", binding: "ArrowUp", with: "cursor.up" },
    ]);
  });
});

describe("the keys panel's keys act across the item (decision 18; review 8.6)", () => {
  test.each([
    "Enter",
    "Space",
    "Escape",
    "ArrowDown",
    "Shift+Home",
    "PageUp",
    "Delete",
    "Backspace",
  ])("keys.open on %s is reserved: a control inside an item takes it", (combination) => {
    // The same key may also conflict with the actions that hold it: every problem is reported.
    expect(check({ "keys.open": [combination] })).toContainEqual({
      rule: "reserved",
      action: "keys.open",
      binding: combination,
    });
    expect(
      check({ "keys.open": [combination] }).filter(
        (problem) => problem.rule === "reserved" && problem.action === "keys.open",
      ),
    ).toHaveLength(1);
  });

  test("the whole list is reserved, with no modifier or Shift alone, and nothing else is", () => {
    const keys = [
      "Enter",
      "Space",
      "Escape",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Delete",
      "Backspace",
    ];
    for (const key of keys) {
      for (const combination of [key, `Shift+${key}`]) {
        const found = check({ "keys.open": [combination] }).filter((p) => p.rule === "reserved");
        expect({ combination, found }).toEqual({
          combination,
          found: [{ rule: "reserved", action: "keys.open", binding: combination }],
        });
      }
    }
    for (const combination of ["F2", "Mod+Alt+Home", "Mod+Shift+Enter", "%", "j"]) {
      expect(check({ "keys.open": [combination] }).filter((p) => p.rule === "reserved")).toEqual(
        [],
      );
    }
  });

  test("another action may take those keys: only keys.open's are reserved", () => {
    expect(
      check({ "ranking.keep": ["Enter", "Space"] }).filter((p) => p.rule === "reserved"),
    ).toEqual([]);
  });

  test("keys.open on Mod+z conflicts with undo, though no part that holds keys.open binds undo", () => {
    expect(only({ "keys.open": ["Mod+z"] })).toEqual({
      rule: "conflict",
      action: "keys.open",
      binding: "Mod+z",
      with: "undo",
    });
  });

  test("keys.open on Alt+Shift+ArrowUp gives one conflict with move.up, not one per table or part", () => {
    expect(only({ "keys.open": ["Alt+Shift+ArrowUp"] })).toEqual({
      rule: "conflict",
      action: "keys.open",
      binding: "Alt+Shift+ArrowUp",
      with: "move.up",
    });
  });

  test("undo on ? conflicts with keys.open, whose ? is in effect on every item", () => {
    expect(only({ undo: ["?"] })).toEqual({
      rule: "conflict",
      action: "undo",
      binding: "?",
      with: "keys.open",
    });
  });

  test("two overridden actions on one key are reported once, from the one named later", () => {
    expect(only({ undo: ["Mod+Alt+Home"], "keys.open": ["Mod+Alt+Home"] })).toEqual({
      rule: "conflict",
      action: "keys.open",
      binding: "Mod+Alt+Home",
      with: "undo",
    });
    expect(only({ "keys.open": ["Mod+Alt+Home"], undo: ["Mod+Alt+Home"] })).toEqual({
      rule: "conflict",
      action: "undo",
      binding: "Mod+Alt+Home",
      with: "keys.open",
    });
  });

  test("swapping keys.open away from ? and undo onto it is no conflict", () => {
    expect(check({ "keys.open": ["Mod+Alt+Home"], undo: ["?"] })).toEqual([]);
  });

  test("keys.open on Mod+Alt+Enter, and the PO's example, give none", () => {
    expect(check({ "keys.open": ["Mod+Alt+Enter"] })).toEqual([]);
    expect(
      check({
        "move.top": ["Mod+Alt+ArrowUp"],
        "move.bottom": ["Mod+Alt+ArrowDown"],
        "select.all": [],
      }),
    ).toEqual([]);
  });

  test("keys.open removed, or on the key an action takes in another type's part, is judged the same", () => {
    expect(check({ "keys.open": [] })).toEqual([]);
    const type = typeOf("probe", [
      ownEntry("probe.a", "list", [keyBinding("F2")], "tool", { readOnly: false }),
      ownEntry("probe.b", "other", [keyBinding("Enter", "mod+shift")], "tool", {
        readOnly: false,
      }),
    ]);
    expect(only({ "keys.open": ["Mod+Shift+Enter"] }, [type])).toEqual({
      rule: "conflict",
      action: "keys.open",
      binding: "Mod+Shift+Enter",
      with: "probe.b",
    });
  });
});

describe("the exit rule", () => {
  test("an exit left with no key", () => {
    expect(only({ "edit.cancel": [] })).toEqual({ rule: "exit", action: "edit.cancel" });
    expect(only({ "tree.cancelDelete": [] })).toEqual({
      rule: "exit",
      action: "tree.cancelDelete",
    });
    expect(only({ "tree.cancelGroup": [] })).toEqual({ rule: "exit", action: "tree.cancelGroup" });
  });

  test("select none may lose its key, and an exit may move", () => {
    expect(check({ "select.none": [] })).toEqual([]);
    expect(check({ "edit.cancel": ["Mod+Alt+Home"] })).toEqual([]);
    expect(check({ "tree.cancelDelete": ["Shift+Escape"] })).toEqual([]);
  });

  test("an exit needs no key beyond the Escape of its own default: a vocabulary action that is no exit", () => {
    expect(check({ "cursor.up": [] })).toEqual([]);
    expect(check({ "edit.commit": [] })).toEqual([]);
  });
});

// The exits as the contract computes them, which the generated key configuration reference reads
// instead of copying (review 5.6, S-36; design decision 20).
describe("keyExitActions", () => {
  test("is edit.cancel and each own action whose default keys hold Escape, sorted and frozen", () => {
    const exits = keyExitActions(WIDGET_TYPES);
    expect(exits).toEqual(["edit.cancel", "tree.cancelDelete", "tree.cancelGroup"]);
    expect(Object.isFrozen(exits)).toBe(true);
    expect(exits).not.toContain("select.none");
    expect([...exits]).toEqual([...exits].sort());
    expect(keyExitActions()).toEqual(exits);
  });

  test("a probe type's own action on Escape is an exit; its other actions are not", () => {
    const probe = typeOf("probe", [
      ownEntry("probe.leave", "panel", [keyBinding("Escape")], "tool", { readOnly: false }),
      ownEntry("probe.stay", "panel", [keyBinding("Enter")], "tool", { readOnly: false }),
    ]);
    expect(keyExitActions([probe])).toEqual(["edit.cancel", "probe.leave"]);
    expect(keyExitActions([])).toEqual(["edit.cancel"]);
  });

  test("is the set keyOverridesProblems uses: an exit problem for each and for no other action", () => {
    const probe = typeOf("probe", [
      ownEntry("probe.leave", "panel", [keyBinding("Escape")], "tool", { readOnly: false }),
    ]);
    for (const types of [WIDGET_TYPES, [...WIDGET_TYPES, probe]]) {
      const exits = new Set(keyExitActions(types));
      const actions = new Set([
        ...Object.keys(KEY_VOCABULARY),
        ...types.flatMap(({ keys }) => (keys ?? []).map(({ action }) => action)),
      ]);
      for (const action of actions) {
        const rules = check({ [action]: [] }, types).map(({ rule }) => rule);
        expect(rules.includes("exit"), `${action} unbound`).toBe(exits.has(action));
      }
    }
  });
});

describe("KEYS_OPEN_RESERVED_KEYS", () => {
  test("is the keys a native control takes, the ones keys.open refuses with no modifier or Shift", () => {
    expect([...KEYS_OPEN_RESERVED_KEYS].sort()).toEqual(
      [
        " ",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "Backspace",
        "Delete",
        "End",
        "Enter",
        "Escape",
        "Home",
        "PageDown",
        "PageUp",
      ].sort(),
    );
    for (const key of KEYS_OPEN_RESERVED_KEYS) {
      expect(check({ "keys.open": [key === " " ? "Space" : key] }).map((p) => p.rule)).toContain(
        "reserved",
      );
    }
  });
});

describe("every problem is reported", () => {
  test("none hides another, across actions and rules", () => {
    const found = check({
      "ranking.teleport": ["F2"],
      "gantt.criticalPath": ["Home"],
      "keys.open": ["F1"],
      "move.up": ["Ctrl+Home"],
      "edit.cancel": [],
      "move.top": ["Alt+Shift+ArrowDown"],
    });
    expect(found.map((p) => `${p.rule}:${p.action}`).sort()).toEqual(
      [
        "action:ranking.teleport",
        "conflict:move.top",
        "exit:edit.cancel",
        "native:gantt.criticalPath",
        "notation:move.up",
        "reserved:keys.open",
      ].sort(),
    );
  });

  test("it works over the types it is given, and WIDGET_TYPES by default", () => {
    const type = typeOf("probe", [vocabularyEntry("move.up", "list", "tool")]);
    expect(check({ "ranking.keep": ["F2"] }, [type])).toEqual([
      { rule: "action", action: "ranking.keep" },
    ]);
    expect(check({ "ranking.keep": ["F2"] })).toEqual([]);
  });

  test("a type without a table, or with a table of another shape, is passed over", () => {
    const odd = [
      { type: "none" },
      { type: "bad", keys: "no" },
      typeOf("probe", [{ action: 1 } as never, null as never]),
    ] as unknown as readonly WidgetType[];
    expect(check({ "move.up": ["F2"] }, odd).map((p) => p.rule)).toEqual([]);
  });
});

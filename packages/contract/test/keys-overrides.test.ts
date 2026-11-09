// The user's key overrides and their check (keyboard-shortcuts-help, task 8.3; contract spec: User
// key overrides and their check; design decision 18): every problem of the overrides against every
// registered key table once applied, each with its rule, the action and the combination, and the
// other action of a conflict. Pure and total: it never throws on a value the schema admits.

import { describe, expect, test } from "bun:test";
import {
  type KeyOverrideProblem,
  type KeyOverrides,
  type KeyTable,
  keyBinding,
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
      ownEntry("probe.q", "list", [keyBinding("?")], "tool", { readOnly: false }),
      ownEntry("probe.z", "other", [keyBinding("?")], "tool", { readOnly: false }),
    ]);
    expect(only({ "probe.a": ["?"] }, [type])).toEqual({
      rule: "conflict",
      action: "probe.a",
      binding: "?",
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

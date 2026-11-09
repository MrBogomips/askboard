// The key table check (keyboard-shortcuts-help, task 1.3; contract spec: Key tables in the
// registry): each rule of design decision 2 refused, naming the type and the action or the key.

import { describe, expect, test } from "bun:test";
import { PROBE_TYPES, PROBE_WIDGET } from "../src/fixtures/index.ts";
import {
  type KeyBinding,
  type KeyEntry,
  type KeyTable,
  keyBinding,
  keyTableProblems,
  ownEntry,
  vocabularyEntry,
  WIDGET_TYPES,
  type WidgetType,
  widgetRegistryProblems,
} from "../src/index.ts";
import { registryShapeProblems } from "../src/widgets/registry.ts";

const b = (key: string, hold: KeyBinding["hold"] = "none"): KeyBinding => keyBinding(key, hold);
const messages = (table: KeyTable): readonly string[] =>
  keyTableProblems("probe", table).map(({ message }) => message);
const entry = (over: Partial<KeyEntry> & { action: string }): KeyEntry => ({
  part: "list",
  keys: [],
  label: "keys.action.x",
  shows: "tool",
  ...over,
});

describe("a vocabulary action's keys", () => {
  test("a table built from the vocabulary passes", () => {
    const table: KeyTable = [
      vocabularyEntry("cursor.up", "list", "navigation"),
      vocabularyEntry("move.top", "list", "tool"),
      vocabularyEntry("edit.start", "grid", "pointer"),
      vocabularyEntry("undo", "grid", "tool"),
      vocabularyEntry("toolbar.next", "toolbar", "navigation"),
    ];
    expect(keyTableProblems("probe", table)).toEqual([]);
  });

  test("move up bound to Ctrl+ArrowUp is refused, naming the type and the action", () => {
    const [problem, ...rest] = keyTableProblems("probe", [
      entry({ action: "move.up", keys: [b("ArrowUp", "mod")] }),
    ]);
    expect(problem?.rule).toBe("keys");
    expect(problem?.type).toBe("probe");
    expect(problem?.message).toContain('"probe"');
    expect(problem?.message).toContain("move.up");
    expect(rest.length).toBeGreaterThanOrEqual(0);
  });

  test("a key added to an action is refused, naming the action and the key", () => {
    const found = messages([
      entry({ action: "move.up", keys: [b("ArrowUp", "alt+shift"), b("k", "alt+shift")] }),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("move.up");
    expect(found[0]).toContain("Alt+Shift+k");
  });

  test("a key left out is refused, naming the action and the key", () => {
    const found = messages([entry({ action: "edit.start", keys: [b("Enter")] })]);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("edit.start");
    expect(found[0]).toContain("F2");
  });

  test("`when` that differs from the vocabulary's is refused, in both directions", () => {
    const without = messages([entry({ action: "select.none", keys: [b("Escape")] })]);
    expect(without).toHaveLength(1);
    expect(without[0]).toContain("select.none");
    const added = messages([
      entry({ action: "move.up", keys: [b("ArrowUp", "alt+shift")], when: "selected" }),
    ]);
    expect(added).toHaveLength(1);
    expect(added[0]).toContain("move.up");
  });

  test("a keyless vocabulary action is refused: a left-out key", () => {
    expect(messages([entry({ action: "move.up", keys: [] })])).toHaveLength(1);
  });
});

describe("delete's two pairs", () => {
  const PLAIN = [b("Delete"), b("Backspace")];
  const ALT = [b("Delete", "alt+shift"), b("Backspace", "alt+shift")];
  const clear = ownEntry("probe.clear", "grid", PLAIN, "pointer");

  test("the plain pair alone passes (the Tree's today), and with the Alt+Shift pair", () => {
    expect(messages([entry({ action: "delete", keys: PLAIN })])).toEqual([]);
    expect(messages([entry({ action: "delete", keys: [...PLAIN, ...ALT] })])).toEqual([]);
  });

  test("the Alt+Shift pair alone passes only where another action of its part takes Delete and Backspace", () => {
    const del = entry({ action: "delete", part: "grid", keys: ALT });
    expect(messages([clear, del])).toEqual([]);
    const refused = messages([del]);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toContain("delete");
    // Another part's action does not count.
    const apart = ownEntry("probe.clear", "list", PLAIN, "pointer");
    expect(messages([apart, del])).toHaveLength(1);
    // A part that takes only one of the two does not either.
    const half = ownEntry("probe.clear", "grid", [b("Delete")], "pointer");
    expect(messages([half, del])).toHaveLength(1);
  });

  test("half a pair is a key left out", () => {
    const found = messages([
      entry({ action: "delete", keys: [b("Delete"), b("Backspace"), b("Delete", "alt+shift")] }),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("Backspace");
  });

  test("no keys at all is refused", () => {
    expect(messages([clear, entry({ action: "delete", part: "grid", keys: [] })])).toHaveLength(1);
  });
});

describe("the keys the PO approved", () => {
  test("a table binding them passes", () => {
    const table: KeyTable = [
      vocabularyEntry("add.after", "list", "tool"),
      vocabularyEntry("add.child", "list", "tool"),
      vocabularyEntry("select.all", "list", "tool"),
      vocabularyEntry("select.none", "list", "tool"),
      vocabularyEntry("adjust.percent", "list", "tool"),
      vocabularyEntry("keys.open", "list", "panel"),
      vocabularyEntry("delete", "list", "tool"),
    ];
    expect(keyTableProblems("probe", table)).toEqual([]);
  });
});

describe("a key the browser or the system needs", () => {
  test("Alt+ArrowLeft is no hold that can be written, and the problem names the key", () => {
    const found = messages([
      ownEntry(
        "probe.back",
        "list",
        [{ key: "ArrowLeft", hold: "alt" as KeyBinding["hold"] }],
        "tool",
      ),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("ArrowLeft");
    expect(found[0]).toContain("probe");
  });

  test("Tab, Shift+Tab and Alt+Shift+Tab are refused", () => {
    for (const hold of ["none", "shift", "alt+shift"] as const) {
      const found = messages([ownEntry("probe.t", "list", [b("Tab", hold)], "tool")]);
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("Tab");
    }
  });

  test("F1 and F3 to F12 are refused, F2 passes", () => {
    for (const key of ["F1", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"]) {
      expect(messages([ownEntry("probe.f", "list", [b(key)], "tool")])).toHaveLength(1);
    }
    expect(messages([ownEntry("probe.f", "list", [b("F2")], "tool")])).toEqual([]);
  });

  test("Cmd or Ctrl takes only Z and A, as `mod`", () => {
    expect(messages([ownEntry("probe.s", "list", [b("s", "mod")], "tool")])).toHaveLength(1);
    expect(messages([ownEntry("probe.s", "list", [b("w", "mod")], "tool")])[0]).toContain("w");
    expect(messages([ownEntry("probe.s", "list", [b("ArrowLeft", "mod")], "tool")])).toHaveLength(
      1,
    );
    expect(messages([ownEntry("probe.s", "list", [b("z", "mod")], "tool")])).toEqual([]);
    expect(messages([ownEntry("probe.s", "list", [b("a", "mod")], "tool")])).toEqual([]);
  });

  test("Cmd or Ctrl with Shift takes only ArrowUp, ArrowDown and Enter", () => {
    expect(messages([ownEntry("probe.r", "list", [b("z", "mod+shift")], "tool")])).toHaveLength(1);
    expect(messages([ownEntry("probe.r", "list", [b("Home", "mod+shift")], "tool")])).toHaveLength(
      1,
    );
    for (const key of ["ArrowUp", "ArrowDown", "Enter"]) {
      expect(messages([ownEntry("probe.r", "list", [b(key, "mod+shift")], "tool")])).toEqual([]);
    }
  });

  test("a printed character is `?` or `%` only", () => {
    expect(messages([ownEntry("probe.c", "list", [b("!", "char")], "panel")])).toHaveLength(1);
    expect(messages([ownEntry("probe.c", "list", [b("a", "char")], "panel")])).toHaveLength(1);
    expect(messages([ownEntry("probe.c", "list", [b("?", "char")], "panel")])).toEqual([]);
    expect(messages([ownEntry("probe.c", "list", [b("%", "char")], "panel")])).toEqual([]);
  });

  test("an upper-case letter key, an empty key and an unknown hold are refused", () => {
    expect(messages([ownEntry("probe.u", "list", [b("Z", "mod")], "tool")])).toHaveLength(1);
    expect(messages([ownEntry("probe.u", "list", [b("")], "tool")])).toHaveLength(1);
    const unknown = { key: "ArrowUp", hold: "ctrl" } as unknown as KeyBinding;
    expect(messages([ownEntry("probe.u", "list", [unknown], "tool")])).toHaveLength(1);
  });
});

describe("one key twice", () => {
  test("Space for two actions in one part is refused, naming the key, and the others are still reported", () => {
    const table: KeyTable = [
      ownEntry("probe.a", "list", [b(" ")], "tool"),
      ownEntry("probe.b", "list", [b(" ")], "tool"),
      ownEntry("probe.c", "list", [b("Tab")], "tool"),
    ];
    const found = messages(table);
    expect(found).toHaveLength(2);
    expect(found.find((message) => message.includes("Space"))).toContain("probe.a");
    expect(found.find((message) => message.includes("Space"))).toContain("probe.b");
    expect(found.some((message) => message.includes("Tab"))).toBe(true);
  });

  test("the same key in two parts is not twice", () => {
    expect(
      messages([
        ownEntry("probe.a", "list", [b(" ")], "tool"),
        ownEntry("probe.b", "toolbar", [b(" ")], "tool"),
      ]),
    ).toEqual([]);
  });

  test("one key twice in one entry, and a printed character against the same key plain, are refused", () => {
    expect(messages([ownEntry("probe.a", "list", [b("x"), b("x")], "tool")])).toHaveLength(1);
    expect(
      messages([
        ownEntry("probe.a", "list", [b("?", "char")], "panel"),
        ownEntry("probe.b", "list", [b("?")], "tool"),
      ]),
    ).toHaveLength(1);
  });

  test("a selected-only key and a plain one of the same key in one part are refused", () => {
    expect(
      messages([
        vocabularyEntry("select.none", "list", "tool"),
        vocabularyEntry("edit.cancel", "list", "navigation"),
      ]),
    ).toHaveLength(1);
  });

  test("one problem per repeated binding, however many entries repeat it", () => {
    const found = messages([
      ownEntry("probe.a", "list", [b("x")], "tool"),
      ownEntry("probe.b", "list", [b("x")], "tool"),
      ownEntry("probe.c", "list", [b("x")], "tool"),
    ]);
    expect(found).toHaveLength(1);
  });
});

describe("an entry's own fields", () => {
  test("an action is a vocabulary action or `<type>.<name>`", () => {
    expect(messages([ownEntry("ranking.keep", "list", [b("Enter")], "tool")])).toHaveLength(1);
    expect(messages([ownEntry("keep", "list", [b("Enter")], "tool")])).toHaveLength(1);
    expect(messages([ownEntry("probe.", "list", [b("Enter")], "tool")])).toHaveLength(1);
    expect(messages([ownEntry("probe.keep", "list", [b("Enter")], "tool")])).toEqual([]);
    expect(messages([ownEntry("probe.a.b", "list", [b("Enter")], "tool")])).toEqual([]);
  });

  test("a type whose name has a hyphen owns its actions as the name says", () => {
    const found = keyTableProblems("pick-field", [
      ownEntry("pick-field.go", "list", [b("Enter")], "tool"),
    ]);
    expect(found).toEqual([]);
  });

  test("an empty label, an empty part and an unknown `shows` or `when` are each refused", () => {
    expect(messages([entry({ action: "probe.a", keys: [b("x")], label: "" })])).toHaveLength(1);
    expect(messages([entry({ action: "probe.a", keys: [b("x")], part: "" })])).toHaveLength(1);
    const shows = { shows: "magic" } as unknown as Partial<KeyEntry>;
    expect(messages([entry({ action: "probe.a", keys: [b("x")], ...shows })])).toHaveLength(1);
    const when = { when: "always" } as unknown as Partial<KeyEntry>;
    expect(messages([entry({ action: "probe.a", keys: [b("x")], ...when })])).toHaveLength(1);
  });

  test("a keyless `tool` or `menu` entry passes; a keyless one of any other kind fails", () => {
    for (const shows of ["tool", "menu"] as const) {
      expect(messages([ownEntry("probe.m", "list", [], shows)])).toEqual([]);
    }
    for (const shows of ["navigation", "pointer", "panel", "native"] as const) {
      const found = messages([ownEntry("probe.m", "list", [], shows)]);
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("probe.m");
    }
  });

  test("a native entry with keys passes", () => {
    expect(messages([ownEntry("probe.switch", "switch", [b(" ")], "native")])).toEqual([]);
  });
});

describe("one entry's problems never hide another's", () => {
  test("each broken entry is reported, in the table's order, each naming its action", () => {
    const table: KeyTable = [
      entry({ action: "move.up", keys: [b("ArrowUp", "mod")] }),
      ownEntry("probe.ok", "list", [b("q")], "tool"),
      entry({ action: "edit.start", keys: [b("Enter")] }),
      ownEntry("probe.tab", "list", [b("Tab")], "tool"),
    ];
    const found = messages(table);
    const at = (action: string) => found.findIndex((message) => message.includes(action));
    expect(at("move.up")).toBeGreaterThanOrEqual(0);
    expect(at("edit.start")).toBeGreaterThan(at("move.up"));
    expect(at("probe.tab")).toBeGreaterThan(at("edit.start"));
    expect(found.some((message) => message.includes("probe.ok"))).toBe(false);
  });

  test("a table of another shape, an entry that is no object and keys that are no list never throw", () => {
    const shapes: readonly unknown[] = [
      null,
      "keys",
      { 0: 1 },
      [null],
      [3],
      [{ action: 3 }],
      [{ action: "probe.a", part: "list", keys: "x", label: "k", shows: "tool" }],
      [{ action: "probe.a", part: "list", keys: [null], label: "k", shows: "tool" }],
      [
        {
          action: "probe.a",
          part: "list",
          keys: [{ key: 3, hold: "none" }],
          label: "k",
          shows: "tool",
        },
      ],
    ];
    for (const shape of shapes) {
      const found = keyTableProblems("probe", shape as KeyTable);
      expect(found.length).toBeGreaterThanOrEqual(1);
      for (const problem of found) {
        expect(problem.rule).toBe("keys");
        expect(problem.message).toContain("probe");
      }
    }
  });
});

describe("the registry runs it for each entry with keys", () => {
  const keyed = (keys: KeyTable): WidgetType => ({ ...PROBE_WIDGET, keys });
  const rules = (types: readonly WidgetType[]) =>
    registryShapeProblems(types).map(({ type, rule }) => `${type}:${rule}`);

  test("the registry check reports a bad table naming the type, and passes a good one", () => {
    const bad = widgetRegistryProblems([
      keyed([entry({ action: "move.up", keys: [b("ArrowUp")] })]),
    ]);
    expect(bad.map(({ type, rule }) => `${type}:${rule}`)).toEqual(["probe:keys"]);
    expect(bad[0]?.message).toContain("move.up");
    expect(widgetRegistryProblems([keyed([vocabularyEntry("move.up", "list", "tool")])])).toEqual(
      [],
    );
  });

  test("a type without keys is not checked, and the shape check holds the rule too", () => {
    expect(PROBE_WIDGET.keys).toBeUndefined();
    expect(widgetRegistryProblems(PROBE_TYPES)).toEqual([]);
    expect(rules([keyed([ownEntry("probe.tab", "list", [b("Tab")], "tool")])])).toEqual([
      "probe:keys",
    ]);
  });

  test("one entry's table does not hide another's problems", () => {
    const [tree] = WIDGET_TYPES;
    if (tree === undefined) throw new Error("no tree");
    const broken = { ...tree, keys: [ownEntry("tree.tab", "grid", [b("Tab")], "tool")] };
    const found = widgetRegistryProblems([
      keyed([ownEntry("probe.tab", "list", [b("Tab")], "tool")]),
      broken,
    ]);
    expect(found.map(({ type }) => type)).toEqual(["probe", "tree"]);
  });

  test("a keys of another shape is one problem naming the type", () => {
    const malformed = { ...PROBE_WIDGET, keys: "all" } as unknown as WidgetType;
    expect(rules([malformed])).toEqual(["probe:keys"]);
  });

  test("the shipped registry passes", () => {
    expect(widgetRegistryProblems(WIDGET_TYPES)).toEqual([]);
  });
});

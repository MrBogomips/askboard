import { describe, expect, test } from "bun:test";
import { effectiveKeys, type KeyEntry, type KeyPress, RANKING_KEYS } from "@askboard/contract";
import { pressOf } from "../../test/key-presses.ts";
import {
  LIST_HANDLERS,
  type ListContext,
  listKeyChange,
  moveOrder,
  toolbarMoveOfPress,
} from "./list-keys.ts";
import { extend, NO_SELECTION, type RowSelection, toggle } from "./selection.ts";

// The Ranking's list and toolbar keys through the key table (view-and-widgets spec: Ranking at the
// keyboard, Ranking row selection, A common key vocabulary, The user's keys on the board; design
// decisions 3, 8 and 19): a press matches an entry of the keys in effect, the entry's action goes
// through a typed record of handlers, and a key the table does not bind, or binds `when: selected`
// with nothing selected, is left to the browser (no change at all).
const ORDER = ["a", "b", "c", "d", "e"];
const NONE = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const ALT_SHIFT = { ...NONE, altKey: true, shiftKey: true };
const SHIFT = { ...NONE, shiftKey: true };
const CTRL = { ...NONE, ctrlKey: true };
const CTRL_SHIFT = { ...NONE, ctrlKey: true, shiftKey: true };
const CTRL_ALT = { ...NONE, ctrlKey: true, altKey: true };

const context = (over: Partial<ListContext> = {}): ListContext => ({
  order: ORDER,
  current: "c",
  selection: NO_SELECTION,
  disabled: false,
  ...over,
});
const selectionOf = (...ids: string[]) =>
  ids.reduce((selection, id) => toggle(selection, ORDER, id), NO_SELECTION);
const take = (
  key: string,
  flags = NONE,
  over: Partial<ListContext> = {},
  table: readonly KeyEntry[] = RANKING_KEYS,
) => listKeyChange(table, pressOf(key, flags), context(over));
const idsOf = (change: ReturnType<typeof take>) => [...(change?.selection?.ids ?? [])].sort();

describe("the cursor", () => {
  test("the arrows, Home and End move the current row and are taken", () => {
    expect(take("ArrowUp")).toEqual({ taken: true, current: "b" });
    expect(take("ArrowDown")).toEqual({ taken: true, current: "d" });
    expect(take("Home")).toEqual({ taken: true, current: "a" });
    expect(take("End")).toEqual({ taken: true, current: "e" });
  });

  test("at an end the key is still taken and the row stays", () => {
    expect(take("ArrowUp", NONE, { current: "a" })).toEqual({ taken: true, current: "a" });
  });

  test("they act in a read-only Ranking", () => {
    expect(take("ArrowDown", NONE, { disabled: true })).toEqual({ taken: true, current: "d" });
  });
});

describe("selecting", () => {
  test("Space toggles the current row", () => {
    const change = take(" ");
    expect(idsOf(change)).toEqual(["c"]);
    expect(change?.taken).toBe(true);
    expect(idsOf(take(" ", NONE, { selection: selectionOf("c") }))).toEqual([]);
  });

  test("Shift+ArrowDown twice from a Space on the second row selects the second to the fourth, the fourth current", () => {
    let selection = selectionOf("b");
    let current = "b";
    for (let press = 0; press < 2; press++) {
      const change = take("ArrowDown", SHIFT, { current, selection });
      selection = change?.selection ?? selection;
      current = change?.current ?? current;
    }
    expect([...selection.ids].sort()).toEqual(["b", "c", "d"]);
    expect(current).toBe("d");
  });

  test("Shift+ArrowUp extends upward and moves the current row", () => {
    const change = take("ArrowUp", SHIFT, { selection: selectionOf("c") });
    expect(idsOf(change)).toEqual(["b", "c"]);
    expect(change?.current).toBe("b");
  });

  test("Shift+ArrowDown with nothing selected starts from the current row", () => {
    const change = take("ArrowDown", SHIFT);
    expect(idsOf(change)).toEqual(["c", "d"]);
    expect(change?.current).toBe("d");
  });

  test("Escape with rows selected selects none, keeps the current row, and is taken", () => {
    const change = take("Escape", NONE, { selection: selectionOf("b", "d") });
    expect(change).toEqual({ taken: true, selection: NO_SELECTION });
  });

  test("Escape with nothing selected is left to the browser", () => {
    expect(take("Escape")).toBeUndefined();
    expect(
      take("Escape", NONE, { selection: toggle(selectionOf("b"), ORDER, "b") }),
    ).toBeUndefined();
  });

  test("the selection keys change nothing in a read-only Ranking, though they are taken", () => {
    expect(take(" ", NONE, { disabled: true })).toEqual({ taken: true });
    expect(take("ArrowDown", SHIFT, { disabled: true })).toEqual({ taken: true });
  });
});

// A range only grows (view-and-widgets spec: Ranking row selection, "A range only grows"; design
// decision 8; review 4.6, S-51): it runs from the anchor and only adds, so Shift+ArrowUp after two
// Shift+ArrowDown does not take a row back, and the anchor is the row last toggled or clicked.
describe("a range only grows", () => {
  const press = (
    key: string,
    flags: typeof NONE,
    state: { current: string; selection: RowSelection },
  ) => {
    const change = take(key, flags, state);
    return {
      current: change?.current ?? state.current,
      selection: change?.selection ?? state.selection,
    };
  };

  test("Space on the second row, Shift+ArrowDown twice, then Shift+ArrowUp keeps the second to the fourth selected, the third current, the anchor the second", () => {
    let state = { current: "b", selection: selectionOf("b") };
    state = press("ArrowDown", SHIFT, state);
    state = press("ArrowDown", SHIFT, state);
    expect([...state.selection.ids].sort()).toEqual(["b", "c", "d"]);
    state = press("ArrowUp", SHIFT, state);
    expect([...state.selection.ids].sort()).toEqual(["b", "c", "d"]);
    expect(state.current).toBe("c");
    expect(state.selection.anchor).toBe("b");
  });

  test("Shift+ArrowDown with no anchor starts at the current row and makes it the anchor", () => {
    const change = take("ArrowDown", SHIFT);
    expect(idsOf(change)).toEqual(["c", "d"]);
    expect(change?.selection?.anchor).toBe("c");
  });

  test("Shift+ArrowUp past the anchor adds the rows above it and keeps those below", () => {
    let state = { current: "c", selection: selectionOf("c") };
    state = press("ArrowDown", SHIFT, state);
    state = press("ArrowUp", SHIFT, state);
    state = press("ArrowUp", SHIFT, state);
    expect([...state.selection.ids].sort()).toEqual(["b", "c", "d"]);
    expect(state.selection.anchor).toBe("c");
  });

  test("Shift+click with no anchor selects the clicked row alone and makes it the anchor", () => {
    const next = extend(NO_SELECTION, ORDER, "c");
    expect(idsOf({ taken: true, selection: next })).toEqual(["c"]);
    expect(next.anchor).toBe("c");
  });

  test("selecting none clears the anchor", () => {
    const change = take("Escape", NONE, { selection: selectionOf("b", "d") });
    expect(change?.selection?.anchor).toBeUndefined();
    expect(change?.selection?.ids.size).toBe(0);
  });
});

describe("moving", () => {
  test("Alt+Shift+ArrowUp moves the current row up, and Alt+Shift+End moves it last", () => {
    expect(take("ArrowUp", ALT_SHIFT)?.order).toEqual(["a", "c", "b", "d", "e"]);
    expect(take("End", ALT_SHIFT)?.order).toEqual(["a", "b", "d", "e", "c"]);
  });

  test("the moves act on the selection when there is one, and the current row stays current", () => {
    const change = take("ArrowUp", ALT_SHIFT, { selection: selectionOf("b", "d"), current: "e" });
    expect(change?.order).toEqual(["b", "a", "d", "c", "e"]);
    expect(change?.current).toBeUndefined();
  });

  test("Alt+Shift+Home and Cmd or Ctrl+Shift+ArrowUp both go to the top", () => {
    expect(take("Home", ALT_SHIFT)?.order).toEqual(["c", "a", "b", "d", "e"]);
    expect(take("ArrowUp", CTRL_SHIFT)?.order).toEqual(["c", "a", "b", "d", "e"]);
    expect(take("ArrowDown", CTRL_SHIFT)?.order).toEqual(["a", "b", "d", "e", "c"]);
  });

  test("a move that moves nothing is still taken, with no order", () => {
    expect(take("ArrowUp", ALT_SHIFT, { current: "a" })).toEqual({ taken: true });
    expect(take("End", ALT_SHIFT, { current: "e" })).toEqual({ taken: true });
  });

  test("a read-only Ranking moves nothing, though the key is taken", () => {
    expect(take("ArrowUp", ALT_SHIFT, { disabled: true })).toEqual({ taken: true });
  });

  test("moveOrder is the same move, for the tools", () => {
    expect(moveOrder(context(), "up")).toEqual(["a", "c", "b", "d", "e"]);
    expect(moveOrder(context({ current: "a" }), "up")).toBeUndefined();
    expect(moveOrder(context({ selection: selectionOf("a", "b") }), "top")).toBeUndefined();
  });
});

describe("Enter keeps the order", () => {
  test("it reports the order as it stands and is taken", () => {
    expect(take("Enter")).toEqual({ taken: true, order: ORDER });
  });

  test("it does nothing in a read-only Ranking", () => {
    expect(take("Enter", NONE, { disabled: true })).toEqual({ taken: true });
  });
});

describe("keys the table does not give the list", () => {
  test("Alt alone, Ctrl with an arrow, Cmd+A, Tab, a letter and F2 are the browser's", () => {
    for (const [key, flags] of [
      ["ArrowUp", { ...NONE, altKey: true }],
      ["ArrowUp", CTRL],
      ["a", CTRL],
      ["Tab", NONE],
      ["x", NONE],
      ["F2", NONE],
      ["ArrowUp", CTRL_ALT],
      ["Enter", SHIFT],
    ] as const) {
      expect(take(key, flags)).toBeUndefined();
    }
  });

  test("a press that an input method composes, or in a text field, matches nothing", () => {
    const composing: KeyPress = { ...pressOf("ArrowDown"), composing: true };
    const inText: KeyPress = { ...pressOf("ArrowDown"), inText: true };
    expect(listKeyChange(RANKING_KEYS, composing, context())).toBeUndefined();
    expect(listKeyChange(RANKING_KEYS, inText, context())).toBeUndefined();
  });

  test("`?` matches the panel's key but is not taken: the frame opens the panel", () => {
    expect(take("?")).toEqual({ taken: false });
  });
});

describe("the user's keys", () => {
  const table = effectiveKeys(RANKING_KEYS, { "move.top": ["Mod+Alt+ArrowUp"], "select.none": [] });

  test("the replaced key acts, and the default one is left to the browser", () => {
    expect(take("ArrowUp", CTRL_ALT, {}, table)?.order).toEqual(["c", "a", "b", "d", "e"]);
    expect(take("Home", ALT_SHIFT, {}, table)).toBeUndefined();
    // The other default of the same action goes with it: the override replaces the whole list.
    expect(take("ArrowUp", CTRL_SHIFT, {}, table)).toBeUndefined();
  });

  test("a removed action's key is left to the browser: Escape keeps both rows selected", () => {
    expect(take("Escape", NONE, { selection: selectionOf("b", "d") }, table)).toBeUndefined();
  });

  test("an action nobody overrode keeps its keys", () => {
    expect(take("ArrowUp", ALT_SHIFT, {}, table)?.order).toEqual(["a", "c", "b", "d", "e"]);
  });

  test("the panel's key, rebound, is the one that is not taken", () => {
    const rebound = effectiveKeys(RANKING_KEYS, { "keys.open": ["Mod+Alt+Enter"] });
    expect(take("Enter", CTRL_ALT, {}, rebound)).toEqual({ taken: false });
    expect(take("?", NONE, {}, rebound)).toBeUndefined();
  });
});

describe("the toolbar's keys", () => {
  const move = (key: string, flags = NONE, table: readonly KeyEntry[] = RANKING_KEYS) =>
    toolbarMoveOfPress(table, pressOf(key, flags));

  test("the horizontal arrows, Home and End move among the tools", () => {
    expect(move("ArrowLeft")).toBe("previous");
    expect(move("ArrowRight")).toBe("next");
    expect(move("Home")).toBe("first");
    expect(move("End")).toBe("last");
  });

  test("another hold, or another key, moves nothing", () => {
    expect(move("ArrowLeft", { ...NONE, altKey: true })).toBeUndefined();
    expect(move("ArrowRight", SHIFT)).toBeUndefined();
    expect(move("ArrowUp")).toBeUndefined();
    expect(move("Enter")).toBeUndefined();
  });

  test("the user's keys replace them: the replaced key acts and the default is the browser's", () => {
    const table = effectiveKeys(RANKING_KEYS, { "toolbar.next": ["Mod+Alt+ArrowDown"] });
    expect(move("ArrowDown", CTRL_ALT, table)).toBe("next");
    expect(move("ArrowRight", NONE, table)).toBeUndefined();
  });

  test("a press that composes moves nothing", () => {
    expect(toolbarMoveOfPress(RANKING_KEYS, { ...pressOf("ArrowRight"), composing: true })).toBe(
      undefined,
    );
  });
});

describe("the handler record", () => {
  test("has a handler for every action of the table's list part, and no other", () => {
    const actions = RANKING_KEYS.filter(({ part }) => part === "list").map(({ action }) => action);
    expect(Object.keys(LIST_HANDLERS).sort()).toEqual([...actions].sort());
  });

  test("Shift+ArrowUp on the first row and Shift+ArrowDown on the last are taken and keep the current row and the selected rows", () => {
    const selection = selectionOf("a", "b");
    const up = take("ArrowUp", SHIFT, { current: "a", selection });
    expect(up?.taken).toBe(true);
    expect(up?.current).toBe("a");
    expect(idsOf(up)).toEqual(["a", "b"]);
    const down = take("ArrowDown", SHIFT, { current: "e", selection: selectionOf("d", "e") });
    expect(down?.current).toBe("e");
    expect(idsOf(down)).toEqual(["d", "e"]);
  });

  test("Shift+ArrowUp and Shift+ArrowDown with no row to go to are taken and change nothing", () => {
    expect(take("ArrowUp", SHIFT, { order: [], current: "x" })).toEqual({ taken: true });
    expect(take("ArrowDown", SHIFT, { order: [], current: "x" })).toEqual({ taken: true });
  });

  test("an extend with a stale anchor starts from the current row", () => {
    const stale = extend(NO_SELECTION, ORDER, "c", "c");
    expect(idsOf(take("ArrowDown", SHIFT, { selection: stale }))).toEqual(["c", "d"]);
  });
});

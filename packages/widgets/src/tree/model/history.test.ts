import { describe, expect, test } from "bun:test";
import {
  entryOf,
  type HistoryEntry,
  kept,
  liveTop,
  popped,
  pushed,
  TREE_HISTORY_DEPTH,
  undoValues,
} from "./history.ts";

// The Tree's edit history (tree-edit-undo design decisions 1 and 2; spec, "Tree undo history").
const draftOf = (entries: Record<string, unknown>) => (id: string) => entries[id];
const entry = (after: unknown, before?: unknown, nodeId?: string): HistoryEntry => ({
  written: { tree: { before, after } },
  nodeId,
});

describe("entryOf", () => {
  test("reads each before from the draft, none as undefined, and keeps the node", () => {
    const made = entryOf(draftOf({ tree: { v: 1 } }), { tree: { v: 2 }, plan: { p: 1 } }, "n1");
    expect(made).toEqual({
      written: {
        tree: { before: { v: 1 }, after: { v: 2 } },
        plan: { before: undefined, after: { p: 1 } },
      },
      nodeId: "n1",
    });
  });

  test("drops a no-op entry, by reference and by structure", () => {
    const held = { v: [1, { a: 1, b: 2 }] };
    expect(entryOf(draftOf({ tree: held }), { tree: held }, "n")).toBeUndefined();
    expect(entryOf(draftOf({ tree: held }), { tree: { v: [1, { b: 2, a: 1 }] } })).toBeUndefined();
    expect(entryOf(draftOf({}), { tree: undefined })).toBeUndefined();
  });

  test("keeps an entry when one of several items changes", () => {
    expect(entryOf(draftOf({ a: 1, b: 2 }), { a: 1, b: 3 })).toBeDefined();
  });
});

describe("pushed and popped", () => {
  test("pushed keeps the latest 50 and drops the oldest", () => {
    let history: readonly HistoryEntry[] = [];
    for (let at = 0; at < TREE_HISTORY_DEPTH + 3; at += 1) history = pushed(history, entry(at));
    expect(TREE_HISTORY_DEPTH).toBe(50);
    expect(history).toHaveLength(50);
    expect(history[0]?.written.tree?.after).toBe(3);
    expect(history.at(-1)?.written.tree?.after).toBe(52);
  });

  test("popped drops the latest and leaves the list alone", () => {
    const history = [entry(1), entry(2)];
    expect(popped(history)).toEqual([entry(1)]);
    expect(history).toHaveLength(2);
    expect(popped([])).toEqual([]);
  });
});

describe("liveTop", () => {
  test("is the top entry while every item holds what it wrote: by reference, by structure, undefined", () => {
    const after = { v: 1 };
    expect(liveTop([entry(after)], draftOf({ tree: after }))).toBeDefined();
    expect(liveTop([entry(after)], draftOf({ tree: { v: 1 } }))).toBeDefined();
    expect(liveTop([entry(undefined, { v: 0 })], draftOf({}))).toBeDefined();
  });

  test("is stale on any other entry, and with no history", () => {
    expect(liveTop([entry({ v: 1 })], draftOf({ tree: { v: 2 } }))).toBeUndefined();
    expect(liveTop([entry({ v: 1 })], draftOf({}))).toBeUndefined();
    expect(liveTop([entry(undefined, { v: 0 })], draftOf({ tree: { v: 0 } }))).toBeUndefined();
    expect(liveTop([], draftOf({}))).toBeUndefined();
  });

  test("a linked write is stale when a plan holds another value", () => {
    const linked: HistoryEntry = {
      written: {
        tree: { before: undefined, after: { t: 1 } },
        plan: { before: { p: 0 }, after: { p: 1 } },
      },
      nodeId: "a",
    };
    expect(liveTop([linked], draftOf({ tree: { t: 1 }, plan: { p: 1 } }))).toBe(linked);
    expect(liveTop([linked], draftOf({ tree: { t: 1 }, plan: { p: 9 } }))).toBeUndefined();
  });
});

describe("undoValues", () => {
  test("gives every before, undefined for no entry, for a Tree and two plans", () => {
    const linked: HistoryEntry = {
      written: {
        tree: { before: undefined, after: { t: 1 } },
        planA: { before: { p: 0 }, after: { p: 1 } },
        planB: { before: undefined, after: { q: 1 } },
      },
      nodeId: "a",
    };
    const values = undoValues(linked);
    expect(Object.keys(values).sort()).toEqual(["planA", "planB", "tree"]);
    expect(values).toEqual({ tree: undefined, planA: { p: 0 }, planB: undefined });
  });
});

describe("kept", () => {
  const history = [entry({ v: 1 })];
  const draft = draftOf({ tree: { v: 1 } });

  test("keeps a live history", () => {
    expect(kept(history, draft, { disabled: false, sentChanged: false })).toBe(history);
  });

  test("empties it when the Tree is disabled, when the agent sent anew, or when the top is stale", () => {
    expect(kept(history, draft, { disabled: true, sentChanged: false })).toEqual([]);
    expect(kept(history, draft, { disabled: false, sentChanged: true })).toEqual([]);
    expect(kept(history, draftOf({}), { disabled: false, sentChanged: false })).toEqual([]);
  });

  test("an empty history stays the same list", () => {
    const none: readonly HistoryEntry[] = [];
    expect(kept(none, draft, { disabled: false, sentChanged: false })).toBe(none);
  });
});

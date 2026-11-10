import { describe, expect, test } from "bun:test";
import { RANKING_KEYS } from "@askboard/contract";
import { currentAfter, entryOf, RANKING_TOOLS, rankingTools, toolbarLayout } from "./keys.ts";

// The Ranking at the keyboard (view-and-widgets spec: Ranking at the keyboard; design decision 8):
// the list's cursor actions move the current row, never the order, and the toolbar's tools are
// enabled only where their act is possible.
const order = ["a", "b", "c"];

describe("currentAfter", () => {
  test("up and down move the current row by one, stopping at the ends", () => {
    expect(currentAfter(order, "b", "down")).toBe("c");
    expect(currentAfter(order, "b", "up")).toBe("a");
    expect(currentAfter(order, "c", "down")).toBe("c");
    expect(currentAfter(order, "a", "up")).toBe("a");
  });

  test("first and last go to the ends", () => {
    expect(currentAfter(order, "b", "first")).toBe("a");
    expect(currentAfter(order, "b", "last")).toBe("c");
  });

  test("a current row the order lacks starts at the first row, and an empty order has none", () => {
    expect(currentAfter(order, "gone", "down")).toBe("a");
    expect(currentAfter([], "a", "first")).toBeUndefined();
  });
});

describe("rankingTools", () => {
  const none = new Set<string>();

  test("Move up and To top are off on the first row, Move down and To bottom on the last", () => {
    expect(rankingTools(order, ["a"], false, false)).toEqual({
      moveUp: false,
      moveDown: true,
      toTop: false,
      toBottom: true,
      keep: true,
      selectNone: false,
    });
    expect(rankingTools(order, ["c"], false, false)).toEqual({
      moveUp: true,
      moveDown: false,
      toTop: true,
      toBottom: false,
      keep: true,
      selectNone: false,
    });
    expect(rankingTools(order, ["b"], false, false)).toMatchObject({
      moveUp: true,
      moveDown: true,
      toTop: true,
      toBottom: true,
    });
  });

  test("they follow the rows that act: two selected rows packed at the top cannot move up", () => {
    expect(rankingTools(order, ["a", "b"], true, false)).toMatchObject({
      moveUp: false,
      toTop: false,
      moveDown: true,
      toBottom: true,
      selectNone: true,
    });
    expect(none.size).toBe(0);
  });

  test("Select none is on exactly while rows are selected", () => {
    expect(rankingTools(order, ["b"], false, false).selectNone).toBe(false);
    expect(rankingTools(order, ["b"], true, false).selectNone).toBe(true);
  });

  test("every tool is off in a read-only Ranking, and no acting row moves nothing", () => {
    expect(rankingTools(order, ["b"], true, true)).toEqual({
      moveUp: false,
      moveDown: false,
      toTop: false,
      toBottom: false,
      keep: false,
      selectNone: false,
    });
    expect(rankingTools(order, [], false, false)).toEqual({
      moveUp: false,
      moveDown: false,
      toTop: false,
      toBottom: false,
      keep: true,
      selectNone: false,
    });
  });
});

describe("RANKING_TOOLS", () => {
  test("lists the six tools in the toolbar's order, each with its table action", () => {
    expect(RANKING_TOOLS.map(({ key, action }) => [key, action])).toEqual([
      ["moveUp", "move.up"],
      ["moveDown", "move.down"],
      ["toTop", "move.top"],
      ["toBottom", "move.bottom"],
      ["keep", "ranking.keep"],
      ["selectNone", "select.none"],
    ]);
  });

  // The widget reads a tool's move from here, so the pairing is what makes a click move rows.
  test("the four tools that move rows carry the move their action names, and the others none", () => {
    const named: Record<string, string> = {
      "move.up": "up",
      "move.down": "down",
      "move.top": "top",
      "move.bottom": "bottom",
    };
    for (const tool of RANKING_TOOLS) {
      const want = named[tool.action];
      expect({ key: tool.key, move: tool.move as string | undefined }).toEqual({
        key: tool.key,
        move: want,
      });
    }
    expect(RANKING_TOOLS.filter(({ move }) => move !== undefined)).toHaveLength(4);
  });
});

// The spec's "Every visible action in the table": the toolbar and the key table, compared both ways.
describe("the toolbar against RANKING_KEYS", () => {
  const listed = RANKING_KEYS.filter(({ part }) => part === "list");

  test("each tool has an entry of the list part, with the tool's label, shown as a tool", () => {
    for (const tool of RANKING_TOOLS) {
      const entry = entryOf(tool.action);
      expect({ action: tool.action, found: entry !== undefined }).toEqual({
        action: tool.action,
        found: true,
      });
      expect(entry?.label).toBe(tool.label);
      expect(entry?.shows).toBe("tool");
    }
  });

  test("each entry shown as a tool has a tool", () => {
    const tools = new Set(RANKING_TOOLS.map(({ action }) => action));
    for (const entry of listed.filter(({ shows }) => shows === "tool")) {
      expect({ action: entry.action, tool: tools.has(entry.action) }).toEqual({
        action: entry.action,
        tool: true,
      });
    }
  });

  test("every other entry is a cursor move or the panel's, or a selection a check box or click makes", () => {
    const others = listed.filter(({ shows }) => shows !== "tool");
    expect(others.map(({ action, shows }) => `${action}:${shows}`).sort()).toEqual(
      [
        "cursor.down:navigation",
        "cursor.first:navigation",
        "cursor.last:navigation",
        "cursor.up:navigation",
        "keys.open:panel",
        "select.extendDown:pointer",
        "select.extendUp:pointer",
        "select.toggle:pointer",
      ].sort(),
    );
  });

  test("the toolbar part holds navigation among the tools only", () => {
    const toolbar = RANKING_KEYS.filter(({ part }) => part === "toolbar");
    expect(toolbar.map(({ action }) => action)).toEqual([
      "toolbar.previous",
      "toolbar.next",
      "toolbar.first",
      "toolbar.last",
    ]);
    expect(toolbar.every(({ shows }) => shows === "navigation")).toBe(true);
  });

  test("entryOf gives none for an action the list lacks", () => {
    expect(entryOf("toolbar.next" as never)).toBeUndefined();
  });
});

// The toolbar's overflow (spec: Ranking at the keyboard, "A crowded toolbar"): which tools the row
// draws, which go into "More", and where the stops after the tools fall. The server renderer cannot
// run a handler or a ref, so the row's drawing is checked in the browser (ranking-keys.browser.ts).
describe("toolbarLayout", () => {
  const keys = (tools: readonly { key: string }[]) => tools.map(({ key }) => key);

  test("a roomy row draws the six tools and gives none to More; the Keys button is the stop after them", () => {
    const layout = toolbarLayout(false, true);
    expect(keys(layout.shown)).toEqual([
      "moveUp",
      "moveDown",
      "toTop",
      "toBottom",
      "keep",
      "selectNone",
    ]);
    expect(layout.given).toEqual([]);
    expect(layout.moreAt).toBeUndefined();
    expect(layout.keysAt).toBe(6);
    expect(layout.stops).toBe(7);
  });

  test("a crowded row gives To top, To bottom and Select none to More, then the Keys button", () => {
    const layout = toolbarLayout(true, true);
    expect(keys(layout.shown)).toEqual(["moveUp", "moveDown", "keep"]);
    expect(keys(layout.given)).toEqual(["toTop", "toBottom", "selectNone"]);
    expect(layout.moreAt).toBe(3);
    expect(layout.keysAt).toBe(4);
    expect(layout.stops).toBe(5);
  });

  test("without a Keys button (outside an item frame) the stops end with the tools or More", () => {
    expect(toolbarLayout(false, false).stops).toBe(6);
    expect(toolbarLayout(true, false).stops).toBe(4);
    expect(toolbarLayout(false, false).keysAt).toBe(6);
  });

  test("each tool is shown or given, never both and never neither", () => {
    for (const crowded of [false, true]) {
      const { shown, given } = toolbarLayout(crowded, true);
      expect([...keys(shown), ...keys(given)].sort()).toEqual(keys(RANKING_TOOLS).sort());
    }
  });
});

// The key tables of the six types that have one (keyboard-shortcuts-help, task 1.5; contract spec:
// Key tables in the registry, Widget types without a key table; view-and-widgets spec: A common key
// vocabulary): each table's entries and parts, as decision 8 lists the Ranking's and as the other
// five types' handlers take keys today (decision 9), and that the registry check passes them.

import { describe, expect, test } from "bun:test";
import {
  ariaKeyShortcuts,
  CHART_KEYS,
  GANTT_KEYS,
  isVocabularyAction,
  KANBAN_KEYS,
  KEY_TABLES_ON_BOARD,
  type KeyBinding,
  type KeyEntry,
  type KeyTable,
  keyTableProblems,
  RANKING_KEYS,
  TIMELINE_KEYS,
  TREE_KEYS,
  WIDGET_TYPES,
  widgetRegistryProblems,
} from "../src/index.ts";

const keysText = (keys: readonly KeyBinding[]): string =>
  keys.map(({ key, hold }) => `${hold}:${key === " " ? "Space" : key}`).join(",");

// One line per entry: part, action, what it shows, its keys, when, its label.
const rows = (table: KeyTable): readonly string[] =>
  table.map(
    (entry: KeyEntry) =>
      `${entry.part} ${entry.action} ${entry.shows} [${keysText(entry.keys)}]${entry.when === undefined ? "" : ` when:${entry.when}`} ${entry.label}`,
  );

const TOOLBAR = [
  "toolbar toolbar.previous navigation [none:ArrowLeft] keys.action.toolbar.previous",
  "toolbar toolbar.next navigation [none:ArrowRight] keys.action.toolbar.next",
  "toolbar toolbar.first navigation [none:Home] keys.action.toolbar.first",
  "toolbar toolbar.last navigation [none:End] keys.action.toolbar.last",
];

describe("the Ranking's table (decision 8)", () => {
  test("list: the cursor, the selection, the moves, Enter to keep, Escape to select none, `?`", () => {
    expect(rows(RANKING_KEYS).filter((row) => row.startsWith("list "))).toEqual([
      "list cursor.up navigation [none:ArrowUp] keys.action.cursor.up",
      "list cursor.down navigation [none:ArrowDown] keys.action.cursor.down",
      "list cursor.first navigation [none:Home] keys.action.cursor.first",
      "list cursor.last navigation [none:End] keys.action.cursor.last",
      "list select.toggle pointer [none:Space] keys.action.select.toggle",
      "list select.extendUp pointer [shift:ArrowUp] keys.action.select.extendUp",
      "list select.extendDown pointer [shift:ArrowDown] keys.action.select.extendDown",
      "list move.up tool [alt+shift:ArrowUp] ranking.moveUp",
      "list move.down tool [alt+shift:ArrowDown] ranking.moveDown",
      "list move.top tool [alt+shift:Home,mod+shift:ArrowUp] ranking.toTop",
      "list move.bottom tool [alt+shift:End,mod+shift:ArrowDown] ranking.toBottom",
      "list ranking.keep tool [none:Enter] ranking.keep",
      "list select.none tool [none:Escape] when:selected ranking.selectNone",
      "list keys.open panel [char:?] keys.action.keys.open",
    ]);
  });

  test("toolbar: the roving focus", () => {
    expect(rows(RANKING_KEYS).filter((row) => row.startsWith("toolbar "))).toEqual(TOOLBAR);
  });

  test("has exactly the two parts, and nothing else", () => {
    expect(new Set(RANKING_KEYS.map(({ part }) => part))).toEqual(new Set(["list", "toolbar"]));
    expect(RANKING_KEYS).toHaveLength(18);
  });

  test("Enter keeps the order and is no vocabulary action; Escape is select none, on a selection", () => {
    const keep = RANKING_KEYS.find(({ action }) => action === "ranking.keep");
    expect(keep?.keys).toEqual([{ key: "Enter", hold: "none" }]);
    expect(RANKING_KEYS.find(({ action }) => action === "select.none")?.when).toBe("selected");
  });

  test("to the top is Alt+Shift+Home or Cmd/Ctrl+Shift+ArrowUp, as the ARIA form says", () => {
    const top = RANKING_KEYS.find(({ action }) => action === "move.top");
    expect(ariaKeyShortcuts(top?.keys ?? [])).toBe(
      "Alt+Shift+Home Control+Shift+ArrowUp Meta+Shift+ArrowUp",
    );
  });

  test("every visible action of the toolbar's tools is in it: move up and down, to top and bottom, keep, select none", () => {
    const tools = RANKING_KEYS.filter(({ shows }) => shows === "tool").map(({ action }) => action);
    expect(tools).toEqual([
      "move.up",
      "move.down",
      "move.top",
      "move.bottom",
      "ranking.keep",
      "select.none",
    ]);
  });
});

describe("the Tree's table (decision 9: today's keys)", () => {
  test("grid: the treegrid's cursor, edit, selection, undo, moves and delete", () => {
    expect(rows(TREE_KEYS).filter((row) => row.startsWith("grid "))).toEqual([
      "grid cursor.up navigation [none:ArrowUp] keys.action.cursor.up",
      "grid cursor.down navigation [none:ArrowDown] keys.action.cursor.down",
      "grid cursor.left navigation [none:ArrowLeft] keys.action.cursor.left",
      "grid cursor.right navigation [none:ArrowRight] keys.action.cursor.right",
      "grid cursor.first navigation [none:Home] keys.action.cursor.first",
      "grid cursor.last navigation [none:End] keys.action.cursor.last",
      "grid edit.start pointer [none:Enter,none:F2] keys.action.edit.start",
      "grid select.toggle pointer [none:Space] keys.action.select.toggle",
      "grid select.extendUp pointer [shift:ArrowUp] keys.action.select.extendUp",
      "grid select.extendDown pointer [shift:ArrowDown] keys.action.select.extendDown",
      "grid undo tool [mod:z] tree.tool.undoAdjust",
      "grid move.up tool [alt+shift:ArrowUp] tree.tool.moveUp",
      "grid move.down tool [alt+shift:ArrowDown] tree.tool.moveDown",
      "grid move.right tool [alt+shift:ArrowRight] tree.tool.indent",
      "grid move.left tool [alt+shift:ArrowLeft] tree.tool.outdent",
      "grid delete tool [none:Delete,none:Backspace] tree.tool.remove",
    ]);
  });

  test("editor, toolbar (with the tools no key takes) and the two questions", () => {
    expect(rows(TREE_KEYS).filter((row) => !row.startsWith("grid "))).toEqual([
      "editor edit.commit navigation [none:Enter] keys.action.edit.commit",
      "editor edit.cancel navigation [none:Escape] keys.action.edit.cancel",
      ...TOOLBAR,
      "toolbar tree.addAfter tool [] tree.tool.addAfter",
      "toolbar tree.addChild tool [] tree.tool.addChild",
      "toolbar tree.selectAll tool [] tree.select.all",
      "toolbar tree.selectNone tool [] tree.select.none",
      "toolbar tree.adjust tool [] tree.tool.adjust",
      "delete-question tree.cancelDelete navigation [none:Escape] tree.delete.cancel",
      "group-question tree.cancelGroup navigation [none:Escape] tree.group.cancel",
    ]);
  });

  test("takes none of the keys the lists retrofit adds: add, select all, select none, adjust, `?`", () => {
    const actions = new Set<string>(TREE_KEYS.map(({ action }) => action));
    for (const action of [
      "add.after",
      "add.child",
      "select.all",
      "select.none",
      "adjust.percent",
      "keys.open",
    ]) {
      expect(actions.has(action)).toBe(false);
    }
  });
});

describe("the Gantt's table (decision 9: today's keys)", () => {
  test("grid, editor, zoom, edge, panel and the switch", () => {
    expect(rows(GANTT_KEYS)).toEqual([
      "grid cursor.up navigation [none:ArrowUp] keys.action.cursor.up",
      "grid cursor.down navigation [none:ArrowDown] keys.action.cursor.down",
      "grid cursor.left navigation [none:ArrowLeft] keys.action.cursor.left",
      "grid cursor.right navigation [none:ArrowRight] keys.action.cursor.right",
      "grid cursor.first navigation [none:Home] keys.action.cursor.first",
      "grid cursor.last navigation [none:End] keys.action.cursor.last",
      "grid edit.start pointer [none:Enter,none:F2] keys.action.edit.start",
      "grid gantt.clear pointer [none:Delete,none:Backspace] keys.action.gantt.clear",
      "editor edit.commit navigation [none:Enter] keys.action.edit.commit",
      "editor edit.cancel navigation [none:Escape] keys.action.edit.cancel",
      "zoom toolbar.previous navigation [none:ArrowLeft] keys.action.toolbar.previous",
      "zoom toolbar.next navigation [none:ArrowRight] keys.action.toolbar.next",
      "zoom toolbar.first navigation [none:Home] keys.action.toolbar.first",
      "zoom toolbar.last navigation [none:End] keys.action.toolbar.last",
      "edge gantt.narrower pointer [none:ArrowLeft] keys.action.gantt.narrower",
      "edge gantt.wider pointer [none:ArrowRight] keys.action.gantt.wider",
      "edge gantt.narrowerMore pointer [shift:ArrowLeft] keys.action.gantt.narrowerMore",
      "edge gantt.widerMore pointer [shift:ArrowRight] keys.action.gantt.widerMore",
      "edge gantt.narrowest pointer [none:Home] keys.action.gantt.narrowest",
      "edge gantt.widest pointer [none:End] keys.action.gantt.widest",
      "edge gantt.fit pointer [none:Enter] keys.action.gantt.fit",
      "panel cursor.up navigation [none:ArrowUp] keys.action.cursor.up",
      "panel cursor.down navigation [none:ArrowDown] keys.action.cursor.down",
      "panel edit.commit navigation [none:Enter] gantt.panel.done",
      "panel edit.cancel navigation [none:Escape] keys.action.edit.cancel",
      "panel gantt.togglePredecessor native [none:Space] keys.action.gantt.togglePredecessor",
      "switch toolbar.previous navigation [none:ArrowLeft] keys.action.toolbar.previous",
      "switch toolbar.first navigation [none:Home] keys.action.toolbar.first",
      "switch gantt.criticalPath native [none:Space] gantt.critical.switch",
    ]);
  });

  test("the switch is a native entry: listed and taught, matched by Radix", () => {
    const natives = GANTT_KEYS.filter(({ shows }) => shows === "native").map(
      ({ action }) => action,
    );
    expect(natives).toEqual(["gantt.togglePredecessor", "gantt.criticalPath"]);
  });
});

describe("the Kanban's table (decision 9: today's keys, kanban-order not merged)", () => {
  test("the board's cursor, the toolbar's roving focus and the Move to… menu", () => {
    expect(rows(KANBAN_KEYS)).toEqual([
      "board cursor.up navigation [none:ArrowUp] keys.action.cursor.up",
      "board cursor.down navigation [none:ArrowDown] keys.action.cursor.down",
      "board cursor.left navigation [none:ArrowLeft] keys.action.cursor.left",
      "board cursor.right navigation [none:ArrowRight] keys.action.cursor.right",
      ...TOOLBAR,
      "toolbar kanban.moveTo menu [] kanban.moveTo",
    ]);
  });

  test("has no Home or End on the board, which the handler does not take", () => {
    const board = KANBAN_KEYS.filter(({ part }) => part === "board").flatMap(({ keys }) => keys);
    expect(board.map(({ key }) => key).sort()).toEqual(
      ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].sort(),
    );
  });
});

describe("the Timeline's table (decision 9: today's keys)", () => {
  test("the entries' cursor, the toolbar's roving focus and its three tools without keys", () => {
    expect(rows(TIMELINE_KEYS)).toEqual([
      "entries cursor.up navigation [none:ArrowUp] keys.action.cursor.up",
      "entries cursor.down navigation [none:ArrowDown] keys.action.cursor.down",
      "entries cursor.first navigation [none:Home] keys.action.cursor.first",
      "entries cursor.last navigation [none:End] keys.action.cursor.last",
      ...TOOLBAR,
      "toolbar timeline.moveEarlier tool [] timeline.moveEarlier",
      "toolbar timeline.moveLater tool [] timeline.moveLater",
      "toolbar timeline.moveToLane menu [] timeline.moveToLane",
    ]);
  });
});

describe("the Chart's table (decision 9: today's keys)", () => {
  test("the plot's cursor, and Space or Enter to highlight", () => {
    expect(rows(CHART_KEYS)).toEqual([
      "plot cursor.up navigation [none:ArrowUp] keys.action.cursor.up",
      "plot cursor.down navigation [none:ArrowDown] keys.action.cursor.down",
      "plot cursor.left navigation [none:ArrowLeft] keys.action.cursor.left",
      "plot cursor.right navigation [none:ArrowRight] keys.action.cursor.right",
      "plot cursor.first navigation [none:Home] keys.action.cursor.first",
      "plot cursor.last navigation [none:End] keys.action.cursor.last",
      "plot chart.highlight pointer [none:Space,none:Enter] keys.action.chart.highlight",
    ]);
  });
});

// Whether each part's actions still act while the item takes no edits (design decision 2, review
// 1.6 S-3): for each part, the actions that do (`readOnly`) and those that do not (`edits`), as
// each part's component behaves today. The evidence per part is in task 1.7's note.
type ReadOnlySplit = Readonly<Record<string, { readOnly: string[]; edits: string[] }>>;

const split = (table: KeyTable): ReadOnlySplit => {
  const out: Record<string, { readOnly: string[]; edits: string[] }> = {};
  for (const { part, action, readOnly } of table) {
    const into = out[part] ?? { readOnly: [], edits: [] };
    out[part] = into;
    (readOnly ? into.readOnly : into.edits).push(action);
  }
  return out;
};

const NAV_TOOLBAR = ["toolbar.previous", "toolbar.next", "toolbar.first", "toolbar.last"];

describe("each table's readOnly, part by part (decision 2, review 1.6 S-3)", () => {
  test("the Ranking: the cursor, `?` and the toolbar's roving focus act; the moves, the selection, keep and select none do not", () => {
    expect(split(RANKING_KEYS)).toEqual({
      list: {
        readOnly: ["cursor.up", "cursor.down", "cursor.first", "cursor.last", "keys.open"],
        edits: [
          "select.toggle",
          "select.extendUp",
          "select.extendDown",
          "move.up",
          "move.down",
          "move.top",
          "move.bottom",
          "ranking.keep",
          "select.none",
        ],
      },
      toolbar: { readOnly: [], edits: NAV_TOOLBAR },
    });
  });

  test("the Tree: the cursor and the toolbar's focus act; the selection, edits, undo, moves, delete, the editor and the two questions do not", () => {
    expect(split(TREE_KEYS)).toEqual({
      grid: {
        readOnly: [
          "cursor.up",
          "cursor.down",
          "cursor.left",
          "cursor.right",
          "cursor.first",
          "cursor.last",
        ],
        edits: [
          "edit.start",
          "select.toggle",
          "select.extendUp",
          "select.extendDown",
          "undo",
          "move.up",
          "move.down",
          "move.right",
          "move.left",
          "delete",
        ],
      },
      editor: { readOnly: [], edits: ["edit.commit", "edit.cancel"] },
      toolbar: {
        readOnly: NAV_TOOLBAR,
        edits: [
          "tree.addAfter",
          "tree.addChild",
          "tree.selectAll",
          "tree.selectNone",
          "tree.adjust",
        ],
      },
      "delete-question": { readOnly: [], edits: ["tree.cancelDelete"] },
      "group-question": { readOnly: [], edits: ["tree.cancelGroup"] },
    });
  });

  test("the Gantt: the grid's cursor, the zoom, the column edge and the switch act; the editor, the clear and the predecessors panel do not", () => {
    expect(split(GANTT_KEYS)).toEqual({
      grid: {
        readOnly: [
          "cursor.up",
          "cursor.down",
          "cursor.left",
          "cursor.right",
          "cursor.first",
          "cursor.last",
        ],
        edits: ["edit.start", "gantt.clear"],
      },
      editor: { readOnly: [], edits: ["edit.commit", "edit.cancel"] },
      zoom: { readOnly: NAV_TOOLBAR, edits: [] },
      edge: {
        readOnly: [
          "gantt.narrower",
          "gantt.wider",
          "gantt.narrowerMore",
          "gantt.widerMore",
          "gantt.narrowest",
          "gantt.widest",
          "gantt.fit",
        ],
        edits: [],
      },
      panel: {
        readOnly: [],
        edits: [
          "cursor.up",
          "cursor.down",
          "edit.commit",
          "edit.cancel",
          "gantt.togglePredecessor",
        ],
      },
      switch: {
        readOnly: ["toolbar.previous", "toolbar.first", "gantt.criticalPath"],
        edits: [],
      },
    });
  });

  test("the Kanban: the cursor and the toolbar's focus act; Move to… does not", () => {
    expect(split(KANBAN_KEYS)).toEqual({
      board: {
        readOnly: ["cursor.up", "cursor.down", "cursor.left", "cursor.right"],
        edits: [],
      },
      toolbar: { readOnly: [], edits: [...NAV_TOOLBAR, "kanban.moveTo"] },
    });
  });

  test("the Timeline: the cursor and the toolbar's focus act; its three tools do not", () => {
    expect(split(TIMELINE_KEYS)).toEqual({
      entries: {
        readOnly: ["cursor.up", "cursor.down", "cursor.first", "cursor.last"],
        edits: [],
      },
      toolbar: {
        readOnly: [],
        edits: [
          ...NAV_TOOLBAR,
          "timeline.moveEarlier",
          "timeline.moveLater",
          "timeline.moveToLane",
        ],
      },
    });
  });

  test("the Chart: the cursor acts; Space or Enter to highlight does not", () => {
    expect(split(CHART_KEYS)).toEqual({
      plot: {
        readOnly: [
          "cursor.up",
          "cursor.down",
          "cursor.left",
          "cursor.right",
          "cursor.first",
          "cursor.last",
        ],
        edits: ["chart.highlight"],
      },
    });
  });

  test("every entry of every shipped table has a boolean, and none that changes the answer is read-only", () => {
    const CHANGING = /^(move|add|edit|delete|undo|adjust)\b/;
    for (const table of [
      RANKING_KEYS,
      TREE_KEYS,
      GANTT_KEYS,
      KANBAN_KEYS,
      TIMELINE_KEYS,
      CHART_KEYS,
    ] as readonly KeyTable[]) {
      for (const { action, readOnly } of table) {
        expect(typeof readOnly).toBe("boolean");
        if (CHANGING.test(action))
          expect({ action, readOnly }).toEqual({ action, readOnly: false });
      }
    }
  });
});

describe("every tool and menu is listed, keyless where no key takes it (decision 6)", () => {
  const KEYLESS: readonly (readonly [string, KeyTable, string, "tool" | "menu", string])[] = [
    ["tree", TREE_KEYS, "tree.addAfter", "tool", "tree.tool.addAfter"],
    ["tree", TREE_KEYS, "tree.addChild", "tool", "tree.tool.addChild"],
    ["tree", TREE_KEYS, "tree.selectAll", "tool", "tree.select.all"],
    ["tree", TREE_KEYS, "tree.selectNone", "tool", "tree.select.none"],
    ["tree", TREE_KEYS, "tree.adjust", "tool", "tree.tool.adjust"],
    ["timeline", TIMELINE_KEYS, "timeline.moveEarlier", "tool", "timeline.moveEarlier"],
    ["timeline", TIMELINE_KEYS, "timeline.moveLater", "tool", "timeline.moveLater"],
    ["timeline", TIMELINE_KEYS, "timeline.moveToLane", "menu", "timeline.moveToLane"],
    ["kanban", KANBAN_KEYS, "kanban.moveTo", "menu", "kanban.moveTo"],
  ];

  test("the Tree's five, the Timeline's three and the Kanban's one are keyless, label the tool's own string key and act on an item that takes edits only", () => {
    for (const [type, table, action, shows, label] of KEYLESS) {
      const found = table.find((entry: KeyEntry) => entry.action === action);
      expect({ type, action, entry: found }).toEqual({
        type,
        action,
        entry: expect.objectContaining({ keys: [], shows, label, readOnly: false }),
      });
    }
  });

  test("no other entry of a shipped table is keyless", () => {
    const listed = new Set(KEYLESS.map(([, , action]) => action));
    for (const table of [
      RANKING_KEYS,
      TREE_KEYS,
      GANTT_KEYS,
      KANBAN_KEYS,
      TIMELINE_KEYS,
      CHART_KEYS,
    ] as readonly KeyTable[]) {
      for (const { action, keys } of table) {
        if (keys.length === 0) expect(listed.has(action)).toBe(true);
      }
    }
  });

  test("every keyless entry of every shipped table is an own action of its type, never a vocabulary action", () => {
    const TABLES: readonly (readonly [string, KeyTable])[] = [
      ["ranking", RANKING_KEYS],
      ["tree", TREE_KEYS],
      ["gantt", GANTT_KEYS],
      ["kanban", KANBAN_KEYS],
      ["timeline", TIMELINE_KEYS],
      ["chart", CHART_KEYS],
    ];
    let keyless = 0;
    for (const [type, table] of TABLES) {
      for (const { action, keys, shows } of table) {
        if (keys.length > 0) continue;
        keyless += 1;
        expect(isVocabularyAction(action)).toBe(false);
        expect(action.startsWith(`${type}.`)).toBe(true);
        expect(["tool", "menu"]).toContain(shows);
      }
    }
    expect(keyless).toBe(KEYLESS.length);
  });

  test("the Tree's keyless tools keep the keys of the vocabulary's actions off them: Add node has no Alt+Shift+Enter, Select all no Cmd/Ctrl+A", () => {
    const bound = new Set(
      TREE_KEYS.flatMap(({ keys }) => keys.map(({ key, hold }) => `${hold}:${key}`)),
    );
    expect(bound.has("alt+shift:Enter")).toBe(false);
    expect(bound.has("mod:a")).toBe(false);
    expect(bound.has("char:%")).toBe(false);
  });
});

describe("the registry", () => {
  const TABLES: Readonly<Record<string, KeyTable>> = {
    tree: TREE_KEYS,
    gantt: GANTT_KEYS,
    ranking: RANKING_KEYS,
    kanban: KANBAN_KEYS,
    timeline: TIMELINE_KEYS,
    chart: CHART_KEYS,
  };

  test("carries each table on its entry, and no other entry has one", () => {
    for (const { type, keys } of WIDGET_TYPES) {
      expect({ type, table: keys }).toEqual({ type, table: TABLES[type] });
    }
    expect(WIDGET_TYPES.filter(({ keys }) => keys !== undefined).map(({ type }) => type)).toEqual([
      "tree",
      "gantt",
      "ranking",
      "kanban",
      "timeline",
      "chart",
    ]);
  });

  test("passes the registry's check, and each table passes its own", () => {
    expect(widgetRegistryProblems(WIDGET_TYPES)).toEqual([]);
    for (const [type, table] of Object.entries(TABLES)) {
      expect({ type, problems: keyTableProblems(type, table) }).toEqual({ type, problems: [] });
    }
  });

  test("every entry names a part, a label key and its own action under its type", () => {
    for (const [type, table] of Object.entries(TABLES)) {
      for (const entry of table) {
        expect(entry.part).not.toBe("");
        expect(entry.label).toMatch(/^[a-z][A-Za-z]*(\.[A-Za-z]+)+$/);
        if (
          !/^(cursor|select|move|add|edit|delete|adjust|undo|keys|toolbar)\b/.test(entry.action)
        ) {
          expect({ type, action: entry.action }).toEqual({
            type,
            action: expect.stringMatching(new RegExp(`^${type}\\.`)),
          });
        }
      }
    }
  });

  test("no table binds Alt, Ctrl or Cmd with a key the browser needs: nothing in them holds `other`", () => {
    for (const table of Object.values(TABLES)) {
      for (const { keys } of table) {
        for (const { hold } of keys) expect(hold).not.toBe("other");
      }
    }
  });
});

// The types whose chunk registers its key table with the board (design decisions 9, 14 and 20;
// review 5.6, S-31): the board shows a Keys button and a panel for them only, and takes the user's
// keys there. A retrofit appends its types; `component-facts.test.ts` ties the list to the chunks.
describe("KEY_TABLES_ON_BOARD", () => {
  test("is a frozen list of registered type names, each with a key table", () => {
    expect(Object.isFrozen(KEY_TABLES_ON_BOARD)).toBe(true);
    for (const type of KEY_TABLES_ON_BOARD) {
      const entry = WIDGET_TYPES.find((candidate) => candidate.type === type);
      expect(entry?.keys, `${type} has a key table`).toBeDefined();
    }
    expect(new Set(KEY_TABLES_ON_BOARD).size).toBe(KEY_TABLES_ON_BOARD.length);
  });

  test("lists the Ranking, the one type whose chunk registers its table so far; each retrofit appends its types", () => {
    expect(KEY_TABLES_ON_BOARD).toEqual(["ranking"]);
  });
});

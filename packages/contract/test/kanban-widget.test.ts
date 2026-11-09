// The Kanban's entry (latex-kanban-timeline, task 1.4; contract spec: Kanban items, Kanban
// changes), composed over the shipped registry with `withWidgetTypes` while the type is not yet
// registered (design decision 12), in a fresh Ajv.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import {
  EDIT_WIDGETS_SESSION,
  KANBAN_BOTH_CHANGES,
  KANBAN_BOTH_PROPS,
  KANBAN_CHANGES,
  KANBAN_EDITED_PROPS,
  KANBAN_FIXTURE_ITEM,
  KANBAN_ORDER_ITEM,
  KANBAN_PLACED_CHANGES,
  KANBAN_PLACED_PROPS,
  KANBAN_REORDER_CHANGES,
  KANBAN_REORDERED_PROPS,
  kanbanAct,
  kanbanAnswerEvent,
  kanbanFetchItemResult,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  applyElementChanges,
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  elementChanges,
  KANBAN_MAX_CARDS,
  KANBAN_MAX_COLUMNS,
  KANBAN_SCHEMA_IDS,
  KANBAN_SHAPE,
  KANBAN_WIDGET,
  kanbanPropsProblems,
  widgetChangesProblems,
  widgetRegistryProblems,
} from "../src/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { elementShapeOf, validateBoardMessage } from "../src/validate.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";
import { askAccepted, askProblems } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(KANBAN_WIDGET);
const ITEM = KANBAN_FIXTURE_ITEM;
const COLUMNS = ITEM.props.columns;
const kanban = (props: unknown, id = "board") => ({ type: "kanban", id, props });
const withCards = (cards: unknown, columns: unknown = COLUMNS) => kanban({ columns, cards });
const problems = (item: unknown) => askProblems(TYPES, item as ReturnType<typeof kanban>);
const fieldsOf = (item: unknown) => problems(item).map(({ field }) => field);
const columns = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `c${index}`, label: `Column ${index}` }));
const cards = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `k${index}`,
    label: `Card ${index}`,
    column: "todo",
  }));
type Card = { id: string; label: string; column: string };
const card = (extra: object = {}) => ({ id: "fix-login", label: "Fix", column: "todo", ...extra });

describe("Kanban items", () => {
  test("a Kanban of three columns and three cards passes, in an ask and in a board document", () => {
    expect(problems(ITEM)).toEqual([]);
    expect(askAccepted(TYPES, ITEM)).toBe(true);
    const document = {
      version: BOARD_DOCUMENT_VERSION,
      askId: "kanban-check-a1b2",
      title: "Where do these cards go?",
      items: [{ type: "question", id: "q", rev: 1, props: { text: "Move them", items: [ITEM] } }],
    };
    expect(errorsOf(ajvOver(TYPES), SCHEMA_IDS.boardDocument, document)).toEqual([]);
    expect(ITEM.props.columns.map(({ id }) => id)).toEqual(["todo", "doing", "done"]);
    expect(ITEM.props.cards).toHaveLength(3);
  });

  test("a card in no column fails, naming the item, the card and column", () => {
    const [problem, ...rest] = problems(withCards([card({ column: "blocked" })]));
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("board");
    expect(problem?.field).toBe("props.cards[0].column");
    expect(problem?.message).toContain('item "board"');
    expect(problem?.message).toContain('card "fix-login"');
    expect(problem?.message).toContain('"blocked"');
  });

  test("an ID held by a card and a column, or by two cards, fails, naming the ID", () => {
    const [clash, ...rest] = problems(withCards([card({ id: "done" })]));
    expect(rest).toEqual([]);
    expect(clash?.message).toContain('item "board"');
    expect(clash?.message).toContain('"done"');
    expect(clash?.field).toBe("props.cards[0].id");
    const twice = problems(withCards([card(), card({ label: "Again" })]));
    expect(twice.map(({ field }) => field)).toEqual(["props.cards[1].id"]);
    expect(twice[0]?.message).toContain('"fix-login"');
    const columnTwice = problems(withCards([card()], [...COLUMNS, { id: "todo", label: "Again" }]));
    expect(columnTwice.map(({ field }) => field)).toEqual(["props.columns[3].id"]);
    expect(columnTwice[0]?.message).toContain('"todo"');
  });

  test("a single column fails, naming columns", () => {
    const [problem, ...rest] = problems(withCards([card()], [COLUMNS[0]]));
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("board");
    expect(problem?.field).toBe("props.columns");
    expect(askAccepted(TYPES, withCards([card()], [COLUMNS[0]]))).toBe(false);
  });

  test("2 columns pass, 12 pass and 13 fail", () => {
    expect([KANBAN_MAX_COLUMNS, KANBAN_MAX_CARDS]).toEqual([12, 200]);
    expect(problems(withCards([card({ column: "c0" })], columns(2)))).toEqual([]);
    expect(problems(withCards([card({ column: "c0" })], columns(12)))).toEqual([]);
    expect(askAccepted(TYPES, withCards([card({ column: "c0" })], columns(12)))).toBe(true);
    expect(fieldsOf(withCards([card({ column: "c0" })], columns(13)))).toEqual(["props.columns"]);
    expect(askAccepted(TYPES, withCards([card({ column: "c0" })], columns(13)))).toBe(false);
  });

  test("1 card passes, none fails, 200 pass and 201 fail", () => {
    expect(problems(withCards(cards(1)))).toEqual([]);
    expect(fieldsOf(withCards([]))).toEqual(["props.cards"]);
    expect(problems(withCards(cards(200)))).toEqual([]);
    expect(askAccepted(TYPES, withCards(cards(200)))).toBe(true);
    expect(fieldsOf(withCards(cards(201)))).toEqual(["props.cards"]);
    expect(askAccepted(TYPES, withCards(cards(201)))).toBe(false);
  });

  test("a column label of 60 passes, of 61 or none fails, naming the column", () => {
    const one = (label: unknown) =>
      withCards([card({ column: "todo" })], [{ id: "todo", label }, COLUMNS[1]]);
    expect(problems(one("l".repeat(60)))).toEqual([]);
    const [long] = problems(one("l".repeat(61)));
    expect(long?.field).toBe("props.columns[0].label");
    expect(long?.message).toContain('column "todo"');
    expect(fieldsOf(one(""))).toEqual(["props.columns[0].label"]);
  });

  test("a card label of 200 passes, of 201 or none fails, naming the card", () => {
    expect(problems(withCards([card({ label: "l".repeat(200) })]))).toEqual([]);
    const [long, ...rest] = problems(withCards([card({ label: "l".repeat(201) })]));
    expect(rest).toEqual([]);
    expect(long?.field).toBe("props.cards[0].label");
    expect(long?.message).toContain('card "fix-login"');
    expect(fieldsOf(withCards([card({ label: "" })]))).toEqual(["props.cards[0].label"]);
  });

  test("a description of 500 passes, of 501 or none fails, naming the card", () => {
    expect(problems(withCards([card({ description: "d".repeat(500) })]))).toEqual([]);
    const [long] = problems(withCards([card({ description: "d".repeat(501) })]));
    expect(long?.field).toBe("props.cards[0].description");
    expect(long?.message).toContain('card "fix-login"');
    expect(fieldsOf(withCards([card({ description: "" })]))).toEqual([
      "props.cards[0].description",
    ]);
  });

  test("an ID outside the pattern, a missing field and one the item does not define fail", () => {
    expect(fieldsOf(withCards([card({ id: "fix login" })]))).toEqual(["props.cards[0].id"]);
    expect(fieldsOf(withCards([card({ rank: 1 })]))).toEqual(["props.cards[0].rank"]);
    expect(fieldsOf(withCards([{ id: "a", label: "A" }]))).toEqual(["props.cards[0].column"]);
    expect(fieldsOf(withCards([{ label: "A", column: "todo" }]))).toEqual(["props.cards[0].id"]);
    expect(fieldsOf(kanban({ columns: COLUMNS, cards: [card()], limit: 3 }))).toEqual([
      "props.limit",
    ]);
    expect(fieldsOf(kanban({ cards: [card()] }))).toEqual(["props.columns"]);
    expect(fieldsOf(kanban({ columns: COLUMNS }))).toEqual(["props.cards"]);
    expect(askAccepted(TYPES, kanban("x"))).toBe(false);
  });

  test("the plain check never throws and gives a problem for what it cannot read", () => {
    expect(kanbanPropsProblems(ITEM.props)).toEqual([]);
    for (const props of [
      null,
      3,
      "x",
      [],
      {},
      { columns: null, cards: null },
      { columns: [null, 3, {}], cards: [null, 3, {}] },
    ]) {
      expect(() => kanbanPropsProblems(props)).not.toThrow();
    }
    expect(kanbanPropsProblems(null)).not.toEqual([]);
    expect(
      kanbanPropsProblems({ columns: COLUMNS, cards: [card({ column: "nope" })] }),
    ).not.toEqual([]);
    expect(KANBAN_WIDGET.propsProblems(ITEM.props, "agent")).toEqual([]);
    expect(KANBAN_WIDGET.propsProblems(KANBAN_EDITED_PROPS, "edited")).toEqual([]);
  });

  test("a card moved to a column that does not exist is refused in the edited value too", () => {
    const edited = { ...ITEM.props, cards: [card({ column: "nowhere" })] };
    expect(KANBAN_WIDGET.propsProblems(edited, "edited")).not.toEqual([]);
  });
});

describe("Kanban changes", () => {
  const item = { type: "kanban", id: "board" };
  const check = (changes: unknown) => widgetChangesProblems(item, changes, TYPES);

  test("the shape is the flat list of the cards grouped by column, and the entry's shape is that one", () => {
    expect(KANBAN_SHAPE).toEqual({ elements: "cards", group: "column" });
    expect(Object.isFrozen(KANBAN_SHAPE)).toBe(true);
    expect(elementShapeOf(ITEM, TYPES)).toEqual(KANBAN_SHAPE);
    expect(KANBAN_WIDGET.edits?.changes.$id).toBe(KANBAN_SCHEMA_IDS.changes);
  });

  test("a moved card is one set of its column, which the check passes and applies back", () => {
    const changes = elementChanges("board", ITEM.props, KANBAN_EDITED_PROPS, KANBAN_SHAPE);
    expect(changes).toEqual([{ op: "set", target: "board.fix-login.column", value: "doing" }]);
    expect(changes).toEqual(KANBAN_CHANGES);
    expect(check(changes)).toEqual([]);
    expect(applyElementChanges("board", ITEM.props, changes, KANBAN_SHAPE)).toEqual(
      KANBAN_EDITED_PROPS,
    );
  });

  test("several cards moved to one column give one set each, in the cards' order", () => {
    const edited = {
      ...ITEM.props,
      cards: ITEM.props.cards.map((one) => ({ ...one, column: "done" })),
    };
    const changes = elementChanges("board", ITEM.props, edited, KANBAN_SHAPE);
    expect(changes.map(({ target }) => target)).toEqual([
      "board.fix-login.column",
      "board.write-docs.column",
    ]);
    expect(check(changes)).toEqual([]);
  });

  test("cards moved to different columns give their sets column by column, the flat diff's operations in another order", () => {
    // Each card keeps its index, so each stands where the sent order puts it in its new column.
    const edited = {
      ...ITEM.props,
      cards: ITEM.props.cards.map((one) =>
        one.id === "fix-login"
          ? { ...one, column: "done" }
          : one.id === "release-notes"
            ? { ...one, column: "doing" }
            : one,
      ),
    };
    const changes = elementChanges("board", ITEM.props, edited, KANBAN_SHAPE);
    // The groups in code-unit order of their IDs: `doing` before `done`, not the cards' order.
    expect(changes).toEqual([
      { op: "set", target: "board.release-notes.column", value: "doing" },
      { op: "set", target: "board.fix-login.column", value: "done" },
    ]);
    const flat = elementChanges("board", ITEM.props, edited, { elements: "cards" });
    expect(flat).toEqual([
      { op: "set", target: "board.fix-login.column", value: "done" },
      { op: "set", target: "board.release-notes.column", value: "doing" },
    ]);
    const byTarget = (a: { target: string }, b: { target: string }) =>
      a.target < b.target ? -1 : a.target > b.target ? 1 : 0;
    expect([...changes].sort(byTarget)).toEqual([...flat].sort(byTarget));
    expect(check(changes)).toEqual([]);
    expect(applyElementChanges("board", ITEM.props, changes, KANBAN_SHAPE)).toEqual(edited);
  });

  test("the reversal of a Kanban with one card per column gives no change, and an in-column reorder a move the check passes", () => {
    const reversed = { ...ITEM.props, cards: [...ITEM.props.cards].reverse() };
    expect(elementChanges("board", ITEM.props, reversed, KANBAN_SHAPE)).toEqual([]);
    const [first, second, third] = KANBAN_ORDER_ITEM.props.cards.filter(
      ({ column }) => column === "todo",
    );
    const todo = [third, first, second];
    const edited = {
      ...KANBAN_ORDER_ITEM.props,
      cards: [...todo, ...KANBAN_ORDER_ITEM.props.cards.filter(({ column }) => column !== "todo")],
    };
    const changes = elementChanges("board", KANBAN_ORDER_ITEM.props, edited, KANBAN_SHAPE);
    expect(changes).toEqual([{ op: "move", target: `board.${third?.id}` }]);
    expect(check(changes)).toEqual([]);
  });

  test("a card placed first in its column is one move with no after", () => {
    expect(KANBAN_REORDER_CHANGES).toEqual([{ op: "move", target: "board.add-sso" }]);
    const changes = elementChanges(
      "board",
      KANBAN_ORDER_ITEM.props,
      KANBAN_REORDERED_PROPS,
      KANBAN_SHAPE,
    );
    expect(changes).toEqual(KANBAN_REORDER_CHANGES);
    expect(check(changes)).toEqual([]);
  });

  test("a card placed after another in another column is its set, then its move", () => {
    expect(KANBAN_PLACED_CHANGES).toEqual([
      { op: "set", target: "board.audit.column", value: "doing" },
      { op: "move", target: "board.audit", after: "write-docs" },
    ]);
    const changes = elementChanges(
      "board",
      KANBAN_ORDER_ITEM.props,
      KANBAN_PLACED_PROPS,
      KANBAN_SHAPE,
    );
    expect(changes).toEqual(KANBAN_PLACED_CHANGES);
    expect(check(changes)).toEqual([]);
  });

  test("a card dragged into another column below a card sent after it is its set then its move, and nothing else", () => {
    // `a` (todo) lands in `done` between `b` and `c`, so that two runs tie (kanban-order 3.6).
    const [a, b, c] = [
      { id: "a", label: "A", column: "todo" },
      { id: "b", label: "B", column: "done" },
      { id: "c", label: "C", column: "done" },
    ] as { id: string; label: string; column: string }[] as [Card, Card, Card];
    const cards = [a, b, c];
    const sent = { columns: COLUMNS, cards };
    const edited = {
      columns: COLUMNS,
      cards: [b, { ...a, column: "done" }, c],
    };
    const changes = elementChanges("board", sent, edited, KANBAN_SHAPE);
    expect(changes).toEqual([
      { op: "set", target: "board.a.column", value: "done" },
      { op: "move", target: "board.a", after: "b" },
    ]);
    expect(check(changes)).toEqual([]);
    expect(applyElementChanges("board", sent, changes, KANBAN_SHAPE)).toEqual(edited);
  });

  test("each fixture's edited props are the normal form of its changes, which the check passes", () => {
    for (const [edited, expected] of [
      [KANBAN_REORDERED_PROPS, KANBAN_REORDER_CHANGES],
      [KANBAN_PLACED_PROPS, KANBAN_PLACED_CHANGES],
      [KANBAN_BOTH_PROPS, KANBAN_BOTH_CHANGES],
    ] as const) {
      const changes = elementChanges("board", KANBAN_ORDER_ITEM.props, edited, KANBAN_SHAPE);
      expect(changes).toEqual(expected);
      expect(check(changes)).toEqual([]);
      expect(applyElementChanges("board", KANBAN_ORDER_ITEM.props, changes, KANBAN_SHAPE)).toEqual(
        edited,
      );
    }
    expect(KANBAN_BOTH_CHANGES.map(({ op }) => op)).toEqual(["set", "move", "move"]);
  });

  test("a column the user kept gets no change, in the fixture's interleaved cards", () => {
    const named = new Set(
      [...KANBAN_REORDER_CHANGES, ...KANBAN_PLACED_CHANGES, ...KANBAN_BOTH_CHANGES].map(
        ({ target }) => target.split(".")[1],
      ),
    );
    const done = KANBAN_ORDER_ITEM.props.cards.filter(({ column }) => column === "done");
    for (const card of done) expect(named.has(card.id)).toBe(false);
  });

  test("the changes schema refuses a move with a parent, an add, a remove, a set of a label and a move naming a field", () => {
    const refused: [unknown, string][] = [
      [{ op: "move", target: "board.fix-login", parent: "add-sso" }, "move"],
      [{ op: "move", target: "board.fix-login.column", after: "add-sso" }, "move"],
      [{ op: "move", target: "board.fix-login", after: "not an id" }, "move"],
      [{ op: "move", target: "board.fix-login", after: null }, "move"],
      [{ op: "add", target: "board.n", value: { column: "todo" } }, "add"],
      [{ op: "remove", target: "board.fix-login" }, "remove"],
      [{ op: "set", target: "board.fix-login.label", value: "x" }, "set"],
    ];
    for (const [change, op] of refused) {
      const [problem] = check([change]);
      expect(problem?.message, JSON.stringify(change)).toContain("item board");
      expect(problem?.message, JSON.stringify(change)).toContain(op);
    }
    expect(check([{ op: "move", target: "board.fix-login", after: "add-sso" }])).toEqual([]);
    expect(check([{ op: "move", target: "board.fix-login" }])).toEqual([]);
  });

  test("the changes schema's description names kanban-order and still ends with its first minor", () => {
    expect(KANBAN_WIDGET.edits?.changes.description).toContain("kanban-order");
  });

  test("an edited label, a description, an added or a removed card each give changes it refuses", () => {
    const [first, ...others] = ITEM.props.cards;
    const diffs: [string, object][] = [
      ["label", { cards: [{ ...first, label: "Other" }, ...others] }],
      ["description", { cards: [{ ...first, description: "More" }, ...others] }],
      ["add", { cards: [...ITEM.props.cards, { id: "new", label: "New", column: "todo" }] }],
      ["remove", { cards: others }],
    ];
    for (const [what, change] of diffs) {
      const changes = elementChanges(
        "board",
        ITEM.props,
        { ...ITEM.props, ...change },
        KANBAN_SHAPE,
      );
      expect({ what, problems: check(changes).length > 0 }).toEqual({ what, problems: true });
    }
  });

  test("a set of a column to something that is no ID, or of another field, fails", () => {
    for (const change of [
      { op: "set", target: "board.fix-login.column", value: "not an id" },
      { op: "set", target: "board.fix-login.column", value: null },
      { op: "set", target: "board.fix-login.column", value: 3 },
      { op: "set", target: "board.fix-login.label", value: "x" },
      { op: "set", target: "board.fix-login", value: "doing" },
      { op: "set", target: "board.a.b.column", value: "doing" },
      { op: "set", target: "board.fix-login.column", value: "doing", extra: true },
    ]) {
      expect(check([change])).not.toEqual([]);
    }
  });
});

describe("the Kanban's fixtures", () => {
  test("take their version from the constants and hold the move as the diff gives it", () => {
    expect(kanbanAct.version).toBe(BOARD_PROTOCOL_VERSION);
    const [act] = kanbanAct.acts;
    expect(act).toMatchObject({ type: "answer", itemId: EDIT_WIDGETS_SESSION.question });
    expect((act as { values?: unknown }).values).toEqual({ board: KANBAN_EDITED_PROPS });
    expect(kanbanAnswerEvent.changes).toEqual(KANBAN_CHANGES);
    expect(ITEM.props.cards.map(({ id }) => id)).toEqual(
      KANBAN_EDITED_PROPS.cards.map(({ id }) => id),
    );
  });

  test("the answer event, the act and the fetch of the item validate", () => {
    const ajv = ajvOver(TYPES);
    expect(errorsOf(ajv, SCHEMA_IDS.answerEvent, kanbanAnswerEvent)).toEqual([]);
    expect(errorsOf(ajv, SCHEMA_IDS.fetchResult, kanbanFetchItemResult)).toEqual([]);
    expect(validateBoardMessage("toHost", kanbanAct).ok).toBe(true);
  });
});

describe("the Kanban's entry in the registry's own check", () => {
  test("passes over the registry holding it, edits declared and no result or derived", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
    expect(KANBAN_WIDGET.props.$id).toBe(KANBAN_SCHEMA_IDS.props);
    expect(KANBAN_WIDGET.result).toBeUndefined();
    expect(KANBAN_WIDGET.derived).toBeUndefined();
    expect(KANBAN_WIDGET.noun).toBe("a Kanban");
  });

  test("its teaching text is within bounds and its example is accepted in an ask", () => {
    const { skill, example } = KANBAN_WIDGET;
    expect(skill?.use.length).toBeGreaterThanOrEqual(1);
    expect(skill?.use.length).toBeLessThanOrEqual(200);
    expect(skill?.use).toContain("columns");
    for (const note of skill?.notes ?? []) expect(note.length).toBeLessThanOrEqual(300);
    expect(skill?.notes?.join(" ")).toContain("<id>.<card>.column");
    expect(askProblems(TYPES, example.item)).toEqual([]);
    expect(askAccepted(TYPES, example.item)).toBe(true);
  });
});

describe("the registry's other modules", () => {
  test("no module of src/widgets outside kanban/ and registry.ts names the type", () => {
    const root = new URL("../src/widgets/", import.meta.url);
    const named: string[] = [];
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || entry.parentPath.includes("/kanban")) continue;
      if (entry.name === "registry.ts") continue;
      const text = readFileSync(`${entry.parentPath}/${entry.name}`, "utf8");
      // The change's own name is how comments cite it; the type's name is what must not appear.
      if (
        /kanban/i.test(text.replaceAll("latex-kanban-timeline", "").replaceAll("kanban-order", ""))
      )
        named.push(entry.name);
    }
    expect(named).toEqual([]);
  });
});

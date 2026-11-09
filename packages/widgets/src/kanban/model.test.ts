// The Kanban's model (latex-kanban-timeline, task 4.2; view-and-widgets spec: Kanban columns and
// cards, Kanban moves by drag, Kanban at the keyboard; design decision 9): the columns with their
// cards, a card's move, the value the draft holds, the moved cards and the arrow keys.

import { describe, expect, test } from "bun:test";
import {
  applyElementChanges,
  elementChanges,
  KANBAN_SHAPE,
  KANBAN_WIDGET,
  type KanbanProps,
  widgetChangesProblems,
} from "@askboard/contract";
import { KANBAN_FIXTURE_ITEM, withWidgetTypes } from "@askboard/contract/fixtures";
import { widgetItemProblems } from "@askboard/contract/validate";
import { generator } from "../../test/tree-model.ts";
import { columnsOf, firstCard, movedOf, moveTo, neighbour, valueFor } from "./model.ts";

const TYPES = withWidgetTypes(KANBAN_WIDGET);
const ITEM = { type: "kanban", id: "board" } as const;

// The spec's scenario: `a` and `c` in `todo`, `b` in `done`, `doing` empty.
const SENT: KanbanProps = {
  columns: [
    { id: "todo", label: "To do" },
    { id: "doing", label: "Doing" },
    { id: "done", label: "Done" },
  ],
  cards: [
    { id: "a", label: "A", column: "todo" },
    { id: "b", label: "B", description: "Second", column: "done" },
    { id: "c", label: "C", column: "todo" },
  ],
};

const idsIn = (props: KanbanProps, column: string) =>
  columnsOf(props)
    .find(({ id }) => id === column)
    ?.cards.map(({ id }) => id);

/** The problems of a value as an edited Kanban and of its diff against `sent`, and the diff. */
const checked = (sent: KanbanProps, value: KanbanProps) => {
  const changes = elementChanges("board", sent, value, KANBAN_SHAPE);
  return {
    value: widgetItemProblems({ ...ITEM, props: value }, {}, "edited", TYPES),
    changes: widgetChangesProblems(ITEM, changes, TYPES),
    list: changes,
  };
};

describe("columnsOf", () => {
  test("lists the columns in the agent's order, each with its cards in the order of `cards`", () => {
    const columns = columnsOf(SENT);
    expect(columns.map(({ id, label }) => [id, label])).toEqual([
      ["todo", "To do"],
      ["doing", "Doing"],
      ["done", "Done"],
    ]);
    expect(columns.map(({ cards }) => cards.map(({ id }) => id))).toEqual([["a", "c"], [], ["b"]]);
    expect(columns.map(({ cards }) => cards.length)).toEqual([2, 0, 1]);
  });

  test("hands each card as the agent sent it, its description included", () => {
    expect(columnsOf(SENT)[2]?.cards[0]).toBe(SENT.cards[1]);
  });

  test("leaves a card that names no column out of every column", () => {
    const props = { ...SENT, cards: [...SENT.cards, { id: "x", label: "X", column: "gone" }] };
    expect(columnsOf(props).flatMap(({ cards }) => cards.map(({ id }) => id))).toEqual([
      "a",
      "c",
      "b",
    ]);
  });
});

describe("moveTo", () => {
  test("changes the card's column and nothing else, leaving the other cards as they were", () => {
    const moved = moveTo(SENT, "a", "doing");
    expect(moved.cards.map(({ id, column }) => [id, column])).toEqual([
      ["a", "doing"],
      ["b", "done"],
      ["c", "todo"],
    ]);
    expect(moved.cards[1]).toBe(SENT.cards[1]);
    expect(moved.cards[2]).toBe(SENT.cards[2]);
    expect(moved.columns).toBe(SENT.columns);
    expect(idsIn(moved, "doing")).toEqual(["a"]);
    expect(idsIn(moved, "todo")).toEqual(["c"]);
  });

  test("keeps every card at its index in `cards`, so that a diff holds no `move`", () => {
    const moved = moveTo(moveTo(SENT, "c", "done"), "a", "done");
    expect(moved.cards.map(({ id }) => id)).toEqual(SENT.cards.map(({ id }) => id));
    const { list } = checked(SENT, moved);
    expect(list.map(({ op }) => op)).toEqual(["set", "set"]);
    expect(list).toEqual([
      { op: "set", target: "board.a.column", value: "done" },
      { op: "set", target: "board.c.column", value: "done" },
    ]);
  });

  test("gives a value that the contract takes, one `set` of `.column` for one move", () => {
    const moved = moveTo(KANBAN_FIXTURE_ITEM.props, "fix-login", "doing");
    const result = checked(KANBAN_FIXTURE_ITEM.props, moved);
    expect(result.value).toEqual([]);
    expect(result.changes).toEqual([]);
    expect(result.list).toEqual([{ op: "set", target: "board.fix-login.column", value: "doing" }]);
  });

  test("its inverse is the sent value again, and the draft holds no value for it", () => {
    const there = moveTo(SENT, "a", "doing");
    const back = moveTo(there, "a", "todo");
    expect(back).toEqual(SENT);
    expect(valueFor(SENT, back)).toBeUndefined();
    expect(checked(SENT, back).list).toEqual([]);
  });

  test("is the same value, by identity, when the card is already there", () => {
    expect(moveTo(SENT, "a", "todo")).toBe(SENT);
  });

  test.each([
    ["a card the item does not hold", "zz", "doing"],
    ["a column the item does not hold", "a", "gone"],
    ["a column that is a card's ID", "a", "b"],
    ["an inherited name", "a", "constructor"],
  ])("is the same value, by identity, for %s", (_name, card, column) => {
    expect(moveTo(SENT, card, column)).toBe(SENT);
  });

  test("gives a frozen value and leaves its input, even a frozen one, untouched", () => {
    const sent = Object.freeze({
      ...SENT,
      cards: Object.freeze(SENT.cards.map((card) => Object.freeze({ ...card }))),
    });
    const before = JSON.stringify(sent);
    const moved = moveTo(sent, "b", "doing");
    expect(JSON.stringify(sent)).toBe(before);
    expect(Object.isFrozen(moved)).toBe(true);
    expect(Object.isFrozen(moved.cards)).toBe(true);
    expect(Object.isFrozen(moved.cards[1])).toBe(true);
  });
});

describe("valueFor", () => {
  test("is the edited props, or nothing while every card is in the column it was sent in", () => {
    const moved = moveTo(SENT, "a", "doing");
    expect(valueFor(SENT, moved)).toEqual(moved);
    expect(valueFor(SENT, SENT)).toBeUndefined();
    expect(valueFor(SENT, structuredClone(SENT))).toBeUndefined();
  });
});

describe("movedOf", () => {
  test("names the cards that are in another column than they were sent in, in `cards` order", () => {
    expect(movedOf(SENT, SENT)).toEqual([]);
    const moved = moveTo(moveTo(moveTo(SENT, "c", "doing"), "a", "done"), "b", "todo");
    expect(movedOf(SENT, moved)).toEqual(["a", "b", "c"]);
    expect(movedOf(SENT, moveTo(SENT, "c", "doing"))).toEqual(["c"]);
  });

  test("counts a card moved and moved back as not moved", () => {
    expect(movedOf(SENT, moveTo(moveTo(SENT, "a", "done"), "a", "todo"))).toEqual([]);
  });
});

describe("neighbour", () => {
  const columns = () => columnsOf(SENT);

  test.each([
    ["a", "down", "c"],
    ["a", "up", "a"],
    ["c", "up", "a"],
    ["c", "down", "c"],
    ["a", "right", "b"],
    ["c", "right", "b"],
    ["b", "left", "a"],
    ["b", "right", "b"],
    ["a", "left", "a"],
  ] as const)("from %s, %s reaches %s (no card in `doing`)", (current, key, reached) => {
    expect(neighbour(columns(), current, key)).toBe(reached);
  });

  test("stops at an edge with no card beyond it, whatever lies between", () => {
    const edge = columnsOf(moveTo(moveTo(SENT, "b", "todo"), "c", "todo"));
    // Every card now in `todo`: the columns to its right are empty.
    expect(neighbour(edge, "a", "right")).toBe("a");
    expect(neighbour(edge, "c", "right")).toBe("c");
    expect(neighbour(edge, "b", "down")).toBe("c");
  });

  test("lands on the card at the same height, or the last one of a shorter column", () => {
    const tall = columnsOf({
      columns: SENT.columns,
      cards: [
        { id: "t0", label: "", column: "todo" },
        { id: "t1", label: "", column: "todo" },
        { id: "t2", label: "", column: "todo" },
        { id: "d0", label: "", column: "doing" },
        { id: "n0", label: "", column: "done" },
        { id: "n1", label: "", column: "done" },
      ],
    });
    expect(neighbour(tall, "t1", "right")).toBe("d0");
    expect(neighbour(tall, "t2", "right")).toBe("d0");
    expect(neighbour(tall, "d0", "right")).toBe("n0");
    expect(neighbour(tall, "n1", "left")).toBe("d0");
    expect(neighbour(tall, "d0", "left")).toBe("t0");
  });

  test("names no card for a current card the columns do not hold", () => {
    expect(neighbour(columns(), "zz", "down")).toBeUndefined();
  });
});

describe("firstCard", () => {
  test("is the first card of the first column that holds one", () => {
    expect(firstCard(columnsOf(SENT))).toBe("a");
    const moved = moveTo(moveTo(SENT, "a", "doing"), "c", "doing");
    expect(firstCard(columnsOf(moved))).toBe("a");
    expect(firstCard(columnsOf({ columns: SENT.columns, cards: [] }))).toBeUndefined();
  });
});

describe("any sequence of moves", () => {
  const kanbanOf = (random: ReturnType<typeof generator>): KanbanProps => {
    const columns = Array.from({ length: 2 + random.int(5) }, (_, at) => ({
      id: `c${at}`,
      label: `Column ${at}`,
    }));
    const cards = Array.from({ length: 1 + random.int(15) }, (_, at) => ({
      id: `k${at}`,
      label: `Card ${at}`,
      ...(random.int(2) === 0 ? { description: `About ${at}` } : {}),
      column: random.pick(columns).id,
    }));
    return { columns, cards };
  };

  test("500 seeded sequences stay valid, diff to `set`s of `.column` only, and round-trip", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const random = generator(seed);
      const sent = kanbanOf(random);
      expect({ seed, problems: checked(sent, sent).value }).toEqual({ seed, problems: [] });
      let value = sent;
      for (let step = 0; step < 30; step++) {
        const card = random.pick(sent.cards).id;
        const column = random.pick(sent.columns).id;
        value = moveTo(value, card, column);
        const { value: valueProblems, changes: changesProblems, list } = checked(sent, value);
        const where = { seed, step };
        expect({ ...where, valueProblems }).toEqual({ ...where, valueProblems: [] });
        expect({ ...where, changesProblems }).toEqual({ ...where, changesProblems: [] });
        expect({ ...where, ops: list.filter(({ op }) => op !== "set") }).toEqual({
          ...where,
          ops: [],
        });
        expect(value.cards.map(({ id }) => id)).toEqual(sent.cards.map(({ id }) => id));
        expect(applyElementChanges("board", sent, list, KANBAN_SHAPE)).toEqual(value);
        const moved = movedOf(sent, value);
        expect({ ...where, moved: moved.length }).toEqual({ ...where, moved: list.length });
        expect({ ...where, kept: valueFor(sent, value) === undefined }).toEqual({
          ...where,
          kept: list.length === 0,
        });
      }
    }
  });
});

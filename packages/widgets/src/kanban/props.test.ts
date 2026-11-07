import { describe, expect, test } from "bun:test";
import type { KanbanProps } from "@askboard/contract";
import { KANBAN_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { checkedKanbanProps, shownProps, valueFits } from "./props.ts";

// The Kanban checks its props as an agent's before it shows (view-and-widgets spec: Kanban columns
// and cards; design decision 9): the shape the view's unchecked props might lack, then the
// contract's own check; a problem throws, naming the item, and the item's error boundary fails it
// (AD-10). The draft's value is shown only while it is a Kanban of the same kind.
const SENT = KANBAN_FIXTURE_ITEM.props;
const columns = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
];
const cards = [{ id: "x", label: "X", column: "a" }];

describe("checkedKanbanProps", () => {
  test("props of 2 to 12 columns and 1 to 200 cards come back as they were", () => {
    expect(checkedKanbanProps("board", SENT)).toBe(SENT);
  });

  test("props that are no object, or hold no list of columns or cards, throw, naming the item", () => {
    for (const props of [
      undefined,
      null,
      [],
      "x",
      {},
      { columns },
      { cards },
      { columns: "a", cards },
      { columns, cards: null },
    ]) {
      expect(() => checkedKanbanProps("board", props)).toThrow(
        'the Kanban "board" refuses its props',
      );
    }
  });

  test("a count outside the limits throws", () => {
    expect(() => checkedKanbanProps("board", { columns: columns.slice(0, 1), cards })).toThrow(
      "2 to 12 columns",
    );
    expect(() => checkedKanbanProps("board", { columns, cards: [] })).toThrow("1 to 200 cards");
    const many = Array.from({ length: 13 }, (_, at) => ({ id: `c${at}`, label: "C" }));
    expect(() => checkedKanbanProps("board", { columns: many, cards })).toThrow("2 to 12 columns");
  });

  test("a column or card with no string ID, label or column, or a description of the wrong type, throws", () => {
    const bad = [
      { columns: [{ label: "A" }, columns[1]], cards },
      { columns: [{ id: 1, label: "A" }, columns[1]], cards },
      { columns: [{ id: "a" }, columns[1]], cards },
      { columns, cards: [{ id: "x", label: "X" }] },
      { columns, cards: [{ id: "x", column: "a" }] },
      { columns, cards: [{ label: "X", column: "a" }] },
      { columns, cards: [{ ...cards[0], description: 3 }] },
      { columns, cards: [null] },
    ];
    for (const props of bad) {
      expect(() => checkedKanbanProps("board", props)).toThrow("refuses its props");
    }
  });

  test("the contract's own check runs after the shape: an ID held twice, a card in no column", () => {
    expect(() =>
      checkedKanbanProps("board", { columns, cards: [{ id: "a", label: "X", column: "a" }] }),
    ).toThrow("held twice");
    expect(() =>
      checkedKanbanProps("board", { columns, cards: [{ id: "x", label: "X", column: "zz" }] }),
    ).toThrow('card "x" names the column "zz"');
  });
});

describe("shownProps", () => {
  const moved: KanbanProps = {
    ...SENT,
    cards: SENT.cards.map((card) =>
      card.id === "fix-login" ? { ...card, column: "doing" } : card,
    ),
  };

  test("is the draft's value while it is a Kanban, else the agent's", () => {
    expect(shownProps("board", SENT, moved)).toBe(moved);
    expect(shownProps("board", SENT, undefined)).toBe(SENT);
  });

  test("falls back to the agent's props for a value that is no Kanban or holds other cards", () => {
    for (const value of [
      null,
      "x",
      {},
      { ...moved, cards: [] },
      { ...moved, cards: [{ id: "zz", label: "Z", column: "todo" }] },
      { ...moved, columns: SENT.columns.slice(0, 2) },
      { ...moved, cards: moved.cards.map((card) => ({ ...card, label: "changed" })) },
    ]) {
      expect(shownProps("board", SENT, value)).toBe(SENT);
    }
  });
});

// One predicate for "this value fits the shown revision" (security review X-2): the component's
// `shownProps` and the shell's drops of a held value (the fact it registers) both ask it.
describe("valueFits", () => {
  const moved: KanbanProps = {
    ...SENT,
    cards: SENT.cards.map((card) =>
      card.id === "fix-login" ? { ...card, column: "doing" } : card,
    ),
  };

  test("is true for the agent's Kanban with cards moved, and for the agent's own", () => {
    expect(valueFits(moved, SENT)).toBe(true);
    expect(valueFits(SENT, SENT)).toBe(true);
  });

  test("is false for a value of another Kanban: other cards, labels, columns, or no Kanban at all", () => {
    const relabelled = SENT.cards.map((card, at) =>
      at === 0 ? { ...card, label: "Fix login, again" } : card,
    );
    for (const value of [
      undefined,
      null,
      "x",
      {},
      { ...moved, cards: relabelled },
      { ...moved, cards: moved.cards.slice(1) },
      { ...moved, columns: SENT.columns.slice(0, 2) },
    ]) {
      expect(valueFits(value, SENT)).toBe(false);
    }
  });

  test("is false against props that are no Kanban, and agrees with what shownProps shows", () => {
    expect(valueFits(moved, { columns: [], cards: [] })).toBe(false);
    expect(valueFits(moved, undefined)).toBe(false);
    expect(shownProps("board", SENT, moved) === moved).toBe(valueFits(moved, SENT));
    const other = { ...moved, cards: moved.cards.slice(1) };
    expect(shownProps("board", SENT, other) === other).toBe(valueFits(other, SENT));
  });
});

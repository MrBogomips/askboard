// The Kanban's order in the model (kanban-order, task 3.1; view-and-widgets spec: Kanban order in
// the draft, A Kanban value fits a revision; design decisions 4 and 7): every edit gives a value in
// the normal form its changes rebuild (`arranged`), a card is placed at a slot of a column
// (`placeIn`, and "Move up", "Move down", "To top" and "To bottom" through it), the draft holds
// nothing once everything is back, and the cards the board marks are the cards the answer reports.

import { describe, expect, test } from "bun:test";
import {
  applyElementChanges,
  elementChanges,
  KANBAN_SHAPE,
  KANBAN_WIDGET,
  type KanbanProps,
  widgetChangesProblems,
} from "@askboard/contract";
import {
  KANBAN_BOTH_CHANGES,
  KANBAN_BOTH_PROPS,
  KANBAN_ORDER_ITEM,
  KANBAN_REORDER_CHANGES,
  KANBAN_REORDERED_PROPS,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { widgetItemProblems } from "@askboard/contract/validate";
import { generator } from "../../test/tree-model.ts";
import * as model from "./model.ts";
import { valueFits } from "./props.ts";

const TYPES = withWidgetTypes(KANBAN_WIDGET);
const ITEM = { type: "kanban", id: "board" } as const;

// `todo` holds fix-login, add-sso, audit; `doing` write-docs, review; `done` release-notes; the
// cards interleave in the list, as an agent sends them.
const SENT = KANBAN_ORDER_ITEM.props;

const idsIn = (props: KanbanProps, column: string) =>
  model
    .columnsOf(props)
    .find(({ id }) => id === column)
    ?.cards.map(({ id }) => id);

const changesOf = (sent: KanbanProps, value: KanbanProps) =>
  elementChanges("board", sent, value, KANBAN_SHAPE);

describe("arranged", () => {
  test("gives a value its own changes rebuild, from a list in any interleaving", () => {
    // Both `todo` and `doing` reversed, the flat list reversed too: not a value the changes rebuild.
    const raw: KanbanProps = {
      columns: SENT.columns,
      cards: [...SENT.cards].reverse(),
    };
    expect(model.arranged(SENT, raw)).not.toEqual(raw);
    const arranged = model.arranged(SENT, raw);
    expect(applyElementChanges("board", SENT, changesOf(SENT, raw), KANBAN_SHAPE)).toEqual(
      arranged,
    );
    expect(idsIn(arranged, "todo")).toEqual(["audit", "add-sso", "fix-login"]);
    expect(idsIn(arranged, "doing")).toEqual(["review", "write-docs"]);
    expect(idsIn(arranged, "done")).toEqual(["release-notes"]);
  });

  test("is idempotent, and the diff of the value it gives is the diff of the list it came from", () => {
    const raw: KanbanProps = { columns: SENT.columns, cards: [...SENT.cards].reverse() };
    const once = model.arranged(SENT, raw);
    expect(model.arranged(SENT, once)).toEqual(once);
    expect(changesOf(SENT, once)).toEqual(changesOf(SENT, raw));
  });

  test("leaves a value its changes already rebuild as it is", () => {
    expect(model.arranged(SENT, KANBAN_REORDERED_PROPS)).toEqual(KANBAN_REORDERED_PROPS);
    expect(model.arranged(SENT, KANBAN_BOTH_PROPS)).toEqual(KANBAN_BOTH_PROPS);
    expect(model.arranged(SENT, SENT)).toEqual(SENT);
  });

  test("is a frozen value and leaves its inputs untouched", () => {
    const before = JSON.stringify([SENT, KANBAN_REORDERED_PROPS]);
    const arranged = model.arranged(SENT, KANBAN_REORDERED_PROPS);
    expect(JSON.stringify([SENT, KANBAN_REORDERED_PROPS])).toBe(before);
    expect(Object.isFrozen(arranged)).toBe(true);
    expect(Object.isFrozen(arranged.cards)).toBe(true);
  });
});

describe("placeIn", () => {
  test("puts a card at each slot of its own column, the slot counting the column's other cards", () => {
    const at = (slot: number) => idsIn(model.placeIn(SENT, "audit", "todo", slot), "todo");
    expect(at(0)).toEqual(["audit", "fix-login", "add-sso"]);
    expect(at(1)).toEqual(["fix-login", "audit", "add-sso"]);
    expect(at(2)).toEqual(["fix-login", "add-sso", "audit"]);
    const first = (slot: number) => idsIn(model.placeIn(SENT, "fix-login", "todo", slot), "todo");
    expect(first(0)).toEqual(["fix-login", "add-sso", "audit"]);
    expect(first(1)).toEqual(["add-sso", "fix-login", "audit"]);
    expect(first(2)).toEqual(["add-sso", "audit", "fix-login"]);
  });

  test("puts a card in another column at each slot, the card taking that column", () => {
    const at = (slot: number) => model.placeIn(SENT, "add-sso", "doing", slot);
    expect(idsIn(at(0), "doing")).toEqual(["add-sso", "write-docs", "review"]);
    expect(idsIn(at(1), "doing")).toEqual(["write-docs", "add-sso", "review"]);
    expect(idsIn(at(2), "doing")).toEqual(["write-docs", "review", "add-sso"]);
    expect(idsIn(at(1), "todo")).toEqual(["fix-login", "audit"]);
    expect(at(1).cards.find(({ id }) => id === "add-sso")?.column).toBe("doing");
  });

  test("into a column that holds no card, the card keeps its index in `cards`, as moveTo does", () => {
    const empty: KanbanProps = {
      columns: [...SENT.columns, { id: "later", label: "Later" }],
      cards: SENT.cards,
    };
    const placed = model.placeIn(empty, "audit", "later", 0);
    expect(idsIn(placed, "later")).toEqual(["audit"]);
    expect(placed).toEqual(moveToOf(empty, "audit", "later"));
  });

  test("clamps a slot past the column's cards to the bottom and below zero to the top", () => {
    expect(idsIn(model.placeIn(SENT, "add-sso", "doing", 99), "doing")).toEqual([
      "write-docs",
      "review",
      "add-sso",
    ]);
    expect(idsIn(model.placeIn(SENT, "add-sso", "doing", -3), "doing")).toEqual([
      "add-sso",
      "write-docs",
      "review",
    ]);
  });

  test("is the same props, by identity, where the card already is, and for a card or column the item lacks", () => {
    expect(model.placeIn(SENT, "add-sso", "todo", 1)).toBe(SENT);
    expect(model.placeIn(SENT, "zz", "todo", 0)).toBe(SENT);
    expect(model.placeIn(SENT, "add-sso", "gone", 0)).toBe(SENT);
    expect(model.placeIn(SENT, "add-sso", "constructor", 0)).toBe(SENT);
  });

  test("gives a frozen value and leaves its input, even a frozen one, untouched", () => {
    const sent = Object.freeze({
      ...SENT,
      cards: Object.freeze(SENT.cards.map((card) => Object.freeze({ ...card }))),
    });
    const before = JSON.stringify(sent);
    const placed = model.placeIn(sent, "add-sso", "doing", 0);
    expect(JSON.stringify(sent)).toBe(before);
    expect(Object.isFrozen(placed)).toBe(true);
    expect(Object.isFrozen(placed.cards)).toBe(true);
  });
});

// moveTo through the module's namespace, so that a file written before the order existed names it.
const moveToOf = (props: KanbanProps, card: string, column: string) =>
  model.moveTo(props, card, column);

describe("moveWithin", () => {
  test("Move up and Move down put the card one place up or down in its column", () => {
    expect(idsIn(model.moveWithin(SENT, "add-sso", "up"), "todo")).toEqual([
      "add-sso",
      "fix-login",
      "audit",
    ]);
    expect(idsIn(model.moveWithin(SENT, "add-sso", "down"), "todo")).toEqual([
      "fix-login",
      "audit",
      "add-sso",
    ]);
  });

  test("To top and To bottom put it first and last in its column", () => {
    expect(idsIn(model.moveWithin(SENT, "audit", "top"), "todo")).toEqual([
      "audit",
      "fix-login",
      "add-sso",
    ]);
    expect(idsIn(model.moveWithin(SENT, "fix-login", "bottom"), "todo")).toEqual([
      "add-sso",
      "audit",
      "fix-login",
    ]);
  });

  test("at an edge, a move that cannot act gives the same props", () => {
    expect(model.moveWithin(SENT, "fix-login", "up")).toBe(SENT);
    expect(model.moveWithin(SENT, "fix-login", "top")).toBe(SENT);
    expect(model.moveWithin(SENT, "audit", "down")).toBe(SENT);
    expect(model.moveWithin(SENT, "audit", "bottom")).toBe(SENT);
    expect(model.moveWithin(SENT, "release-notes", "top")).toBe(SENT);
    expect(model.moveWithin(SENT, "zz", "top")).toBe(SENT);
  });

  test("Move up acts on the column's own order, whatever the list holds between its cards", () => {
    // `review` is last in `doing`, with `add-sso` of `todo` between it and `write-docs` in the list.
    const up = model.moveWithin(SENT, "review", "up");
    expect(idsIn(up, "doing")).toEqual(["review", "write-docs"]);
  });
});

describe("valueFor", () => {
  test("is the arranged value of an edit, for the reorder the fixtures name", () => {
    const value = model.valueFor(SENT, model.moveWithin(SENT, "add-sso", "up"));
    expect(value).toEqual(KANBAN_REORDERED_PROPS);
    expect(changesOf(SENT, value as KanbanProps)).toEqual(KANBAN_REORDER_CHANGES);
  });

  test("is the value both edits give, with the changes the fixtures name", () => {
    const placed = model.placeIn(SENT, "audit", "doing", 1);
    const both = model.valueFor(SENT, model.moveWithin(placed, "add-sso", "top"));
    expect(both).toEqual(KANBAN_BOTH_PROPS);
    expect(changesOf(SENT, both as KanbanProps)).toEqual(KANBAN_BOTH_CHANGES);
  });

  test("is nothing once every card is back, in its own column or another", () => {
    const up = model.moveWithin(SENT, "add-sso", "up");
    const arranged = model.valueFor(SENT, up) as KanbanProps;
    expect(model.valueFor(SENT, model.moveWithin(arranged, "add-sso", "down"))).toBeUndefined();
    const there = model.valueFor(SENT, model.placeIn(SENT, "audit", "doing", 0)) as KanbanProps;
    expect(model.valueFor(SENT, model.placeIn(there, "audit", "todo", 2))).toBeUndefined();
    expect(model.valueFor(SENT, SENT)).toBeUndefined();
    expect(model.valueFor(SENT, structuredClone(SENT))).toBeUndefined();
  });

  test("a card moved to another column at the place the agent's order gives is one `set`, as Move to… does", () => {
    const value = model.valueFor(SENT, model.moveTo(SENT, "audit", "done")) as KanbanProps;
    expect(changesOf(SENT, value)).toEqual([
      { op: "set", target: "board.audit.column", value: "done" },
    ]);
  });
});

describe("movedOf", () => {
  test("names the cards the changes name: a `move` and a `set`, each once", () => {
    expect(model.movedOf(SENT, SENT)).toEqual([]);
    expect(model.movedOf(SENT, KANBAN_REORDERED_PROPS)).toEqual(["add-sso"]);
    expect([...model.movedOf(SENT, KANBAN_BOTH_PROPS)].sort()).toEqual(["add-sso", "audit"]);
  });

  test("a card moved to another column at its sent place is one; a card moved back is none", () => {
    const set = model.valueFor(SENT, model.moveTo(SENT, "audit", "done")) as KanbanProps;
    expect(model.movedOf(SENT, set)).toEqual(["audit"]);
    expect(model.movedOf(SENT, model.arranged(SENT, SENT))).toEqual([]);
  });

  test("after a swap of two neighbours it names one card, the one the answer reports", () => {
    const swapped = model.valueFor(
      SENT,
      model.moveWithin(SENT, "fix-login", "down"),
    ) as KanbanProps;
    expect(idsIn(swapped, "todo")).toEqual(["add-sso", "fix-login", "audit"]);
    expect(model.movedOf(SENT, swapped)).toHaveLength(1);
    expect(model.movedOf(SENT, swapped)).toEqual(
      changesOf(SENT, swapped).map(({ target }) => String(target.split(".")[1])),
    );
  });
});

describe("any sequence of order edits", () => {
  const kanbanOf = (random: ReturnType<typeof generator>): KanbanProps => {
    const columns = Array.from({ length: 2 + random.int(4) }, (_, at) => ({
      id: `c${at}`,
      label: `Column ${at}`,
    }));
    const cards = Array.from({ length: 1 + random.int(14) }, (_, at) => ({
      id: `k${at}`,
      label: `Card ${at}`,
      ...(random.int(2) === 0 ? { description: `About ${at}` } : {}),
      column: random.pick(columns).id,
    }));
    return { columns, cards };
  };

  const edit = (random: ReturnType<typeof generator>, sent: KanbanProps, shown: KanbanProps) => {
    const card = random.pick(sent.cards).id;
    const kind = random.int(4);
    if (kind === 0) return model.moveTo(shown, card, random.pick(sent.columns).id);
    if (kind === 1) {
      const column = random.pick(sent.columns).id;
      const others = (idsIn(shown, column) ?? []).filter((id) => id !== card).length;
      return model.placeIn(shown, card, column, random.int(others + 1));
    }
    return model.moveWithin(shown, card, random.pick(["up", "down", "top", "bottom"] as const));
  };

  test("300 seeded sequences stay in the form the contract takes and rebuilds, and report their changes", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const random = generator(seed);
      const sent = kanbanOf(random);
      let shown = sent;
      for (let step = 0; step < 20; step++) {
        const value = model.valueFor(sent, edit(random, sent, shown));
        const where = { seed, step };
        const list = changesOf(sent, value ?? sent);
        expect({ ...where, kept: value === undefined }).toEqual({
          ...where,
          kept: list.length === 0,
        });
        if (value !== undefined) {
          expect({
            ...where,
            value: widgetItemProblems({ ...ITEM, props: value }, {}, "edited", TYPES),
            changes: widgetChangesProblems(ITEM, list, TYPES),
          }).toEqual({ ...where, value: [], changes: [] });
          expect(applyElementChanges("board", sent, list, KANBAN_SHAPE)).toEqual(value);
          expect(model.arranged(sent, value)).toEqual(value);
          expect(
            list.every(
              ({ op, target }) => op === "move" || (op === "set" && target.endsWith(".column")),
            ),
          ).toBe(true);
          const named = new Set(list.map(({ target }) => String(target.split(".")[1])));
          expect(new Set(model.movedOf(sent, value))).toEqual(named);
        }
        shown = value ?? sent;
        expect(valueFits(shown, sent)).toBe(true);
      }
    }
  });
});

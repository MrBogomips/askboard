import { describe, expect, test } from "bun:test";
import { RANKING_WIDGET, type RankingProps } from "@askboard/contract";
import { dropAt, moveBy, movedOf, orderOf } from "./model.ts";

// The Ranking's model (view-and-widgets spec: Ranking reorder, Ranking at the keyboard; design
// decision 8): the order as a list of element IDs, moved by one step or dropped before or after a
// row. Pure: a function returns the same array when nothing changes.
const props: RankingProps = {
  items: ["a", "b", "c", "d"].map((id) => ({ id, label: id.toUpperCase() })),
};
const sent = ["a", "b", "c", "d"];

const accepted = (order: readonly string[], of: RankingProps = props): boolean =>
  RANKING_WIDGET.result?.problems?.({ order }, of).length === 0;

describe("orderOf", () => {
  test("from none, the agent's order", () => {
    expect(orderOf(undefined, props)).toEqual(sent);
  });

  test("from a result, its order", () => {
    expect(orderOf({ order: ["c", "a", "d", "b"] }, props)).toEqual(["c", "a", "d", "b"]);
  });

  test("a result that does not fit the props gives the agent's order", () => {
    expect(orderOf({ order: ["a", "b"] }, props)).toEqual(sent);
    expect(orderOf({ order: ["a", "b", "c", "x"] }, props)).toEqual(sent);
    expect(orderOf({ order: ["a", "a", "c", "d"] }, props)).toEqual(sent);
    expect(orderOf({ order: "abcd" }, props)).toEqual(sent);
    expect(orderOf({}, props)).toEqual(sent);
    expect(orderOf(null, props)).toEqual(sent);
  });
});

describe("moveBy", () => {
  test("one step down and up", () => {
    expect(moveBy(sent, "b", 1)).toEqual(["a", "c", "b", "d"]);
    expect(moveBy(sent, "c", -1)).toEqual(["a", "c", "b", "d"]);
  });

  test("at both ends the order is the same array", () => {
    expect(moveBy(sent, "a", -1)).toBe(sent);
    expect(moveBy(sent, "d", 1)).toBe(sent);
  });

  test("an element not in the order changes nothing", () => {
    expect(moveBy(sent, "x", 1)).toBe(sent);
  });

  test("leaves its input untouched", () => {
    const input = Object.freeze([...sent]);
    expect(moveBy(input, "a", 1)).toEqual(["b", "a", "c", "d"]);
    expect(input).toEqual(sent);
  });
});

describe("dropAt", () => {
  test("the top half drops before the target", () => {
    expect(dropAt(sent, "c", "a", 0.2)).toEqual(["c", "a", "b", "d"]);
    expect(dropAt(sent, "a", "d", 0.4)).toEqual(["b", "c", "a", "d"]);
  });

  test("the bottom half drops after the target", () => {
    expect(dropAt(sent, "d", "a", 0.8)).toEqual(["a", "d", "b", "c"]);
    expect(dropAt(sent, "a", "d", 0.9)).toEqual(["b", "c", "d", "a"]);
  });

  test("the middle counts as the bottom half", () => {
    expect(dropAt(sent, "d", "a", 0.5)).toEqual(["a", "d", "b", "c"]);
  });

  test("a drop in place keeps the order", () => {
    expect(dropAt(sent, "b", "b", 0.2)).toBe(sent);
    expect(dropAt(sent, "b", "b", 0.8)).toBe(sent);
    expect(dropAt(sent, "b", "a", 0.8)).toBe(sent);
    expect(dropAt(sent, "b", "c", 0.2)).toBe(sent);
  });

  test("an unknown row changes nothing", () => {
    expect(dropAt(sent, "x", "a", 0.2)).toBe(sent);
    expect(dropAt(sent, "a", "x", 0.2)).toBe(sent);
  });
});

describe("movedOf", () => {
  test("untouched, none", () => {
    expect(movedOf(sent, props)).toEqual([]);
  });

  test("two moves of the first row move three rows", () => {
    const order = moveBy(moveBy(sent, "a", 1), "a", 1);
    expect(order).toEqual(["b", "c", "a", "d"]);
    expect(movedOf(order, props)).toEqual(["b", "c", "a"]);
  });

  test("a swap moves two, and a move back moves none", () => {
    expect(movedOf(["b", "a", "c", "d"], props)).toEqual(["b", "a"]);
    expect(movedOf(moveBy(moveBy(sent, "b", 1), "b", -1), props)).toEqual([]);
  });
});

describe("every order is one the contract accepts", () => {
  const orders = (order: readonly string[]): string[][] =>
    order.flatMap((id) =>
      order.flatMap((target) => [0, 0.3, 0.5, 1].map((f) => [...dropAt(order, id, target, f)])),
    );

  test("moves and drops of every row", () => {
    const seen = new Set<string>();
    for (const order of orders(sent)) {
      expect(accepted(order)).toBe(true);
      seen.add(order.join(""));
    }
    for (const id of sent) {
      expect(accepted(moveBy(sent, id, 1))).toBe(true);
      expect(accepted(moveBy(sent, id, -1))).toBe(true);
    }
    expect(seen.size).toBe(10);
  });

  test("every order a drop reaches, the moves of that row reach too", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const base: RankingProps = { items: ids.map((id) => ({ id, label: id })) };
    // The starting orders: the agent's, reversed, and a shuffle.
    for (const start of [ids, [...ids].reverse(), ["c", "f", "a", "e", "b", "d"]]) {
      for (const id of ids) {
        // Every order moving `id` by single steps reaches, up and down.
        const reached = new Set<string>([start.join("")]);
        for (const delta of [-1, 1] as const) {
          let order: readonly string[] = start;
          for (let step = 0; step < ids.length; step += 1) {
            order = moveBy(order, id, delta);
            reached.add(order.join(""));
          }
        }
        for (const target of ids) {
          for (const fraction of [0, 0.25, 0.49, 0.5, 0.75, 1]) {
            const dropped = dropAt(start, id, target, fraction);
            expect(reached.has(dropped.join(""))).toBe(true);
            expect(accepted(dropped, base)).toBe(true);
          }
        }
      }
    }
  });
});

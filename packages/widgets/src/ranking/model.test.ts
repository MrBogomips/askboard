import { describe, expect, test } from "bun:test";
import { RANKING_WIDGET, type RankingProps } from "@askboard/contract";
import { dropAt, holdsOrder, movedOf, orderOf } from "./model.ts";
import { moveRows } from "./moves.ts";

// The Ranking's model (view-and-widgets spec: Ranking reorder, Ranking at the keyboard; design
// decision 8): the order as a list of element IDs, the agent's order, a drop before or after a row
// and the moved rows; the moves are `moves.ts`'s, which build the orders here. Pure: a function
// returns the same array when nothing changes.
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
    const order = moveRows(moveRows(sent, new Set(["a"]), "down"), new Set(["a"]), "down");
    expect(order).toEqual(["b", "c", "a", "d"]);
    expect(movedOf(order, props)).toEqual(["b", "c", "a"]);
  });

  test("a swap moves two, and a move back moves none", () => {
    expect(movedOf(["b", "a", "c", "d"], props)).toEqual(["b", "a"]);
    expect(
      movedOf(moveRows(moveRows(sent, new Set(["b"]), "down"), new Set(["b"]), "up"), props),
    ).toEqual([]);
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
      expect(accepted(moveRows(sent, new Set([id]), "down"))).toBe(true);
      expect(accepted(moveRows(sent, new Set([id]), "up"))).toBe(true);
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
        for (const kind of ["up", "down"] as const) {
          let order: readonly string[] = start;
          for (let step = 0; step < ids.length; step += 1) {
            order = moveRows(order, new Set([id]), kind);
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

describe("holdsOrder", () => {
  test("is true for a result that names exactly the props' elements, the agent's order included", () => {
    expect(holdsOrder({ order: ["c", "a", "d", "b"] }, props)).toBe(true);
    expect(holdsOrder({ order: sent }, props)).toBe(true);
  });

  test("is false for none and for a result that does not fit the props", () => {
    expect(holdsOrder(undefined, props)).toBe(false);
    expect(holdsOrder({ order: ["a", "b"] }, props)).toBe(false);
    expect(holdsOrder({ order: ["a", "a", "c", "d"] }, props)).toBe(false);
    expect(holdsOrder({ order: "abcd" }, props)).toBe(false);
    expect(holdsOrder(null, props)).toBe(false);
  });
});

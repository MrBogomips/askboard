import { describe, expect, test } from "bun:test";
import { actingRows, canMove, MOVES, type MoveKind, moveRows } from "./moves.ts";

// Moving a Ranking's selection (view-and-widgets spec: Moving a Ranking's selection; design
// decision 8; the PO's answer to question 2): each selected row moves one place past its nearest
// unselected neighbour, keeping the order among the selected; rows already packed at the end stay;
// "To top" and "To bottom" gather the selection into one block, in order. A move that would move
// nothing gives the same array, which is what disables its tool.
const ROWS = ["a", "b", "c", "d", "e"];
const run = (order: readonly string[], selected: readonly string[], kind: MoveKind) =>
  moveRows(order, new Set(selected), kind);

describe("the spec's scenarios", () => {
  test("rows apart moving up", () => {
    expect(run(ROWS, ["b", "d"], "up")).toEqual(["b", "a", "d", "c", "e"]);
  });

  test("a row already at the top stays while the other moves", () => {
    expect(run(["a", "b", "c", "d"], ["a", "c"], "up")).toEqual(["a", "c", "b", "d"]);
  });

  test("to the top gathers the selection in its order, and then up and to top move nothing", () => {
    const next = run(ROWS, ["b", "d"], "top");
    expect(next).toEqual(["b", "d", "a", "c", "e"]);
    expect(canMove(next, new Set(["b", "d"]), "up")).toBe(false);
    expect(canMove(next, new Set(["b", "d"]), "top")).toBe(false);
    expect(canMove(next, new Set(["b", "d"]), "down")).toBe(true);
  });

  test("no selection: the current row alone goes to the bottom", () => {
    const rows = actingRows(["a", "b", "c", "d"], new Set(), "c");
    expect(run(["a", "b", "c", "d"], rows, "bottom")).toEqual(["a", "b", "d", "c"]);
  });
});

describe("the other moves", () => {
  test("down mirrors up", () => {
    expect(run(ROWS, ["b", "d"], "down")).toEqual(["a", "c", "b", "e", "d"]);
    expect(run(["a", "b", "c", "d"], ["b", "d"], "down")).toEqual(["a", "c", "b", "d"]);
  });

  test("a block moves past the one row above it, the row ending below the block", () => {
    expect(run(["a", "b", "c", "d"], ["c", "d"], "up")).toEqual(["a", "c", "d", "b"]);
    expect(run(["a", "b", "c", "d"], ["a", "b"], "down")).toEqual(["c", "a", "b", "d"]);
  });

  test("rows packed at the top stay while another selected row moves", () => {
    expect(run(ROWS, ["a", "b", "d"], "up")).toEqual(["a", "b", "d", "c", "e"]);
  });

  test("to the bottom gathers the selection in its order", () => {
    expect(run(ROWS, ["b", "d"], "bottom")).toEqual(["a", "c", "e", "b", "d"]);
  });

  test("a single row moves one place, or to an end", () => {
    expect(run(ROWS, ["c"], "up")).toEqual(["a", "c", "b", "d", "e"]);
    expect(run(ROWS, ["c"], "down")).toEqual(["a", "b", "d", "c", "e"]);
    expect(run(ROWS, ["c"], "top")).toEqual(["c", "a", "b", "d", "e"]);
    expect(run(ROWS, ["c"], "bottom")).toEqual(["a", "b", "d", "e", "c"]);
  });

  test("the only row of a Ranking moves nowhere", () => {
    for (const kind of MOVES) {
      expect(canMove(["a"], new Set(["a"]), kind)).toBe(false);
    }
  });

  test("every row selected moves nowhere", () => {
    for (const kind of MOVES) {
      const order = run(ROWS, ROWS, kind);
      expect(order).toBe(ROWS);
      expect(canMove(ROWS, new Set(ROWS), kind)).toBe(false);
    }
  });

  test("nothing to move: no rows, an empty order, or rows the order lacks", () => {
    for (const kind of MOVES) {
      expect(moveRows(ROWS, new Set(), kind)).toBe(ROWS);
      expect(moveRows(ROWS, new Set(["zzz"]), kind)).toBe(ROWS);
      expect(moveRows([], new Set(["a"]), kind)).toEqual([]);
      expect(canMove(ROWS, new Set(["zzz"]), kind)).toBe(false);
    }
  });

  test("a move that moves nothing gives the same array", () => {
    expect(run(ROWS, ["a"], "up")).toBe(ROWS);
    expect(run(ROWS, ["e"], "down")).toBe(ROWS);
    expect(run(ROWS, ["a", "b"], "top")).toBe(ROWS);
    expect(run(ROWS, ["d", "e"], "bottom")).toBe(ROWS);
  });

  test("never touches its input", () => {
    const order = [...ROWS];
    run(order, ["b", "d"], "up");
    expect(order).toEqual(ROWS);
  });
});

describe("actingRows", () => {
  test("the selection, in the order's order, when something is selected", () => {
    expect(actingRows(ROWS, new Set(["d", "b"]), "a")).toEqual(["b", "d"]);
  });

  test("the current row when nothing is selected", () => {
    expect(actingRows(ROWS, new Set(), "c")).toEqual(["c"]);
  });

  test("rows the order lacks do not count: a selection of only such rows is none", () => {
    expect(actingRows(ROWS, new Set(["zzz"]), "c")).toEqual(["c"]);
  });

  test("a current row the order lacks and no selection act on nothing", () => {
    expect(actingRows(ROWS, new Set(), "zzz")).toEqual([]);
  });
});

// The oracle: another way to the same answer. "Up" is one left-to-right pass of adjacent swaps (a
// selected row swaps with the unselected row right above it); "down" is the same pass from the
// right; "top" and "bottom" are stable partitions.
const oracle = (
  order: readonly string[],
  chosen: ReadonlySet<string>,
  kind: MoveKind,
): string[] => {
  const out = [...order];
  const on = (id: string | undefined): boolean => id !== undefined && chosen.has(id);
  if (kind === "up") {
    for (let at = 1; at < out.length; at++) {
      if (on(out[at]) && !on(out[at - 1]))
        [out[at - 1], out[at]] = [out[at] as string, out[at - 1] as string];
    }
    return out;
  }
  if (kind === "down") {
    for (let at = out.length - 2; at >= 0; at--) {
      if (on(out[at]) && !on(out[at + 1]))
        [out[at], out[at + 1]] = [out[at + 1] as string, out[at] as string];
    }
    return out;
  }
  const picked = order.filter((id) => chosen.has(id));
  const rest = order.filter((id) => !chosen.has(id));
  return kind === "top" ? [...picked, ...rest] : [...rest, ...picked];
};

const permutations = (items: readonly string[]): string[][] =>
  items.length <= 1
    ? [[...items]]
    : items.flatMap((item, at) =>
        permutations([...items.slice(0, at), ...items.slice(at + 1)]).map((rest) => [
          item,
          ...rest,
        ]),
      );

describe("against the brute-force oracle", () => {
  test("every order of up to 6 rows, every selection and every move", () => {
    let cases = 0;
    for (let size = 1; size <= 6; size++) {
      const ids = ["a", "b", "c", "d", "e", "f"].slice(0, size);
      for (const order of permutations(ids)) {
        for (let bits = 0; bits < 2 ** size; bits++) {
          const chosen = new Set(ids.filter((_, at) => (bits & (1 << at)) !== 0));
          for (const kind of MOVES) {
            const got = moveRows(order, chosen, kind);
            const expected = oracle(order, chosen, kind);
            expect(got).toEqual(expected);
            // The selected keep their order and the others theirs.
            expect(got.filter((id) => chosen.has(id))).toEqual(
              order.filter((id) => chosen.has(id)),
            );
            expect(got.filter((id) => !chosen.has(id))).toEqual(
              order.filter((id) => !chosen.has(id)),
            );
            // Whether it moves anything is whether the order differs, and the same array when not.
            const differs = got.some((id, at) => id !== order[at]);
            expect(canMove(order, chosen, kind)).toBe(differs);
            if (!differs) expect(got).toBe(order);
            cases++;
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(100_000);
  });
});

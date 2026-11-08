import { describe, expect, test } from "bun:test";
import { ROW_MIN_ITEM_PX, weightsOf, widthNeeded } from "./width.ts";

// View-and-widgets spec, Row (layouts, task 3.2): the width a Row needs to sit side by side, and
// the weight of each item.

describe("the width a Row needs", () => {
  test("is 240 px times the total weight over the smallest weight", () => {
    expect(widthNeeded([1, 1])).toBe(480);
    expect(widthNeeded([2, 1])).toBe(720);
    expect(widthNeeded([4, 1, 1, 1])).toBe(1680);
    expect(widthNeeded([2, 2])).toBe(480);
    expect(ROW_MIN_ITEM_PX).toBe(240);
  });

  test("a Row of two items weighted 2 and 1 is side by side at 960 px and a column at 400", () => {
    expect(960 >= widthNeeded([2, 1])).toBe(true);
    expect(400 >= widthNeeded([2, 1])).toBe(false);
  });
});

describe("the weights of a Row's items", () => {
  const ids = ["a", "b", "c"];
  const props = (widths?: object) => ({ items: ids.map((id) => ({ id })), widths });

  test("an item with no entry weighs 1", () => {
    expect(weightsOf("r", props(), ids)).toEqual([1, 1, 1]);
    expect(weightsOf("r", props({ b: 3 }), ids)).toEqual([1, 3, 1]);
  });

  test("a key of the object prototype is data: it weighs nothing for an item that is not named so", () => {
    const widths = JSON.parse('{"__proto__": 2}') as Record<string, number>;
    expect(() => weightsOf("r", props(widths), ids)).toThrow("names no item");
    expect(weightsOf("r", { items: [{ id: "constructor" }], widths: {} }, ["constructor"])).toEqual(
      [1],
    );
  });

  test("a width keyed by no item, or a weight out of range, fails the Row", () => {
    expect(() => weightsOf("r", props({ z: 2 }), ids)).toThrow('"z"');
    expect(() => weightsOf("r", props({ a: 5 }), ids)).toThrow("from 1 to 4");
    expect(() => weightsOf("r", props({ a: 1.5 }), ids)).toThrow("from 1 to 4");
  });
});

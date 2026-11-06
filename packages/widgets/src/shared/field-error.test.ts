import { describe, expect, test } from "bun:test";
import { errorSpan } from "./field-error.ts";

describe("where a grid's field error sits (review F-10)", () => {
  test("a name's error spans the whole row", () => {
    expect(errorSpan(0, 6)).toEqual({ skip: 0, span: 6 });
  });

  test("a field's error starts at its cell when two or more columns remain", () => {
    expect(errorSpan(3, 6)).toEqual({ skip: 3, span: 3 });
    expect(errorSpan(4, 6)).toEqual({ skip: 4, span: 2 });
  });

  test("the last column's error spans the whole row: there is no room", () => {
    expect(errorSpan(5, 6)).toEqual({ skip: 0, span: 6 });
  });
});

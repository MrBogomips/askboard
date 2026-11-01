import { describe, expect, test } from "bun:test";
import { questionTextId } from "../port.ts";
import { nextFocus, optionDescriptionId, optionLabelId, toggled } from "./selection.ts";

const options = [{ label: "PostgreSQL" }, { label: "SQLite" }, { label: "DynamoDB" }];

describe("Choice's selection (EXPERIENCE.md, Option: manual activation)", () => {
  test("checking a box adds its label, in the options' order, as a new value", () => {
    const value = ["DynamoDB"];
    expect(toggled(options, value, "PostgreSQL", true)).toEqual(["PostgreSQL", "DynamoDB"]);
    expect(value).toEqual(["DynamoDB"]);
  });

  test("an unset value is no choice (design decision 7)", () => {
    expect(toggled(options, undefined, "SQLite", true)).toEqual(["SQLite"]);
    expect(toggled(options, undefined, "SQLite", false)).toEqual([]);
  });

  test("unchecking a box removes its label; checking one twice keeps it once", () => {
    expect(toggled(options, ["PostgreSQL", "SQLite"], "PostgreSQL", false)).toEqual(["SQLite"]);
    expect(toggled(options, ["SQLite"], "SQLite", true)).toEqual(["SQLite"]);
  });

  test("the arrow keys move focus through the boxes, wrapping; Home and End jump", () => {
    expect(nextFocus("ArrowDown", 0, 3)).toBe(1);
    expect(nextFocus("ArrowRight", 2, 3)).toBe(0);
    expect(nextFocus("ArrowUp", 0, 3)).toBe(2);
    expect(nextFocus("ArrowLeft", 1, 3)).toBe(0);
    expect(nextFocus("Home", 2, 3)).toBe(0);
    expect(nextFocus("End", 0, 3)).toBe(2);
    expect(nextFocus("Enter", 1, 3)).toBeUndefined();
    expect(nextFocus("ArrowDown", 0, 0)).toBeUndefined();
  });

  test("element IDs use a separator no item ID holds, so two items never share one", () => {
    expect(questionTextId("database")).toBe("database:text");
    expect(optionLabelId("database", 2)).toBe("database:option:2:label");
    expect(optionDescriptionId("database", 2)).toBe("database:option:2:description");
    expect(questionTextId("database-text")).not.toBe(optionLabelId("database", 0));
  });
});

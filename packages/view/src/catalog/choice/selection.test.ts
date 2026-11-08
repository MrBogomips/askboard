import { describe, expect, test } from "bun:test";
import { questionTextId } from "../port.ts";
import {
  choosingSingle,
  optionDescriptionId,
  optionLabelId,
  previewToggling,
  toggled,
} from "./selection.ts";

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

  test("element IDs use a separator no item ID holds, so two items never share one", () => {
    expect(questionTextId("database")).toBe("database:text");
    expect(optionLabelId("database", 2)).toBe("database:option:2:label");
    expect(optionDescriptionId("database", 2)).toBe("database:option:2:description");
    expect(questionTextId("database-text")).not.toBe(optionLabelId("database", 0));
  });
});

describe("a single Choice's check (FR-3: choosing an option clears the Other text and Other clears the option)", () => {
  const calls = (other: string | undefined) => {
    const log: unknown[] = [];
    const choose = choosingSingle({
      options,
      other,
      onValueChange: (next) => log.push(["value", next]),
      onOtherChange: (next) => log.push(["other", next]),
    });
    return { log, choose };
  };

  test("an option puts its label as the whole value", () => {
    const { log, choose } = calls(undefined);
    choose(1);
    expect(log).toEqual([["value", ["SQLite"]]]);
  });

  test("an option clears the Other text when Other was chosen", () => {
    const { log, choose } = calls("typed");
    choose(0);
    expect(log).toEqual([
      ["value", ["PostgreSQL"]],
      ["other", undefined],
    ]);
  });

  test("Other, the row after the options, clears the value and keeps its text, empty at first", () => {
    const first = calls(undefined);
    first.choose(options.length);
    expect(first.log).toEqual([
      ["value", undefined],
      ["other", ""],
    ]);
    const again = calls("typed");
    again.choose(options.length);
    expect(again.log).toEqual([
      ["value", undefined],
      ["other", "typed"],
    ]);
  });

  test("a row that is none of them changes nothing", () => {
    const { log, choose } = calls(undefined);
    choose(options.length + 1);
    choose(-1);
    expect(log).toEqual([]);
  });
});

describe("the option previews of a Choice open one at a time", () => {
  const presses = (open: number | undefined) => {
    const log: (number | undefined)[] = [];
    return { log, press: previewToggling(open, (next) => log.push(next)) };
  };

  test("pressing a closed option's preview opens it, in place of the open one", () => {
    const { log, press } = presses(0);
    press(2)();
    expect(log).toEqual([2]);
    const none = presses(undefined);
    none.press(1)();
    expect(none.log).toEqual([1]);
  });

  test("pressing the open preview closes it", () => {
    const { log, press } = presses(1);
    press(1)();
    expect(log).toEqual([undefined]);
  });
});

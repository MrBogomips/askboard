import { describe, expect, test } from "bun:test";
import { PICK_FILTER_OVER } from "@askboard/contract";
import {
  checkedAmong,
  clearing,
  filteredOptions,
  focusFirstRadio,
  picking,
  showsFilter,
  toggledIds,
  toggling,
} from "./selection.ts";

// The PickField's selection logic apart from React (form-widget, task 3.3; view-and-widgets spec:
// The PickField, The PickField's filter; design decision 4): which options a filter shows, ignoring
// case, and the list of IDs a toggle gives, in the options' order, with a hidden pick kept.

const option = (id: string, label: string) => ({ id, label });
const COUNTRIES = [
  option("it", "Italy"),
  option("fr", "France"),
  option("de", "Germany"),
  option("es", "Spain"),
  option("fi", "Finland"),
];

describe("the options a filter shows", () => {
  test("an empty filter shows every option", () => {
    expect(filteredOptions(COUNTRIES, "")).toEqual(COUNTRIES);
  });

  test("the options whose label holds the text, ignoring case, in their order", () => {
    expect(filteredOptions(COUNTRIES, "fr").map(({ id }) => id)).toEqual(["fr"]);
    expect(filteredOptions(COUNTRIES, "FR").map(({ id }) => id)).toEqual(["fr"]);
    expect(filteredOptions(COUNTRIES, "AN").map(({ id }) => id)).toEqual(["fr", "de", "fi"]);
    expect(filteredOptions(COUNTRIES, "zzz")).toEqual([]);
  });

  test("a match is of the label, never of the ID or the description", () => {
    const options = [
      { id: "alpha", label: "One", description: "beta words" },
      { id: "beta", label: "Two" },
    ];
    expect(filteredOptions(options, "beta")).toEqual([]);
    expect(filteredOptions(options, "alpha")).toEqual([]);
  });

  test("the text is a text, not a pattern: metacharacters and an ID like constructor match as text", () => {
    const options = [
      option("a", "C++ (core)"),
      option("constructor", "constructor"),
      option("b", "Other"),
    ];
    expect(filteredOptions(options, "c++").map(({ id }) => id)).toEqual(["a"]);
    expect(filteredOptions(options, "(").map(({ id }) => id)).toEqual(["a"]);
    expect(filteredOptions(options, ".*")).toEqual([]);
    expect(filteredOptions(options, "constructor").map(({ id }) => id)).toEqual(["constructor"]);
    expect(filteredOptions(options, "__proto__")).toEqual([]);
  });

  test("a letter with a lowercase of its own matches by toLowerCase, as documented", () => {
    expect(filteredOptions([option("a", "ÉCOLE"), option("b", "x")], "école")).toHaveLength(1);
  });
});

describe("when the filter shows", () => {
  test("above more than 10 options only, and never read-only", () => {
    expect(PICK_FILTER_OVER).toBe(10);
    expect(showsFilter(10, false)).toBe(false);
    expect(showsFilter(11, false)).toBe(true);
    expect(showsFilter(50, false)).toBe(true);
    expect(showsFilter(30, true)).toBe(false);
  });
});

describe("the IDs a multiple pick gives", () => {
  const ids = COUNTRIES.map(({ id }) => id);

  test("a toggled-on option joins in the options' order, not the order of the picks", () => {
    expect(toggledIds(COUNTRIES, ["fi", "it"], "de", true)).toEqual(["it", "de", "fi"]);
    expect(toggledIds(COUNTRIES, undefined, "es", true)).toEqual(["es"]);
  });

  test("a toggled-off option leaves, and the last one leaving gives no result", () => {
    expect(toggledIds(COUNTRIES, ["it", "fr"], "it", false)).toEqual(["fr"]);
    expect(toggledIds(COUNTRIES, ["it"], "it", false)).toBeUndefined();
  });

  test("a pick the filter hides stays picked whatever is toggled", () => {
    // Italy is picked and hidden by a filter of "fr"; toggling France keeps Italy.
    expect(toggledIds(COUNTRIES, ["it"], "fr", true)).toEqual(["it", "fr"]);
    expect(toggledIds(COUNTRIES, ["it", "fr"], "fr", false)).toEqual(["it"]);
  });

  test("an ID that is no option's is dropped, so a stale pick cannot be sent", () => {
    expect(toggledIds(COUNTRIES, ["gone", "it"], "fr", true)).toEqual(["it", "fr"]);
    expect(toggledIds(COUNTRIES, undefined, "gone", true)).toBeUndefined();
    expect(ids).toHaveLength(5);
  });

  test("picking every option gives the whole list, once each", () => {
    let picked: readonly string[] | undefined;
    for (const id of ids) picked = toggledIds(COUNTRIES, picked, id, true);
    expect(picked).toEqual(ids);
    expect(toggledIds(COUNTRIES, picked, "it", true)).toEqual(ids);
  });
});

describe("what the controls do", () => {
  test("a checkbox's change puts the toggled list; only true checks", () => {
    const puts: unknown[] = [];
    const put = (result: readonly string[] | undefined) => puts.push(result);
    toggling(COUNTRIES, ["fi"], "it", put)(true);
    toggling(COUNTRIES, ["it", "fi"], "it", put)(false);
    toggling(COUNTRIES, undefined, "it", put)("indeterminate");
    expect(puts).toEqual([["it", "fi"], ["fi"], undefined]);
  });

  test("Clear puts no result, then hands focus on once the draft has updated", async () => {
    const calls: string[] = [];
    clearing(
      () => calls.push("put"),
      () => calls.push("focus"),
    )();
    expect(calls).toEqual(["put"]);
    await Promise.resolve();
    expect(calls).toEqual(["put", "focus"]);
  });

  test("focus goes to the first radio under the root, and to none when there is none", () => {
    const focused: string[] = [];
    const radio = { focus: () => focused.push("radio") };
    const root = {
      querySelector: (selector: string) => (selector === '[role="radio"]' ? radio : null),
    };
    focusFirstRadio(root as unknown as ParentNode);
    expect(focused).toEqual(["radio"]);
    focusFirstRadio({ querySelector: () => null } as unknown as ParentNode);
    focusFirstRadio(null);
    expect(focused).toEqual(["radio"]);
  });
});

describe("a single pick's radios (view-and-widgets spec: Radios with manual activation)", () => {
  test("the checked radio is the picked option's place among those shown", () => {
    expect(checkedAmong(COUNTRIES, "de")).toBe(2);
    expect(checkedAmong(filteredOptions(COUNTRIES, "n"), "de")).toBe(1);
  });

  test("no radio is checked while nothing is picked, or the filter hides the pick", () => {
    expect(checkedAmong(COUNTRIES, undefined)).toBeUndefined();
    expect(checkedAmong(filteredOptions(COUNTRIES, "fr"), "it")).toBeUndefined();
    expect(checkedAmong([], "it")).toBeUndefined();
  });

  test("an option ID named like an inherited object member is found by position all the same", () => {
    const named = [option("constructor", "C"), option("__proto__", "P")];
    expect(checkedAmong(named, "__proto__")).toBe(1);
    expect(checkedAmong(named, "toString")).toBeUndefined();
  });

  test("checking a radio picks the ID of the option shown at its place, and no other", () => {
    const puts: string[] = [];
    const shown = filteredOptions(COUNTRIES, "n");
    picking(shown, (id) => puts.push(id))(1);
    picking(shown, (id) => puts.push(id))(9);
    picking(shown, (id) => puts.push(id))(-1);
    expect(puts).toEqual(["de"]);
  });
});

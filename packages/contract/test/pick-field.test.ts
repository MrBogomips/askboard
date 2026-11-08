// The PickField, unregistered (form-widget, task 1.3; contract spec: PickField items, PickField
// results, The PickField and forms in the registry and the skill; design decisions 4, 7 and 8),
// composed over the shipped registry with `withWidgetTypes(...FORM_TYPES)` while the PickField is
// not registered, so that the same tests pass after it joins `WIDGET_TYPES`.

import { describe, expect, test } from "bun:test";
import {
  FORM_QUESTION,
  FORM_RESULTS,
  FORM_TYPES,
  lifecycleBoardDocument,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  PICK_FIELD_MAX_OPTIONS,
  PICK_FIELD_MIN_OPTIONS,
  PICK_FIELD_WIDGET,
  PICK_FILTER_OVER,
  pickFieldFieldCheck,
  pickFieldPropsProblems,
  pickFieldResultShape,
  VIEW_ID_PREFIX,
  WIDGET_TYPES,
  widgetFieldCheck,
  widgetRegistryProblems,
  widgetResultFits,
  widgetResultProblems,
} from "../src/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { validateAskRequestOver, widgetItemProblems } from "../src/validate.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";
import { type Item, question } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(...FORM_TYPES);
const AJV = ajvOver(TYPES);

const options = (count: number, prefix = "o") =>
  Array.from({ length: count }, (_, at) => ({ id: `${prefix}${at}`, label: `Option ${at}` }));
const pick = (props: Record<string, unknown> = {}, id = "region"): Item => ({
  type: "pick-field",
  id,
  props: { label: "Region", options: options(3), ...props },
});
const askOf = (...items: unknown[]) => ({
  askId: "pick-field-a1b2",
  items: [{ type: "question", id: "q", props: { text: "Which?", items } }],
});
const problemsOf = (it: Item) => widgetItemProblems(it, question(it), "agent", TYPES);
const accepted = (it: Item) => validateAskRequestOver(askOf(it), TYPES).ok;
// The schema and the plain checks the board runs must agree on every props.
const passes = (it: Item) => {
  const plain = pickFieldPropsProblems(it.props).length === 0;
  expect(accepted(it), "the ask's verdict and the plain check disagree").toBe(plain);
  return plain && problemsOf(it).length === 0;
};
const refusedAt = (it: Item, path: string) =>
  validateAskRequestOver(askOf(it), TYPES).ok === false &&
  pickFieldPropsProblems(it.props).some((problem) => problem.path.endsWith(path));
const fits = (it: Item, result: unknown) => widgetResultFits(it, result, it.props, TYPES);
const resultProblems = (it: Item, result: unknown) =>
  widgetResultProblems(it, result, it.props, TYPES);
const characters = (count: number) => "😀".repeat(count);

describe("the PickField in the registry", () => {
  test("is an entry the registry that holds it is sound with", () => {
    expect(PICK_FIELD_WIDGET.props.$id).toBe("urn:askboard:input:pick-field-props");
    expect(PICK_FIELD_WIDGET.result?.schema.$id).toBe("urn:askboard:output:pick-field-result");
    expect(PICK_FIELD_WIDGET.edits).toBeUndefined();
    expect(PICK_FIELD_WIDGET.derived).toBeUndefined();
    expect(PICK_FIELD_WIDGET.fieldCheck).toBe(pickFieldFieldCheck);
    expect(PICK_FIELD_WIDGET.noun).toBe("a PickField");
    expect(PICK_FIELD_WIDGET.props.description).toEndWith("In the input format since form-widget.");
    expect(PICK_FIELD_WIDGET.result?.schema.description).toEndWith(
      "In the output format since form-widget.",
    );
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
  });

  test("is in the shipped registry after the layouts, once its component's chunk has landed", () => {
    const types = WIDGET_TYPES.map(({ type }) => type);
    // The Table, which a later change registered, follows it.
    expect(types.slice(-6, -1)).toEqual(["stack", "row", "group", "tabs", "pick-field"]);
    expect(types.at(-1)).toBe("table");
    expect(TYPES.map(({ type }) => type)).toEqual(types);
    expect(widgetRegistryProblems(WIDGET_TYPES)).toEqual([]);
  });

  test("passes the registry's rule that a result schema refuses what holds nothing", () => {
    expect(widgetRegistryProblems(FORM_TYPES)).toEqual([]);
    for (const empty of [null, {}, [], "", [null], [""]]) {
      expect(fits(pick(), empty), JSON.stringify(empty)).toBe(false);
    }
  });

  test("has a use of at most 60 characters and notes within the skill's bounds", () => {
    const { use, notes } = PICK_FIELD_WIDGET.skill ?? { use: "" };
    expect(use.length).toBeGreaterThan(0);
    expect(use.length).toBeLessThanOrEqual(60);
    for (const note of notes ?? []) expect(note.length).toBeLessThanOrEqual(300);
  });

  test("gives the example item, which passes", () => {
    expect(passes(PICK_FIELD_WIDGET.example.item as Item)).toBe(true);
  });

  test("names the filter's threshold", () => {
    expect(PICK_FILTER_OVER).toBe(10);
    expect([PICK_FIELD_MIN_OPTIONS, PICK_FIELD_MAX_OPTIONS]).toEqual([2, 50]);
  });
});

describe("PickField items", () => {
  test("a pick of 2 and of 50 options passes, of 1 and of 51 is refused at options", () => {
    expect(passes(pick({ options: options(2) }))).toBe(true);
    expect(passes(pick({ options: options(50) }))).toBe(true);
    expect(passes(pick({ options: options(1) }))).toBe(false);
    expect(refusedAt(pick({ options: options(1) }), "/options")).toBe(true);
    expect(passes(pick({ options: options(51) }))).toBe(false);
    expect(refusedAt(pick({ options: options(51) }), "/options")).toBe(true);
  });

  test("a repeated option ID is refused, naming the item and the option ID", () => {
    const repeated = pick({
      options: [
        { id: "eu", label: "Europe" },
        { id: "eu", label: "Asia" },
      ],
    });
    expect(accepted(repeated)).toBe(false);
    const [problem] = pickFieldPropsProblems(repeated.props);
    expect(problem?.path).toBe("/options/1/id");
    expect(problem?.message).toContain('"eu"');
    const result = validateAskRequestOver(askOf(repeated), TYPES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const named = result.problems.find((each) => each.message.includes("eu"));
      expect(named?.message).toContain("region");
    }
  });

  test("an option ID with the view's prefix is refused, and constructor is an ID like another", () => {
    expect(
      passes(pick({ options: [{ id: `${VIEW_ID_PREFIX}one`, label: "A" }, ...options(1)] })),
    ).toBe(false);
    expect(
      pickFieldPropsProblems(
        pick({ options: [{ id: `${VIEW_ID_PREFIX}one`, label: "A" }, ...options(1)] }).props,
      )[0]?.message,
    ).toContain(VIEW_ID_PREFIX);
    expect(
      passes(
        pick({
          options: [
            { id: "constructor", label: "A" },
            { id: "__proto__", label: "B" },
            { id: "toString", label: "C" },
          ],
        }),
      ),
    ).toBe(true);
    expect(passes(pick({ options: [{ id: "has space", label: "A" }, ...options(1)] }))).toBe(false);
    expect(passes(pick({ options: [{ id: "x".repeat(65), label: "A" }, ...options(1)] }))).toBe(
      false,
    );
  });

  test("option labels and descriptions hold at their bounds, in code points, and fail one past", () => {
    const withOption = (option: Record<string, unknown>) =>
      pick({ options: [{ id: "a", label: "A", ...option }, ...options(1)] });
    expect(passes(withOption({ label: characters(200) }))).toBe(true);
    expect(passes(withOption({ label: characters(201) }))).toBe(false);
    expect(passes(withOption({ label: "" }))).toBe(false);
    expect(passes(withOption({ description: characters(1_000) }))).toBe(true);
    expect(passes(withOption({ description: characters(1_001) }))).toBe(false);
    expect(passes(withOption({ description: "" }))).toBe(false);
    expect(passes(withOption({ colour: "red" }))).toBe(false);
  });

  test("the field's label and description keep the atoms' bounds", () => {
    expect(passes(pick({ label: characters(200), description: characters(1_000) }))).toBe(true);
    expect(passes(pick({ label: characters(201) }))).toBe(false);
    expect(passes(pick({ description: characters(1_001) }))).toBe(false);
    expect(passes(pick({ label: undefined }))).toBe(false);
    expect(passes(pick({ unknown: 1 }))).toBe(false);
    expect(passes(pick({ required: true, multiple: true }))).toBe(true);
    expect(passes(pick({ required: "yes" }))).toBe(false);
    expect(passes(pick({ multiple: "yes" }))).toBe(false);
  });

  test("minItems and maxItems need multiple, run from 1 and stay within the options", () => {
    expect(refusedAt(pick({ minItems: 1 }), "/minItems")).toBe(true);
    expect(refusedAt(pick({ maxItems: 2 }), "/maxItems")).toBe(true);
    expect(passes(pick({ multiple: true, minItems: 1, maxItems: 3 }))).toBe(true);
    expect(passes(pick({ multiple: true, minItems: 2 }))).toBe(true);
    expect(refusedAt(pick({ multiple: true, minItems: 0 }), "/minItems")).toBe(true);
    expect(refusedAt(pick({ multiple: true, maxItems: 1.5 }), "/maxItems")).toBe(true);
    expect(refusedAt(pick({ multiple: true, minItems: 3, maxItems: 2 }), "/minItems")).toBe(true);
    expect(refusedAt(pick({ options: options(5), multiple: true, maxItems: 6 }), "/maxItems")).toBe(
      true,
    );
    expect(refusedAt(pick({ options: options(5), multiple: true, minItems: 6 }), "/minItems")).toBe(
      true,
    );
    expect(passes(pick({ options: options(50), multiple: true, minItems: 50, maxItems: 50 }))).toBe(
      true,
    );
    expect(refusedAt(pick({ multiple: true, maxItems: 51 }), "/maxItems")).toBe(true);
  });

  test("props that are no object are refused", () => {
    expect(pickFieldPropsProblems("x")).toHaveLength(1);
    expect(pickFieldPropsProblems(null)).toHaveLength(1);
    expect(pickFieldPropsProblems([])).toHaveLength(1);
    expect(pickFieldPropsProblems({ label: "L", options: "ab" }).length).toBeGreaterThan(0);
    expect(pickFieldPropsProblems({ label: "L", options: [1, 2] }).length).toBeGreaterThan(0);
  });

  test("a PickField two layouts deep is checked like any other", () => {
    const inner = pick({ options: options(1) }, "inner");
    const nested = {
      type: "group",
      id: "outer",
      props: { title: "T", items: [{ type: "stack", id: "mid", props: { items: [inner] } }] },
    };
    const result = validateAskRequestOver(askOf(nested), TYPES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.some((each) => each.message.includes("inner"))).toBe(true);
    }
  });
});

describe("PickField results", () => {
  const multiple = pick({
    options: [...options(3, "")].map(({ id }, at) => ({ id: "abc"[at] ?? id, label: id })),
    multiple: true,
    maxItems: 2,
  });

  test("a multiple pick is checked against its options, their order and its shape", () => {
    expect(resultProblems(multiple, ["a", "c"])).toEqual([]);
    expect(fits(multiple, ["a", "c"])).toBe(true);
    for (const refused of [["c", "a"], ["a", "z"], "a", [], ["a", "a"], [1], "z"]) {
      expect(fits(multiple, refused), JSON.stringify(refused)).toBe(false);
      expect(resultProblems(multiple, refused).length, JSON.stringify(refused)).toBeGreaterThan(0);
    }
    for (const problem of resultProblems(multiple, ["c", "a"])) {
      expect(problem.message).toContain("item region");
    }
    expect(fits(multiple, ["a", "b", "c"])).toBe(true);
    expect(resultProblems(multiple, ["a", "b", "c"])).toEqual([]);
    expect(pickFieldFieldCheck(["a", "b", "c"], multiple.props)).toEqual({
      code: "max-items",
      max: 2,
    });
  });

  test("a single pick takes one option ID and no list", () => {
    const single = pick();
    expect(fits(single, "o1")).toBe(true);
    expect(resultProblems(single, "o1")).toEqual([]);
    expect(fits(single, ["o1"])).toBe(false);
    expect(fits(single, "nope")).toBe(false);
    expect(fits(single, 7)).toBe(false);
    expect(fits(single, "")).toBe(false);
    expect(fits(single, "has space")).toBe(false);
  });

  test("an option named like an object member is an option like another", () => {
    const odd = pick({
      options: [
        { id: "constructor", label: "A" },
        { id: "__proto__", label: "B" },
      ],
    });
    expect(fits(odd, "constructor")).toBe(true);
    expect(fits(odd, "__proto__")).toBe(true);
    expect(fits(odd, "toString")).toBe(false);
    expect(fits(odd, "hasOwnProperty")).toBe(false);
  });

  test("a result of 50 IDs fits a multiple pick of 50 options, and 51 does not", () => {
    const wide = pick({ options: options(50), multiple: true });
    const all = options(50).map(({ id }) => id);
    expect(fits(wide, all)).toBe(true);
    expect(pickFieldResultShape(all)).toBe(true);
    expect(pickFieldResultShape([...all, "o50"])).toBe(false);
    expect(fits(wide, [...all, "o50"])).toBe(false);
  });

  test("a result checked against props that are no PickField's is refused", () => {
    expect(
      widgetResultProblems({ type: "pick-field", id: "x" }, "a", { label: "L" }, TYPES),
    ).not.toEqual([]);
    expect(
      widgetResultProblems({ type: "pick-field", id: "x" }, "a", undefined, TYPES),
    ).not.toEqual([]);
  });

  test("the shape takes an ID or a list of distinct IDs and nothing else", () => {
    for (const shaped of ["a", "A_b-1", ["a"], ["a", "b"]]) {
      expect(pickFieldResultShape(shaped), JSON.stringify(shaped)).toBe(true);
    }
    for (const other of [null, undefined, 1, {}, [], "", ["a", "a"], [""], ["a b"], [1]]) {
      expect(pickFieldResultShape(other), JSON.stringify(other)).toBe(false);
    }
  });
});

describe("the PickField's field check", () => {
  const counted = pick({ multiple: true, minItems: 2, maxItems: 3, options: options(5) });

  test("a required pick fails with no result and passes with one", () => {
    const required = pick({ required: true });
    expect(widgetFieldCheck(required, undefined, TYPES)).toEqual({ code: "required" });
    expect(widgetFieldCheck(required, "o1", TYPES)).toBeUndefined();
    expect(widgetFieldCheck(pick(), undefined, TYPES)).toBeUndefined();
  });

  test("a multiple pick outside its counts fails them, and a value inside passes", () => {
    expect(widgetFieldCheck(counted, ["o0"], TYPES)).toEqual({ code: "min-items", min: 2 });
    expect(widgetFieldCheck(counted, ["o0", "o1"], TYPES)).toBeUndefined();
    expect(widgetFieldCheck(counted, ["o0", "o1", "o2", "o3"], TYPES)).toEqual({
      code: "max-items",
      max: 3,
    });
    expect(widgetFieldCheck(counted, undefined, TYPES)).toBeUndefined();
  });

  test("a value that fails a count still fits", () => {
    expect(fits(counted, ["o0"])).toBe(true);
    expect(fits(counted, ["o0", "o1", "o2", "o3"])).toBe(true);
  });

  test("a single pick has no counts", () => {
    expect(
      pickFieldFieldCheck("o1", { label: "L", options: options(3), minItems: 2 }),
    ).toBeUndefined();
    expect(pickFieldFieldCheck(["o1"], { label: "L", options: options(3) })).toBeUndefined();
  });
});

describe("the Form fixtures", () => {
  const form = FORM_QUESTION as unknown as Item;

  // A layout's props are checked by the shared validators, which hold the shipped registry: until
  // the PickField is registered (task 3.3) the ask's schema over `TYPES` and each field's own
  // checks stand for the whole request, which the last test runs once the PickField is shipped.
  const leaves = (items: readonly Item[]): Item[] =>
    items.flatMap((each) => {
      const props = each.props as { items?: Item[]; tabs?: { items: Item[] }[] };
      const inner = [...(props.items ?? []), ...(props.tabs ?? []).flatMap((tab) => tab.items)];
      return inner.length === 0 ? [each] : leaves(inner);
    });

  test("FORM_QUESTION is valid as an ask", () => {
    const ask = { askId: "form-ask-a1b2", items: [form] };
    expect(errorsOf(AJV, SCHEMA_IDS.ask, ask)).toEqual([]);
    const fields = leaves(FORM_QUESTION.props.items as unknown as readonly Item[]);
    expect(fields).toHaveLength(8);
    for (const field of fields)
      expect(widgetItemProblems(field, form, "agent", TYPES), field.id).toEqual([]);
  });

  // Reports a skip, not a pass, until task 3.3 registers the PickField.
  const registered = WIDGET_TYPES.some(({ type }) => type === "pick-field");
  test.skipIf(!registered)(
    "FORM_QUESTION passes the whole request check once the PickField is registered",
    () => {
      const result = validateAskRequestOver(
        { askId: "form-ask-a1b2", items: [form] },
        WIDGET_TYPES,
      );
      expect(result.ok ? [] : result.problems).toEqual([]);
    },
  );

  test("FORM_QUESTION is valid as a board document", () => {
    const document = structuredClone(lifecycleBoardDocument) as unknown as {
      items: { props: { items: { props: unknown }[] } }[];
    };
    const [region] = document.items[0]?.props.items ?? [];
    if (region === undefined) throw new Error("no question");
    region.props = FORM_QUESTION.props;
    expect(errorsOf(AJV, SCHEMA_IDS.boardDocument, document)).toEqual([]);
  });

  test("holds a field of every type, a required one and a patterned one", () => {
    const types = new Set<string>();
    const walk = (items: readonly Item[]) => {
      for (const each of items) {
        types.add(each.type);
        const props = each.props as { items?: Item[]; tabs?: { items: Item[] }[] };
        walk(props.items ?? []);
        for (const tab of props.tabs ?? []) walk(tab.items);
      }
    };
    walk(FORM_QUESTION.props.items as unknown as readonly Item[]);
    for (const type of [
      "text-field",
      "number-field",
      "money-field",
      "date-field",
      "pick-field",
      "toggle",
      "group",
      "tabs",
    ]) {
      expect(types.has(type), type).toBe(true);
    }
    expect(JSON.stringify(FORM_QUESTION)).toContain('"required":true');
    expect(JSON.stringify(FORM_QUESTION)).toContain('"pattern"');
  });

  test("FORM_RESULTS fit their items", () => {
    const items = new Map<string, { type: string; props: unknown }>();
    const walk = (list: readonly { type: string; id: string; props: unknown }[]) => {
      for (const each of list) {
        items.set(each.id, each);
        const props = each.props as { items?: never[]; tabs?: { items: never[] }[] };
        walk(props.items ?? []);
        for (const tab of props.tabs ?? []) walk(tab.items);
      }
    };
    walk(FORM_QUESTION.props.items as never);
    for (const [id, result] of Object.entries(FORM_RESULTS)) {
      const entry = items.get(id);
      expect(entry, id).toBeDefined();
      expect(
        widgetResultFits({ type: entry?.type ?? "", id }, result, entry?.props, TYPES),
        id,
      ).toBe(true);
    }
  });

  test("uses item IDs no other fixture does", () => {
    for (const id of Object.keys(FORM_RESULTS)) expect(id.startsWith("form-")).toBe(true);
  });
});

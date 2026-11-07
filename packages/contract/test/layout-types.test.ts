// The four layouts' entries (layouts, task 1.2; contract spec: Layout types in the registry, Stack,
// Row and Group props, Tabs props, What a layout holds, Layouts in the board document and fetch,
// Teaching text of the layouts), composed over the shipped registry with
// `withWidgetTypes(...LAYOUT_WIDGETS)` while the layouts are not registered (design decision 8),
// so that the same tests pass after they join `WIDGET_TYPES`.

import { describe, expect, test } from "bun:test";
import {
  ARRANGED_ITEM,
  LAYOUT_WIDGETS,
  lifecycleBoardDocument,
  lifecycleFetchResult,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  GROUP_DESCRIPTION_MAX_CHARS,
  GROUP_TITLE_MAX_CHARS,
  GROUP_WIDGET,
  isLayoutType,
  ROW_MAX_ITEMS,
  ROW_WIDGET,
  STACK_WIDGET,
  TABS_MAX_TABS,
  TABS_TITLE_MAX_CHARS,
  TABS_WIDGET,
  WIDGET_TYPES,
  widgetRegistryProblems,
  widgetResultProblems,
} from "../src/index.ts";
import questionPropsBase from "../src/schemas/input/question-props.json" with { type: "json" };
import { SCHEMA_IDS } from "../src/sets.ts";
import { widgetItemProblems } from "../src/validate.ts";
import { composeQuestionProps } from "../src/widgets/compose.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";
import { askAccepted, type Item, question } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(...LAYOUT_WIDGETS);
const AJV = ajvOver(TYPES);

const field = (id: string): Item => ({ type: "text-field", id, props: { label: id } });
const fields = (count: number, prefix = "f"): Item[] =>
  Array.from({ length: count }, (_, at) => field(`${prefix}${at}`));
const stack = (items: readonly unknown[], id = "s"): Item => ({
  type: "stack",
  id,
  props: { items },
});
const row = (items: readonly unknown[], widths?: unknown, id = "r"): Item => ({
  type: "row",
  id,
  props: widths === undefined ? { items } : { items, widths },
});
const group = (props: Record<string, unknown>, id = "g"): Item => ({
  type: "group",
  id,
  props: { items: fields(1, "in"), ...props },
});
const tab = (id: string, title = id, items: readonly unknown[] = fields(1, id)) => ({
  id,
  title,
  items,
});
const tabs = (...panels: readonly unknown[]): Item => ({
  type: "tabs",
  id: "t",
  props: { tabs: panels },
});
const two = [tab("a"), tab("b")];

// The layout's own checks, after a schema that passed.
const problemsOf = (item: Item) => widgetItemProblems(item, question(item), "agent", TYPES);
const accepted = (item: Item) => askAccepted(TYPES, item);
const passes = (item: Item) => accepted(item) && problemsOf(item).length === 0;
const refusedBySchema = (item: Item) => !accepted(item);
const refusedByCheck = (item: Item) => accepted(item) && problemsOf(item).length > 0;
// An object read from JSON, so that `__proto__` is an own key as an agent's request has it.
const fromJson = (json: string): unknown => JSON.parse(json);

describe("the layouts in the registry", () => {
  test("follow the shipped types, in the order stack, row, group, tabs", () => {
    expect(TYPES.slice(-4).map(({ type }) => type)).toEqual(["stack", "row", "group", "tabs"]);
    expect(TYPES).toEqual([...WIDGET_TYPES]);
  });

  test("give no result, no edits and no derived values, each with its noun and a short teaching use", () => {
    for (const entry of LAYOUT_WIDGETS) {
      expect(entry.result, entry.type).toBeUndefined();
      expect(entry.edits, entry.type).toBeUndefined();
      expect(entry.derived, entry.type).toBeUndefined();
      expect(entry.skill?.use.length, entry.type).toBeGreaterThan(0);
      expect(entry.skill?.use.length, entry.type).toBeLessThanOrEqual(70);
    }
    expect(LAYOUT_WIDGETS.map(({ noun }) => noun)).toEqual([
      "a Stack",
      "a Row",
      "a Group",
      "a Tabs layout",
    ]);
  });

  test("make a registry that holds together, and refuse a type named layoutItem", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
    const props = { ...STACK_WIDGET.props, $id: "urn:askboard:input:layoutitem-props" };
    const named = { ...STACK_WIDGET, type: "layoutItem", props };
    const problems = widgetRegistryProblems([...TYPES, named]);
    expect(problems.map(({ rule }) => rule)).toContain("reserved");
  });

  test("a layout gives no result for a result sent for it", () => {
    const item = { type: "group", id: "g" };
    const [problem] = widgetResultProblems(item, "x", {}, TYPES);
    expect(problem?.message).toContain("item g is a Group, and a Group gives no result");
  });
});

describe("the question props composed over the layouts", () => {
  const composed = composeQuestionProps(questionPropsBase, TYPES);
  const refsOf = (union: string): string[] =>
    composed.$defs[union].oneOf.map(({ $ref }: { $ref: string }) => $ref.split("/").at(-1));

  test("add layoutItem: every registered type's item, layouts included, and no context item", () => {
    const held = refsOf("layoutItem");
    expect(held).toEqual(TYPES.map(({ type }) => type));
    for (const type of ["excerpt", "reference", "image", "molecule", "question", "area"]) {
      expect(held).not.toContain(type);
    }
    expect(composed.$defs.layoutItem.discriminator).toEqual({ propertyName: "type" });
  });

  test("take each layout's item in a question's items", () => {
    const items = refsOf("item");
    for (const { type } of LAYOUT_WIDGETS) expect(items).toContain(type);
    expect(items.at(-1)).toBe("molecule");
  });

  test("equal the base over a registry with no layout, which has no layoutItem", () => {
    const shipped = composeQuestionProps(
      questionPropsBase,
      WIDGET_TYPES.filter(({ type }) => !isLayoutType(type)),
    );
    expect(Object.hasOwn(shipped.$defs, "layoutItem")).toBe(false);
    expect(shipped.$defs.item.oneOf.map(({ $ref }: { $ref: string }) => $ref)).not.toContain(
      "#/$defs/stack",
    );
  });

  test("every layout's props refer to the union in the input format", () => {
    for (const { props } of LAYOUT_WIDGETS) {
      expect(JSON.stringify(props)).toContain(
        "urn:askboard:input:question-props#/$defs/layoutItem",
      );
    }
  });
});

describe("a question arranged with layouts", () => {
  test("passes, and each layout's example passes alone", () => {
    expect(passes(ARRANGED_ITEM as unknown as Item)).toBe(true);
    for (const entry of LAYOUT_WIDGETS) {
      expect(passes(entry.example.item as Item), entry.type).toBe(true);
    }
  });

  test("passes as the scenario words it: a Tabs of a Group of a Row, and a Stack of a Toggle and a Divider", () => {
    const [people, options] = (
      ARRANGED_ITEM.props.tabs as unknown as readonly { items: { type: string }[] }[]
    ).map(({ items }) => items[0]?.type);
    expect([people, options]).toEqual(["group", "stack"]);
  });
});

describe("the Stack", () => {
  test("takes one item or more", () => {
    expect(passes(stack([field("a")]))).toBe(true);
    expect(passes(stack(fields(30)))).toBe(true);
  });

  test("refuses none, and a field it does not define", () => {
    expect(refusedBySchema(stack([]))).toBe(true);
    expect(refusedBySchema({ type: "stack", id: "s", props: { items: fields(1), gap: 4 } })).toBe(
      true,
    );
  });
});

describe("the Row", () => {
  test("takes 2 to 4 items, and refuses one or five", () => {
    expect(passes(row(fields(ROW_MAX_ITEMS - 2)))).toBe(true);
    expect(passes(row(fields(ROW_MAX_ITEMS)))).toBe(true);
    expect(refusedBySchema(row(fields(1)))).toBe(true);
    expect(refusedBySchema(row(fields(ROW_MAX_ITEMS + 1)))).toBe(true);
  });

  test("takes widths keyed by an item of the Row, a weight from 1 to 4", () => {
    const items = fields(2);
    expect(passes(row(items, { f0: 2 }))).toBe(true);
    expect(passes(row(items, { f0: 1, f1: 4 }))).toBe(true);
    expect(passes(row(items, {}))).toBe(true);
  });

  test("refuses a weight of 0, 5 or 1.5, and a text", () => {
    for (const weight of [0, 5, 1.5, "2", null]) {
      expect(refusedBySchema(row(fields(2), { f0: weight })), String(weight)).toBe(true);
    }
  });

  test("refuses a width keyed by no item, naming the Row and the width", () => {
    const item = row(fields(2), { fee: 1 });
    expect(refusedByCheck(item)).toBe(true);
    const [problem] = problemsOf(item);
    expect(problem?.path).toBe("/widths/fee");
    expect(problem?.message).toContain('"fee"');
  });

  test("reads a width keyed __proto__ or constructor as an own key that names no item", () => {
    for (const key of ["__proto__", "constructor", "toString"]) {
      const widths = fromJson(`{"${key}":1}`);
      const item = row(fields(2), widths);
      expect(refusedByCheck(item), key).toBe(true);
      expect(problemsOf(item)[0]?.path, key).toBe(`/widths/${key}`);
    }
  });

  test("accepts a width keyed constructor when an item of the Row has that ID", () => {
    const items = [field("constructor"), field("f1")];
    expect(passes(row(items, fromJson('{"constructor":3}')))).toBe(true);
  });

  test("refuses a width key outside the ID shape, and more than four widths", () => {
    expect(refusedBySchema(row(fields(2), { "bad key": 1 }))).toBe(true);
    const five = { a: 1, b: 1, c: 1, d: 1, e: 1 };
    expect(refusedBySchema(row(fields(4), five))).toBe(true);
  });
});

describe("the Row's wording", () => {
  test("folds a width's key to {item}, and leaves any other path as it is", () => {
    const rest = ROW_WIDGET.wording.rest;
    expect(rest?.(["props", "widths", "fee"])).toEqual(["props", "widths", "{item}"]);
    expect(rest?.(["props", "widths"])).toEqual(["props", "widths"]);
    expect(rest?.(["props", "items", "0"])).toEqual(["props", "items", "0"]);
    expect(Object.keys(ROW_WIDGET.wording.expected)).toContain("row.props.widths.{item}");
  });
});

describe("the Group", () => {
  const points = (count: number) => "😀".repeat(count);

  test("takes a title of 1 to 200 code points, counted as code points", () => {
    expect(passes(group({ title: "T" }))).toBe(true);
    expect(passes(group({ title: points(GROUP_TITLE_MAX_CHARS) }))).toBe(true);
    expect(refusedBySchema(group({ title: "" }))).toBe(true);
    expect(refusedBySchema(group({ title: points(GROUP_TITLE_MAX_CHARS + 1) }))).toBe(true);
  });

  test("takes an optional description of 1 to 1,000 code points", () => {
    expect(passes(group({ title: "T", description: points(GROUP_DESCRIPTION_MAX_CHARS) }))).toBe(
      true,
    );
    expect(refusedBySchema(group({ title: "T", description: "" }))).toBe(true);
    expect(
      refusedBySchema(group({ title: "T", description: points(GROUP_DESCRIPTION_MAX_CHARS + 1) })),
    ).toBe(true);
  });

  test("needs a title and at least one item", () => {
    expect(refusedBySchema({ type: "group", id: "g", props: { items: fields(1) } })).toBe(true);
    expect(refusedBySchema(group({ title: "T", items: [] }))).toBe(true);
  });
});

describe("the Tabs layout", () => {
  test("takes 2 to 8 tabs, and refuses one or nine", () => {
    const many = (count: number) =>
      tabs(...Array.from({ length: count }, (_, at) => tab(`tab${at}`)));
    expect(passes(many(2))).toBe(true);
    expect(passes(many(TABS_MAX_TABS))).toBe(true);
    expect(refusedBySchema(many(1))).toBe(true);
    expect(refusedBySchema(many(TABS_MAX_TABS + 1))).toBe(true);
  });

  test("takes a title of 1 to 80 code points", () => {
    const titled = (title: string) => tabs(tab("a", title), tab("b"));
    expect(passes(titled("😀".repeat(TABS_TITLE_MAX_CHARS)))).toBe(true);
    expect(refusedBySchema(titled(""))).toBe(true);
    expect(refusedBySchema(titled("😀".repeat(TABS_TITLE_MAX_CHARS + 1)))).toBe(true);
  });

  test("refuses a tab with no items, and a field a tab does not define", () => {
    expect(refusedBySchema(tabs(tab("a", "A", []), tab("b")))).toBe(true);
    expect(refusedBySchema(tabs({ ...tab("a"), icon: "x" }, tab("b")))).toBe(true);
  });

  test("refuses two tabs with the ID costs, naming the Tabs and the tab", () => {
    const item = tabs(tab("costs"), tab("costs", "Again"));
    expect(refusedByCheck(item)).toBe(true);
    const [problem] = problemsOf(item);
    expect(problem?.path).toBe("/tabs/1/id");
    expect(problem?.message).toContain('"costs"');
  });

  test("refuses a tab ID that starts with u-", () => {
    const item = tabs(tab("u-1"), tab("b"));
    expect(refusedByCheck(item)).toBe(true);
    expect(problemsOf(item)[0]?.path).toBe("/tabs/0/id");
  });

  test("names the tab a path is in, by its ID", () => {
    const element = TABS_WIDGET.wording.element;
    const item = tabs(tab("costs"), tab("notes"));
    expect(element?.(item, ["props", "tabs", "1", "title"])).toBe('tab "notes"');
    expect(element?.(item, ["props", "tabs", "7", "title"])).toBeUndefined();
    expect(element?.(item, ["props", "items"])).toBeUndefined();
  });
});

describe("what a layout holds", () => {
  const OUTSIDE: readonly (readonly [string, unknown])[] = [
    ["excerpt", { type: "excerpt", id: "x", props: { text: "t", source: "s" } }],
    ["reference", { type: "reference", id: "x", props: { url: "https://example.com/" } }],
    ["image", { type: "image", id: "x", props: { pointer: "a.png#x", alt: "a" } }],
    ["molecule", { type: "molecule", id: "x", props: { molecule: "wbs-pert", data: {} } }],
    ["question", { type: "question", id: "x", props: { text: "Q" } }],
    ["area", { type: "area", id: "x", props: { title: "A", items: [] } }],
  ];
  const IN: readonly ((inner: unknown) => Item)[] = [
    (inner) => stack([inner]),
    (inner) => row([inner, field("y")]),
    (inner) => group({ title: "T", items: [inner] }),
    (inner) => tabs(tab("a", "A", [inner]), tab("b")),
  ];

  test("refuses each type outside a layout, at its type, in each of the four layouts", () => {
    for (const [type, inner] of OUTSIDE) {
      for (const [at, wrap] of IN.entries()) {
        expect(accepted(wrap(inner)), `${type} in ${LAYOUT_WIDGETS[at]?.type}`).toBe(false);
      }
    }
  });

  test("states in each layout's wording that such an item belongs in the question's own items", () => {
    for (const entry of LAYOUT_WIDGETS) {
      const keys = Object.keys(entry.wording.expected).filter((key) =>
        key.endsWith("items[].type"),
      );
      expect(keys.length, entry.type).toBe(1);
      expect(entry.wording.expected[keys[0] as string], entry.type).toContain(
        "belongs in the question's own items",
      );
    }
  });

  test("takes atoms, widgets and layouts, one inside another", () => {
    const inner = stack([row([field("a"), field("b")])], "inner");
    expect(passes(group({ title: "T", items: [inner, field("c")] }))).toBe(true);
  });
});

describe("the layouts in the board document and in fetch", () => {
  const arranged = ARRANGED_ITEM as unknown as Item;
  type Document = { items: { props: { items: { props: Record<string, unknown> }[] } }[] };
  const first = (value: Document) => value.items[0]?.props.items;

  // The lifecycle board document with the arranged Tabs in its first question's items.
  const documentWith = (items: unknown[]) => {
    const document = structuredClone(lifecycleBoardDocument) as unknown as Document;
    const [region] = first(document) ?? [];
    if (region === undefined) throw new Error("no question");
    region.props = { text: "Which regions?", items };
    return document;
  };

  const fetchWith = (item: unknown) => ({ ...structuredClone(lifecycleFetchResult), item });

  const documentOk = (items: unknown[]) =>
    errorsOf(AJV, SCHEMA_IDS.boardDocument, documentWith(items)).length === 0;
  const fetchOk = (item: unknown) =>
    errorsOf(AJV, SCHEMA_IDS.fetchResult, fetchWith(item)).length === 0;

  test("admit the arranged question", () => {
    expect(documentOk([arranged])).toBe(true);
    const asked = {
      type: "question",
      id: "q",
      rev: 1,
      state: "open",
      props: { text: "Q", items: [arranged] },
    };
    expect(fetchOk(asked)).toBe(true);
  });

  test("admit a Group fetched alone", () => {
    const [panel] = ARRANGED_ITEM.props.tabs;
    const alone = { ...(panel?.items[0] as object), questionId: "q", state: "open" };
    expect(fetchOk(alone)).toBe(true);
  });

  test("refuse an excerpt inside a Row, at its type", () => {
    const excerpt = { type: "excerpt", id: "x", props: { text: "t", source: "s" } };
    const bad = row([excerpt, field("y")]);
    expect(documentOk([bad])).toBe(false);
    const asked = {
      type: "question",
      id: "q",
      rev: 1,
      state: "open",
      props: { text: "Q", items: [bad] },
    };
    expect(fetchOk(asked)).toBe(false);
    const alone = { ...bad, questionId: "q", state: "open" };
    expect(fetchOk(alone)).toBe(false);
  });
});

describe("the entries' standalone schemas", () => {
  test("are named for their type, in the input format's names", () => {
    for (const { type, props } of [STACK_WIDGET, ROW_WIDGET, GROUP_WIDGET, TABS_WIDGET]) {
      expect(props.$id).toBe(`urn:askboard:input:${type}-props`);
      expect(props.description).toContain("In the input format since layouts.");
      expect(props.additionalProperties).toBe(false);
    }
  });
});

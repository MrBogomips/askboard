import { describe, expect, test } from "bun:test";
import {
  isLayoutType,
  LAYOUT_MAX_DEPTH,
  LAYOUT_TYPES,
  layoutDepthProblem,
  layoutListsOf,
  mapNestedItems,
  nestedItemsOf,
} from "../src/index.ts";

// The walker of layouts (layouts, design decision 2): plain items, no registry, no schema.

const field = (id: string) => ({ type: "text-field", id, props: {} });
const group = (id: string, items: readonly unknown[]) => ({
  type: "group",
  id,
  props: { title: id, items },
});
const row = (id: string, items: readonly unknown[]) => ({ type: "row", id, props: { items } });
const stack = (id: string, items: readonly unknown[]) => ({ type: "stack", id, props: { items } });
const tabs = (id: string, panels: readonly (readonly [string, readonly unknown[]])[]) => ({
  type: "tabs",
  id,
  props: { tabs: panels.map(([tab, items]) => ({ id: tab, title: tab, items })) },
});

const idOf = (item: unknown): string | undefined => (item as { id?: string } | undefined)?.id;

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
};

// Groups nested `count` deep around one field, built from the inside out.
const groups = (count: number): unknown => {
  let item: unknown = field("leaf");
  for (let at = count; at >= 1; at -= 1) item = group(`g${at}`, [item]);
  return item;
};

describe("the layout types", () => {
  test("are the four layouts, bounded at four deep", () => {
    expect([...LAYOUT_TYPES]).toEqual(["stack", "row", "group", "tabs"]);
    expect(LAYOUT_MAX_DEPTH).toBe(4);
  });

  test("isLayoutType is true for a layout's type and nothing else", () => {
    for (const type of LAYOUT_TYPES) expect(isLayoutType(type)).toBe(true);
    for (const type of [
      "text-field",
      "area",
      "question",
      "constructor",
      "__proto__",
      "",
      1,
      null,
    ]) {
      expect(isLayoutType(type)).toBe(false);
    }
  });
});

describe("layoutListsOf", () => {
  test("names each list a layout holds, with its path from the item", () => {
    const inner = [field("a"), field("b")];
    expect(layoutListsOf(stack("s", inner))).toEqual([{ path: ["props", "items"], items: inner }]);
    expect(layoutListsOf(row("r", inner))).toEqual([{ path: ["props", "items"], items: inner }]);
    expect(layoutListsOf(group("g", inner))).toEqual([{ path: ["props", "items"], items: inner }]);
    const lists = layoutListsOf(
      tabs("t", [
        ["one", inner],
        ["two", [field("c")]],
      ]),
    );
    expect(lists.map((list) => list.path)).toEqual([
      ["props", "tabs", "0", "items"],
      ["props", "tabs", "1", "items"],
    ]);
  });

  test("names nothing for a type that is no layout", () => {
    expect(layoutListsOf({ type: "ranking", id: "k", props: { items: [{ id: "x" }] } })).toEqual(
      [],
    );
    expect(layoutListsOf({ type: "area", id: "a", props: { title: "t", items: [] } })).toEqual([]);
    expect(layoutListsOf({ type: "question", id: "q", props: { text: "t", items: [] } })).toEqual(
      [],
    );
    expect(layoutListsOf(field("f"))).toEqual([]);
  });

  test("reads malformed layouts as holding nothing, and never throws", () => {
    for (const bad of [
      null,
      undefined,
      3,
      "x",
      [],
      {},
      { type: "group" },
      { type: "group", props: 1 },
    ]) {
      expect(layoutListsOf(bad)).toEqual([]);
    }
    expect(layoutListsOf({ type: "group", props: { items: "nope" } })).toEqual([]);
    expect(layoutListsOf({ type: "tabs", props: { tabs: "nope" } })).toEqual([]);
    const lists = layoutListsOf({
      type: "tabs",
      props: { tabs: [null, { id: "x" }, { items: [1] }] },
    });
    expect(lists.map((list) => list.path)).toEqual([["props", "tabs", "2", "items"]]);
  });

  test("reads only own properties, so an inherited items list is not a layout's", () => {
    const props = Object.create({ items: [field("inherited")] }) as object;
    expect(layoutListsOf({ type: "group", props })).toEqual([]);
    const inherited = Object.create({ type: "group", props: { items: [field("x")] } }) as object;
    expect(layoutListsOf(inherited)).toEqual([]);
  });
});

describe("nestedItemsOf", () => {
  const arranged = [
    tabs("t", [
      ["costs", [group("g", [row("r", [field("a"), field("b")]), field("c")])]],
      ["notes", [stack("s", [field("d")])]],
    ]),
    field("e"),
  ];

  test("walks every item at every depth, depth first in document order, layouts included", () => {
    expect(nestedItemsOf(arranged).map(({ item }) => (item as { id: string }).id)).toEqual([
      "t",
      "g",
      "r",
      "a",
      "b",
      "c",
      "s",
      "d",
      "e",
    ]);
  });

  test("gives each item its path from the list and its layout depth", () => {
    const walked = nestedItemsOf(arranged);
    const at = (id: string) => walked.find(({ item }) => (item as { id: string }).id === id);
    expect(at("t")).toMatchObject({ path: ["0"], depth: 0 });
    expect(at("g")).toMatchObject({ path: ["0", "props", "tabs", "0", "items", "0"], depth: 1 });
    expect(at("b")?.path).toEqual([
      "0",
      "props",
      "tabs",
      "0",
      "items",
      "0",
      "props",
      "items",
      "0",
      "props",
      "items",
      "1",
    ]);
    expect(at("b")?.depth).toBe(3);
    expect(at("d")?.path).toEqual(["0", "props", "tabs", "1", "items", "0", "props", "items", "0"]);
    expect(at("e")).toMatchObject({ path: ["1"], depth: 0 });
  });

  test("starts the paths at the given segments", () => {
    const walked = nestedItemsOf([group("g", [field("a")])], ["items", "2", "props", "items"]);
    expect(walked[1]?.path).toEqual(["items", "2", "props", "items", "0", "props", "items", "0"]);
  });

  test("never walks a Ranking's elements or an area's questions", () => {
    const ranking = { type: "ranking", id: "k", props: { items: [{ id: "x", label: "x" }] } };
    const area = { type: "area", id: "a", props: { title: "t", items: [field("q")] } };
    expect(nestedItemsOf([ranking, area]).map(({ item }) => (item as { id: string }).id)).toEqual([
      "k",
      "a",
    ]);
  });

  test("lists an item that is no record as it stands, and its children not at all", () => {
    expect(nestedItemsOf([null, 3]).length).toBe(2);
  });
});

describe("mapNestedItems", () => {
  const original = deepFreeze([
    tabs("t", [
      ["one", [group("g", [field("a")]), field("b")]],
      ["two", [field("c")]],
    ]),
    field("d"),
  ]);
  const stamp = (item: unknown) => ({ ...(item as object), stamped: true });

  test("replaces every item at every depth and returns new objects", () => {
    const mapped = mapNestedItems(original, stamp) as { id: string; stamped?: boolean }[];
    const seen = nestedItemsOf(mapped).map(({ item }) => item as { stamped?: boolean });
    expect(seen.length).toBe(6);
    expect(seen.every((item) => item.stamped === true)).toBe(true);
    expect(mapped).not.toBe(original);
    expect(mapped[0]).not.toBe(original[0]);
  });

  test("leaves its input deep-equal to what it was", () => {
    const before = JSON.stringify(original);
    mapNestedItems(original, stamp);
    expect(JSON.stringify(original)).toBe(before);
  });

  test("rebuilds each layout around its mapped items before f sees it", () => {
    const seenAtTabs: unknown[] = [];
    mapNestedItems(original, (item) => {
      if ((item as { type: string }).type === "tabs") {
        const panels = (item as { props: { tabs: { items: { stamped?: boolean }[] }[] } }).props
          .tabs;
        seenAtTabs.push(panels[0]?.items[0]);
        expect(panels.length).toBe(2);
      }
      return stamp(item);
    });
    expect(seenAtTabs).toHaveLength(1);
    expect((seenAtTabs[0] as { stamped?: boolean }).stamped).toBe(true);
  });

  test("keeps a tab's other fields and the layout's other props", () => {
    const mapped = mapNestedItems(original, (item) => item) as typeof original;
    expect(mapped).toEqual(original);
    expect(mapNestedItems([group("g", [field("a")])], (item) => item)).toEqual([
      group("g", [field("a")]),
    ]);
  });

  test("leaves a malformed layout and a non-record as they stand", () => {
    const odd = [{ type: "tabs", id: "t", props: { tabs: [null, { id: "x" }] } }, 7];
    expect(mapNestedItems(odd, (item) => item)).toEqual(odd);
  });

  test("maps a very deep list without a call stack", () => {
    let item: unknown = field("leaf");
    for (let at = 0; at < 100_000; at += 1) item = group(`g${at}`, [item]);
    expect(mapNestedItems([item], (each) => each).length).toBe(1);
  });

  test("reads keys named __proto__ and constructor in a layout's props as data", () => {
    const props = JSON.parse(
      '{"title":"g","items":[{"type":"text-field","id":"a","props":{}}],"__proto__":{"items":[]},"constructor":1}',
    ) as object;
    const hostile = [{ type: "group", id: "g", props }];
    const mapped = mapNestedItems(hostile, (item) => item) as { props: Record<string, unknown> }[];
    expect(Object.hasOwn(mapped[0]?.props ?? {}, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(mapped[0]?.props)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(mapped[0]?.props ?? {}, "constructor")?.value).toBe(1);
    expect(nestedItemsOf(hostile).length).toBe(2);
  });
});

describe("layoutDepthProblem", () => {
  test("accepts four layouts deep and names the fifth", () => {
    expect(layoutDepthProblem([groups(4)])).toBeUndefined();
    const problem = layoutDepthProblem([groups(5)]);
    expect(problem?.depth).toBe(5);
    expect(idOf(problem?.item)).toBe("g5");
    expect(problem?.path).toEqual([
      "0",
      "props",
      "items",
      "0",
      "props",
      "items",
      "0",
      "props",
      "items",
      "0",
      "props",
      "items",
      "0",
    ]);
  });

  test("counts layouts of every kind and finds the first past the bound in document order", () => {
    const deep = tabs("t", [
      ["one", [stack("s", [row("r", [field("a"), group("g", [stack("z", [field("b")])])])])]],
      ["two", [field("c")]],
    ]);
    const problem = layoutDepthProblem([deep]);
    expect(idOf(problem?.item)).toBe("z");
  });

  test("starts its paths at the given segments", () => {
    const problem = layoutDepthProblem([groups(5)], ["items", "1", "props", "items"]);
    expect(problem?.path.slice(0, 5)).toEqual(["items", "1", "props", "items", "0"]);
  });

  test("returns on 100,000 nested Groups and never throws", () => {
    let item: unknown = field("leaf");
    for (let at = 0; at < 100_000; at += 1) item = group(`g${at}`, [item]);
    expect(layoutDepthProblem([item])?.depth).toBe(LAYOUT_MAX_DEPTH + 1);
  });

  test("returns on an object that holds itself", () => {
    const looping = { type: "group", id: "loop", props: { title: "t", items: [] as unknown[] } };
    looping.props.items.push(looping);
    expect(layoutDepthProblem([looping])?.depth).toBe(LAYOUT_MAX_DEPTH + 1);
  });

  test("finds no problem in items that hold no layout", () => {
    expect(
      layoutDepthProblem([field("a"), { type: "ranking", props: { items: [] } }]),
    ).toBeUndefined();
    expect(layoutDepthProblem([])).toBeUndefined();
  });
});

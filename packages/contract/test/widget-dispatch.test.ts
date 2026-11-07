// Dispatch and wording through the registry (widget-registry, task 1.2; contract spec, "Widget
// items follow their registry entry"): a test-only type, registered by passing a registry that
// holds it, is checked, worded, found in a path and diffed from its entry alone, and the shipped
// registry still refuses what it does not hold.

import { describe, expect, test } from "bun:test";
import {
  CONTEXT_ITEM_TYPES,
  contextItemTypes,
  ITEM_EXPECTED,
  innerItemOf,
  itemExpected,
  itemKey,
  placedItems,
} from "../src/ask-items.ts";
import { PROBE_TYPES, PROBE_WIDGET } from "../src/fixtures/index.ts";
import type { RequestProblem, Wording } from "../src/problems.ts";
import { elementShapeOf, widgetItemProblems } from "../src/validate.ts";
import { GANTT_WIDGET } from "../src/widgets/gantt/widget.ts";
import { elementOf, widgetRest } from "../src/widgets/paths.ts";
import { WIDGET_TYPES } from "../src/widgets/registry.ts";
import { widgetProblems, widgetSchemaErrors } from "../src/widgets/request-problems.ts";
import { TREE_WIDGET } from "../src/widgets/tree/widget.ts";
import {
  WIDGET_EXPECTED,
  WIDGET_FIELDS,
  widgetExpected,
  widgetFields,
} from "../src/widgets/wording.ts";

const PROBE = PROBE_WIDGET.example.item;
const question = (...items: readonly unknown[]) => ({
  type: "question",
  id: "q",
  props: { text: "Which?", items },
});
const withOptions = (options: unknown) => ({ ...PROBE, props: { options } });

describe("widgetItemProblems with a registry", () => {
  test("passes a probe item through the probe's schema and checks", () => {
    expect(widgetItemProblems(PROBE, question(PROBE), "agent", PROBE_TYPES)).toEqual([]);
  });

  test("reports the schema's problems of a probe item, and not its checks'", () => {
    const item = withOptions([]);
    const problems = widgetItemProblems(item, question(item), "agent", PROBE_TYPES);
    expect(problems.map(({ path }) => path)).toEqual(["/options"]);
    expect(problems[0]?.message).toContain("fewer than 1 items");
  });

  test("reports the probe's own checks after its schema", () => {
    const item = withOptions([
      { id: "a", label: "A" },
      { id: "a", label: "B" },
    ]);
    expect(widgetItemProblems(item, question(item), "agent", PROBE_TYPES)).toEqual([
      { path: "/options", message: "the options of a probe have unique IDs" },
    ]);
  });

  test("refuses a probe item whole when the registry does not hold it", () => {
    expect(widgetItemProblems(PROBE, question(PROBE), "agent")).toEqual([
      {
        path: "/",
        message: `item pick has the type "probe", which is no widget the contract defines`,
      },
    ]);
  });

  test("refuses spreadsheet, naming the item, with or without the probe", () => {
    const spreadsheet = { type: "spreadsheet", id: "board", props: {} };
    for (const types of [WIDGET_TYPES, PROBE_TYPES]) {
      expect(widgetItemProblems(spreadsheet, question(spreadsheet), "agent", types)).toEqual([
        {
          path: "/",
          message: `item board has the type "spreadsheet", which is no widget the contract defines`,
        },
      ]);
    }
  });

  test("an inherited name is no widget type", () => {
    const item = { type: "constructor", id: "c", props: {} };
    expect(widgetItemProblems(item, question(item), "agent", PROBE_TYPES)).toHaveLength(1);
  });
});

describe("elementShapeOf, widgetRest and elementOf with a registry", () => {
  test("give the probe's shape, and none without the probe", () => {
    expect(elementShapeOf(PROBE, PROBE_TYPES)).toEqual({ elements: "options" });
    expect(elementShapeOf(PROBE)).toBeUndefined();
    expect(
      elementShapeOf({ type: "spreadsheet", id: "k", props: {} }, PROBE_TYPES),
    ).toBeUndefined();
  });

  test("a type with no folding keeps its path, and the Tree and Gantt fold as before", () => {
    const path = ["props", "options", "0", "label"];
    expect(widgetRest("probe", path, PROBE_TYPES)).toEqual(path);
    expect(widgetRest("probe", path)).toEqual(path);
    expect(widgetRest("tree", ["props", "nodes", "0", "children", "1", "cost"])).toEqual([
      "props",
      "nodes",
      "0",
      "{field}",
    ]);
    expect(widgetRest("gantt", ["props", "tasks", "t1", "start"])).toEqual([
      "props",
      "tasks",
      "{task}",
      "start",
    ]);
  });

  test("name the probe's element from its entry", () => {
    const path = ["props", "options", "1", "label"];
    expect(elementOf(PROBE, path, PROBE_TYPES)).toBe('option "b"');
    expect(elementOf(PROBE, path)).toBeUndefined();
    expect(elementOf(PROBE, ["props", "options"], PROBE_TYPES)).toBeUndefined();
    expect(elementOf("nothing", path, PROBE_TYPES)).toBeUndefined();
  });
});

describe("the wording tables", () => {
  test("hold the probe's keys with the probe's registry only", () => {
    expect(widgetExpected(PROBE_TYPES)["probe.props"]).toBe("a probe's props {options}");
    expect(widgetFields(PROBE_TYPES)["probe.props"]).toBe("a probe's props hold only options");
    expect(WIDGET_EXPECTED["probe.props"]).toBeUndefined();
    expect(widgetExpected(PROBE_TYPES)["molecule.props"]).toBe(WIDGET_EXPECTED["molecule.props"]);
    expect(widgetFields(PROBE_TYPES)["molecule.props"]).toBe(WIDGET_FIELDS["molecule.props"]);
  });

  test("hold the Tree's, the Gantt's and the molecule's keys, as before, and each appended type's own", () => {
    const keysOf = (table: Readonly<Record<string, string>>, prefix: string) =>
      Object.keys(table).filter((key) => key.startsWith(prefix));
    expect(keysOf(WIDGET_EXPECTED, "tree.")).toHaveLength(14);
    // 16 since a plan's task entry's `duration` has its own key (gantt-wording.test.ts).
    expect(keysOf(WIDGET_EXPECTED, "gantt.")).toHaveLength(16);
    expect(keysOf(WIDGET_EXPECTED, "molecule.")).toHaveLength(4);
    expect(keysOf(WIDGET_FIELDS, "tree.")).toHaveLength(3);
    expect(keysOf(WIDGET_FIELDS, "gantt.")).toHaveLength(3);
    expect(keysOf(WIDGET_FIELDS, "molecule.")).toHaveLength(1);
    // Every other type holds the keys its entry declares, found by its prefix.
    for (const { type, wording } of WIDGET_TYPES.slice(2)) {
      expect(keysOf(WIDGET_EXPECTED, `${type}.`).sort()).toEqual(
        Object.keys(wording.expected).sort(),
      );
      expect(keysOf(WIDGET_FIELDS, `${type}.`).sort()).toEqual(Object.keys(wording.fields).sort());
    }
    const declared = WIDGET_TYPES.flatMap(({ wording }) => Object.keys(wording.fields));
    expect(Object.keys(WIDGET_FIELDS)).toHaveLength(declared.length + 1);
  });

  test("list the item types and nouns of the registry, in its order", () => {
    const types = WIDGET_TYPES.map(({ type }) => type);
    expect(types.slice(0, 2)).toEqual(["tree", "gantt"]);
    expect(CONTEXT_ITEM_TYPES).toEqual(["excerpt", "reference", "image", ...types, "molecule"]);
    expect(contextItemTypes(PROBE_TYPES)).toEqual([
      "excerpt",
      "reference",
      "image",
      ...types,
      "probe",
      "molecule",
    ]);
    const quoted = CONTEXT_ITEM_TYPES.map((type) => `"${type}"`);
    const orList = `${quoted.slice(0, -1).join(", ")} or ${quoted.at(-1)}`;
    expect(ITEM_EXPECTED["question.props.items[].type"]).toBe(orList);
    expect(ITEM_EXPECTED["question.props.items[]"]).toBe(
      `an item {type, id, props} whose type is ${orList}`,
    );
    const nouns = [...WIDGET_TYPES.map(({ noun }) => noun), "a molecule reference"].join(", ");
    expect(ITEM_EXPECTED["question.props.items"]).toBe(
      `a non-empty list of the question's items: context (excerpts, references, images) and widgets (${nouns})`,
    );
    for (const type of [...types, "molecule"]) {
      expect(ITEM_EXPECTED[`${type}.id`]).toBe(ITEM_EXPECTED["excerpt.id"] as string);
    }
  });

  test("word the item types and nouns as before over an explicit registry of the Tree, the Gantt and the probe", () => {
    const expected = itemExpected([TREE_WIDGET, GANTT_WIDGET, PROBE_WIDGET]);
    expect(expected["question.props.items[].type"]).toBe(
      '"excerpt", "reference", "image", "tree", "gantt", "probe" or "molecule"',
    );
    expect(expected["question.props.items[]"]).toBe(
      'an item {type, id, props} whose type is "excerpt", "reference", "image", "tree", "gantt", "probe" or "molecule"',
    );
    expect(expected["question.props.items"]).toBe(
      "a non-empty list of the question's items: context (excerpts, references, images) and widgets (a Tree, a Gantt, a Probe, a molecule reference)",
    );
    expect(expected["probe.id"]).toBe(expected["excerpt.id"] as string);
    expect(contextItemTypes([TREE_WIDGET, GANTT_WIDGET])).toEqual([
      "excerpt",
      "reference",
      "image",
      "tree",
      "gantt",
      "molecule",
    ]);
  });

  test("list the probe's type, noun and ID with the probe's registry, after the shipped types", () => {
    const expected = itemExpected(PROBE_TYPES);
    const quoted = contextItemTypes(PROBE_TYPES).map((type) => `"${type}"`);
    expect(expected["question.props.items[].type"]).toBe(
      `${quoted.slice(0, -1).join(", ")} or ${quoted.at(-1)}`,
    );
    expect(expected["question.props.items[].type"]).toEndWith('"probe" or "molecule"');
    expect(expected["question.props.items"]).toEndWith("a Probe, a molecule reference)");
    expect(expected["probe.id"]).toBe(expected["excerpt.id"] as string);
  });

  test("key a probe item's fields by its type only with the probe's registry", () => {
    const q = question(PROBE);
    const rest = ["props", "items", "0", "props", "options", "1", "label"];
    expect(itemKey(q, rest, PROBE_TYPES)).toBe("probe.props.options[].label");
    expect(itemKey(q, rest)).toBe("question.props.items[].props.options[].label");
  });
});

// A request's wording as the ask's is composed: tables, key by type, the item a path is in.
const wordingOf = (types: typeof PROBE_TYPES): Wording => ({
  root: "(the ask)",
  expected: { ...itemExpected(types), ...widgetExpected(types) },
  fields: widgetFields(types),
  keyOf: (ask, segments) =>
    segments[0] === "items" && segments.length > 1
      ? itemKey((ask as { items: unknown[] }).items[Number(segments[1])], segments.slice(2), types)
      : segments.join("."),
  itemOf: (ask, segments) => {
    if (segments[0] !== "items" || segments.length < 3) return undefined;
    const inner = innerItemOf(
      (ask as { items: unknown[] }).items[Number(segments[1])],
      segments.slice(2),
    );
    const id = (inner.item as { id?: string }).id;
    const element = elementOf(inner.item, inner.rest, types);
    return {
      itemId: id as string,
      rest: inner.rest,
      ...(element === undefined ? {} : { element }),
    };
  },
});

describe("widgetProblems and widgetSchemaErrors with a registry", () => {
  const item = withOptions([
    { id: "a", label: "A" },
    { id: "a", label: "B" },
  ]);
  const ask = { askId: "x", items: [question(item)] };
  const placed = placedItems(ask.items, ["items"]);
  const problems = (types: typeof PROBE_TYPES): readonly RequestProblem[] =>
    widgetProblems(wordingOf(types), ask, placed, [], types);

  test("word a probe item's problem under its item, with its field and expected shape", () => {
    const [first, ...rest] = problems(PROBE_TYPES);
    expect(rest).toEqual([]);
    expect(first?.itemId).toBe("pick");
    expect(first?.message).toContain("the options of a probe have unique IDs");
    expect(first?.field).toBe("props.options");
    expect(first?.expected).toBe("a non-empty list of options, each {id, label}");
  });

  test("leave a probe item alone when the registry does not hold it", () => {
    expect(problems(WIDGET_TYPES)).toEqual([]);
  });

  test("keep every schema error of a registry that has no Gantt", () => {
    const error = {
      instancePath: "/items/0/props/items/0/props/tasks",
      keyword: "type",
      schemaPath: "",
      params: {},
    };
    const gantt = { type: "gantt", id: "g", props: { tasks: 3 } };
    const value = { items: [question(gantt)] };
    expect(widgetSchemaErrors([error], value, PROBE_TYPES)).toEqual([]);
    expect(widgetSchemaErrors([error], value, [PROBE_WIDGET])).toEqual([error]);
  });
});

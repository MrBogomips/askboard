import { describe, expect, test } from "bun:test";
import type { MoleculeDefinition } from "@askboard/contract";
import { validateMoleculeDefinition } from "@askboard/contract/validate";
import { fillItem } from "../src/index.ts";
import { copyOf, deepFreeze, scheduleData, wbsData, wbsPert } from "./molecules.ts";

// The fill forms (molecules design decision 3; core spec, "Fill forms"): each puts a parameter's
// value at its pointer, and a parameter the data leaves out leaves the composition's value.

type Json = Record<string, unknown>;
type Node = Json & { readonly children?: readonly Node[] };

const NONE: ReadonlyMap<string, string> = new Map();
const REFERENCES: ReadonlyMap<string, string> = new Map([["wbs", "wbs__tree"]]);

/** A plan-like definition with one fill of each form, and two keys a pointer must escape. */
const forms: MoleculeDefinition = deepFreeze({
  format: "1.0.0",
  molecule: "probe-forms",
  version: "1.0.0",
  parameters: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "urn:askboard:molecule:probe-forms:1",
    type: "object",
    properties: {
      workPackages: { type: "string" },
      start: { type: "string" },
      dependencies: { type: "object" },
      extra: { type: "object" },
      tilde: { type: "string" },
    },
    additionalProperties: false,
  },
  items: [
    {
      type: "gantt",
      id: "plan",
      props: { start: "2026-01-05", tasks: {}, "a/b": { kept: true }, "c~d": "x" },
    },
  ],
  fills: {
    workPackages: [{ pointer: "/0/props/workPackages", as: "item" }],
    start: [{ pointer: "/0/props/start" }],
    dependencies: [{ pointer: "/0/props/tasks", as: { entries: "dependencies" } }],
    extra: [{ pointer: "/0/props/a~1b/extra" }],
    tilde: [{ pointer: "/0/props/c~0d" }],
  },
});

const filled = (definition: MoleculeDefinition, data: Json, references = NONE) => {
  const result = fillItem(definition, data, references);
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  return result.item;
};

const nodesOf = (props: Json): readonly Node[] => props.nodes as readonly Node[];
const everyKey = (nodes: readonly Node[]): string[] =>
  nodes.flatMap((node) => [...Object.keys(node), ...everyKey(node.children ?? [])]);

describe("the test definitions", () => {
  test("pass the contract's definition checks", () => {
    expect(validateMoleculeDefinition(wbsPert)).toEqual({ ok: true, value: wbsPert });
    expect(validateMoleculeDefinition(forms)).toEqual({ ok: true, value: forms });
  });
});

describe("a copy fill", () => {
  test("puts the value at its pointer", () => {
    expect(filled(wbsPert, { nodes: [], depth: 3 }).props.openDepth).toBe(3);
    expect(filled(forms, { start: "2026-11-02" }).props.start).toBe("2026-11-02");
  });

  test("is deep and shares nothing with the data", () => {
    const data = { extra: { list: [{ at: 1 }], nested: { deep: true } } };
    const item = filled(forms, data);
    const extra = (item.props["a/b"] as Json).extra as typeof data.extra;
    expect(extra).toEqual(data.extra);
    expect(extra).not.toBe(data.extra);
    expect(extra.list).not.toBe(data.extra.list);
    expect(extra.list[0]).not.toBe(data.extra.list[0]);
    expect(extra.nested).not.toBe(data.extra.nested);
  });

  test("keeps a __proto__ key as data, never as a prototype", () => {
    const extra = JSON.parse('{"__proto__": {"polluted": true}, "plain": 1}');
    const item = filled(forms, { extra });
    const copied = (item.props["a/b"] as Json).extra as Json;
    expect(Object.hasOwn(copied, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(copied)).toBe(Object.prototype);
    expect((copied as { polluted?: unknown }).polluted).toBeUndefined();
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });
});

describe("an item fill", () => {
  test("names the expanded item when the value names a molecule reference of the ask", () => {
    const item = filled(forms, { workPackages: "wbs" }, REFERENCES);
    expect(item.props.workPackages).toBe("wbs__tree");
  });

  test("keeps the value when it names a plain item, or any item no reference is", () => {
    expect(filled(forms, { workPackages: "wbs" }).props.workPackages).toBe("wbs");
    expect(filled(forms, { workPackages: "other" }, REFERENCES).props.workPackages).toBe("other");
  });
});

describe("an entries fill", () => {
  test("turns each value of an object into an entry holding it under the field", () => {
    expect(filled(forms, { dependencies: { prototype: ["ux"] } }).props.tasks).toEqual({
      prototype: { dependencies: ["ux"] },
    });
  });

  test("gives the approved UJ-2 dependencies as the plan's entries", () => {
    const { tasks } = filled(forms, scheduleData, REFERENCES).props;
    expect(tasks).toEqual({
      prototype: { dependencies: ["ux"] },
      portal: { dependencies: ["architecture", "prototype"] },
      billing: { dependencies: ["architecture"] },
      reporting: { dependencies: ["portal"] },
    });
    const prototype = (tasks as Json).prototype as Json;
    expect(prototype.dependencies).not.toBe((scheduleData.dependencies as Json).prototype);
  });

  test("on a value that is no object is a problem naming the parameter, not an exception", () => {
    for (const dependencies of [["ux"], "ux", null]) {
      expect(fillItem(forms, { dependencies }, NONE)).toEqual({
        ok: false,
        problems: [
          {
            path: "/dependencies",
            message: 'the parameter "dependencies" is no object, which its entries fill needs',
          },
        ],
      });
    }
  });
});

describe("an omit fill", () => {
  test("leaves out the keys at every depth of the approved nodes, keeping every other key", () => {
    const props = filled(wbsPert, wbsData).props;
    const sent = wbsData.nodes as readonly Node[];
    expect(everyKey(sent)).toContain("excerpt");
    expect(everyKey(nodesOf(props))).not.toContain("excerpt");
    const withoutExcerpt = (nodes: readonly Node[]): Node[] =>
      nodes.map(({ excerpt: _, children, ...rest }) =>
        children === undefined ? rest : { ...rest, children: withoutExcerpt(children) },
      );
    expect(nodesOf(props)).toEqual(withoutExcerpt(sent));
  });

  test("leaves out the keys in objects inside lists inside objects", () => {
    const deep = copyOf(wbsPert) as unknown as { fills: Json };
    deep.fills = { nodes: [{ pointer: "/0/props/nodes", as: { omit: ["excerpt", "note"] } }] };
    const nodes = [
      { id: "a", label: "A", note: "x", children: [{ id: "b", label: "B", excerpt: "p#H" }] },
    ];
    const props = filled(deep as unknown as MoleculeDefinition, { nodes }).props;
    expect(props.nodes).toEqual([{ id: "a", label: "A", children: [{ id: "b", label: "B" }] }]);
  });
});

describe("a parameter the data leaves out", () => {
  test("leaves the composition's value", () => {
    const tree = filled(wbsPert, { nodes: [] });
    expect(tree.props.openDepth).toBe(2);
    expect(tree.props.pert).toBe(true);
    const plan = filled(forms, { workPackages: "wbs" }, REFERENCES);
    expect(plan.props).toEqual({
      start: "2026-01-05",
      tasks: {},
      "a/b": { kept: true },
      "c~d": "x",
      workPackages: "wbs__tree",
    });
  });
});

describe("pointers", () => {
  test("unescape ~1 and ~0 before they are followed", () => {
    const item = filled(forms, { extra: { n: 1 }, tilde: "y" });
    expect(item.props["a/b"]).toEqual({ kept: true, extra: { n: 1 } });
    expect(item.props["c~d"]).toBe("y");
  });

  test("naming no place in the composition is a problem naming the parameter, not an exception", () => {
    const broken = copyOf(forms) as unknown as { fills: Json };
    broken.fills = { start: [{ pointer: "/0/props/schedule/start" }] };
    expect(fillItem(broken as unknown as MoleculeDefinition, { start: "x" }, NONE)).toEqual({
      ok: false,
      problems: [
        {
          path: "/start",
          message:
            'the definition fills "start" at "/0/props/schedule/start", which names no place in its composition',
        },
      ],
    });
  });
});

describe("inputs", () => {
  test("frozen definitions and data are left untouched, and the item shares nothing with the definition", () => {
    const data = deepFreeze(copyOf(wbsData));
    const before = JSON.stringify([wbsPert, data]);
    const item = filled(wbsPert, data);
    expect(JSON.stringify([wbsPert, data])).toBe(before);
    expect(item).not.toBe(wbsPert.items[0]);
    expect(item.props.columns).toEqual(wbsPert.items[0].props.columns);
    expect(item.props.columns).not.toBe(wbsPert.items[0].props.columns);
    expect(Object.isFrozen(item)).toBe(false);
    expect(item.id).toBe("tree");
  });
});

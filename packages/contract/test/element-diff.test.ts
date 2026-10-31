import { describe, expect, test } from "bun:test";
import {
  applyElementChanges,
  type ElementChange,
  type ElementShape,
  elementChanges,
} from "../src/index.ts";

// The generic element diff (design decision 3) on test-only `probe` items, never a widget's own
// data: a nested shape and a flat shape whose elements carry an array field.
const ITEM = "probe";
const NESTED: ElementShape = { elements: "parts", children: "subparts" };
const FLAT: ElementShape = { elements: "rows" };

type Value = Record<string, unknown>;

const nested = (): Value => ({
  title: "kept as it is",
  parts: [
    {
      id: "a",
      name: "A",
      size: 1,
      subparts: [
        { id: "a1", name: "A1", size: 2 },
        { id: "a2", name: "A2" },
        { id: "a3", name: "A3", tags: ["x"] },
      ],
    },
    { id: "b", name: "B", subparts: [{ id: "b1", name: "B1" }] },
    { id: "c", name: "C", meta: { owner: "ops", weight: 2 } },
  ],
});

const flat = (): Value => ({
  rows: [
    { id: "r1", name: "R1", links: [] },
    { id: "r2", name: "R2", links: ["r1"] },
    { id: "r3", name: "R3", links: ["r1", "r2"] },
    { id: "r4", name: "R4" },
  ],
});

// Edits a copy of a value with a function that may mutate it, as a widget's model would not.
const edit = (value: Value, change: (copy: Value) => void): Value => {
  const copy = structuredClone(value);
  change(copy);
  return copy;
};

type Element = { id: string; [key: string]: unknown };
const list = (value: Value, key: string): Element[] => value[key] as Element[];
const find = (elements: Element[], id: string, children = "subparts"): Element | undefined => {
  for (const element of elements) {
    if (element.id === id) return element;
    const found = find((element[children] as Element[] | undefined) ?? [], id, children);
    if (found !== undefined) return found;
  }
  return undefined;
};
const at = (value: Value, id: string): Element => {
  const found = find((value.parts ?? value.rows) as Element[], id);
  if (found === undefined) throw new Error(`no element ${id}`);
  return found;
};
const kids = (value: Value, id: string): Element[] => at(value, id).subparts as Element[];
// Takes an element out of a list, by its ID.
const take = (elements: Element[], id: string): Element => {
  const [taken] = elements.splice(
    elements.findIndex((element) => element.id === id),
    1,
  );
  if (taken?.id !== id) throw new Error(`no element ${id} in the list`);
  return taken;
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
};
const deeplyFrozen = (value: unknown): boolean =>
  typeof value !== "object" ||
  value === null ||
  (Object.isFrozen(value) && Object.values(value).every(deeplyFrozen));

const roundTrip = (sent: Value, edited: Value, shape: ElementShape) =>
  applyElementChanges(ITEM, sent, elementChanges(ITEM, sent, edited, shape), shape);

describe("the element diff: no operation for what did not change (AD-20)", () => {
  test("an equal value gives no operation, in either shape", () => {
    expect(elementChanges(ITEM, nested(), nested(), NESTED)).toEqual([]);
    expect(elementChanges(ITEM, flat(), flat(), FLAT)).toEqual([]);
  });

  test("keys in another order, in an element or in an object field, give no operation", () => {
    const edited = edit(nested(), (copy) => {
      list(copy, "parts")[0] = { subparts: at(copy, "a").subparts, size: 1, name: "A", id: "a" };
      at(copy, "c").meta = { weight: 2, owner: "ops" };
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([]);
  });

  test("an empty children list counts as none", () => {
    const sent = edit(nested(), (copy) => {
      at(copy, "c").subparts = [];
    });
    expect(elementChanges(ITEM, sent, nested(), NESTED)).toEqual([]);
  });
});

describe("each operation kind alone", () => {
  test("an element added at the top and first place has parent and after null", () => {
    const edited = edit(nested(), (copy) => {
      list(copy, "parts").unshift({ id: "u-1", name: "New", size: 3 });
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([
      {
        op: "add",
        target: "probe.u-1",
        parent: null,
        after: null,
        value: { name: "New", size: 3 },
      },
    ]);
  });

  test("an element added as a last child names its parent and its previous sibling", () => {
    const edited = edit(nested(), (copy) => {
      kids(copy, "a").push({ id: "u-1", name: "New" });
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([
      { op: "add", target: "probe.u-1", parent: "a", after: "a3", value: { name: "New" } },
    ]);
  });

  test("an added element's value leaves out its children, which follow as their own adds", () => {
    const edited = edit(nested(), (copy) => {
      list(copy, "parts").push({ id: "u-1", name: "New", subparts: [{ id: "u-2", name: "Kid" }] });
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([
      { op: "add", target: "probe.u-1", parent: null, after: "c", value: { name: "New" } },
      { op: "add", target: "probe.u-2", parent: "u-1", after: null, value: { name: "Kid" } },
    ]);
  });

  test("a removed element gives one remove", () => {
    const edited = edit(nested(), (copy) => {
      list(copy, "parts").pop();
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([
      { op: "remove", target: "probe.c" },
    ]);
  });

  test("an element moved under another parent names the parent and the previous sibling", () => {
    const edited = edit(nested(), (copy) => {
      kids(copy, "b").push(take(kids(copy, "a"), "a2"));
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([
      { op: "move", target: "probe.a2", parent: "b", after: "b1" },
    ]);
  });

  test("a changed field gives one set", () => {
    const edited = edit(nested(), (copy) => {
      at(copy, "a").size = 5;
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([
      { op: "set", target: "probe.a.size", value: 5 },
    ]);
  });

  test("an emptied field is set to null", () => {
    const edited = edit(nested(), (copy) => {
      delete at(copy, "a1").size;
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([
      { op: "set", target: "probe.a1.size", value: null },
    ]);
  });

  test("a new field is set", () => {
    const edited = edit(nested(), (copy) => {
      at(copy, "a2").size = 0;
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([
      { op: "set", target: "probe.a2.size", value: 0 },
    ]);
  });
});

describe("the fewest operations", () => {
  test("an element moved to the front gives one move and none for its siblings", () => {
    const edited = edit(nested(), (copy) => {
      const parts = list(copy, "parts");
      parts.unshift(take(parts, "c"));
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([
      { op: "move", target: "probe.c", parent: null, after: null },
    ]);
  });

  test("a removed branch gives one remove, none for the three children it held", () => {
    const edited = edit(nested(), (copy) => {
      list(copy, "parts").shift();
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([
      { op: "remove", target: "probe.a" },
    ]);
  });

  test("a child kept out of a removed parent moves before the parent's remove", () => {
    const edited = edit(nested(), (copy) => {
      const a = take(list(copy, "parts"), "a");
      list(copy, "parts").splice(1, 0, take(a.subparts as Element[], "a2"));
    });
    const changes = elementChanges(ITEM, nested(), edited, NESTED);
    expect(changes).toEqual([
      { op: "move", target: "probe.a2", parent: null, after: "b" },
      { op: "remove", target: "probe.a" },
    ]);
    expect(applyElementChanges(ITEM, nested(), changes, NESTED)).toEqual(edited);
  });

  test("the sets of one element come in field-name order, by UTF-16 code units", () => {
    const edited = edit(nested(), (copy) => {
      const a3 = at(copy, "a3");
      Object.assign(a3, { tags: ["y"], size: 4, name: "Renamed", Zone: "z", ärea: 1 });
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([
      { op: "set", target: "probe.a3.Zone", value: "z" },
      { op: "set", target: "probe.a3.name", value: "Renamed" },
      { op: "set", target: "probe.a3.size", value: 4 },
      { op: "set", target: "probe.a3.tags", value: ["y"] },
      { op: "set", target: "probe.a3.ärea", value: 1 },
    ]);
  });

  test("a moved element with a changed field gives its move, then its set", () => {
    const edited = edit(nested(), (copy) => {
      const parts = list(copy, "parts");
      const c = take(parts, "c");
      c.name = "First";
      parts.unshift(c);
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([
      { op: "move", target: "probe.c", parent: null, after: null },
      { op: "set", target: "probe.c.name", value: "First" },
    ]);
  });

  test("the operations follow the edited value's document order, the removes last", () => {
    const edited = edit(nested(), (copy) => {
      const parts = list(copy, "parts");
      parts.splice(2, 1);
      at(copy, "b1").name = "B one";
      kids(copy, "a").unshift({ id: "u-1", name: "New" });
    });
    expect(elementChanges(ITEM, nested(), edited, NESTED)).toEqual([
      { op: "add", target: "probe.u-1", parent: "a", after: null, value: { name: "New" } },
      { op: "set", target: "probe.b1.name", value: "B one" },
      { op: "remove", target: "probe.c" },
    ]);
  });
});

describe("a flat list and its array fields", () => {
  test("a changed array field gives one set with the whole new array, an equal one none", () => {
    const edited = edit(flat(), (copy) => {
      at(copy, "r3").links = ["r1", "r2", "r4"];
      at(copy, "r2").links = ["r1"];
    });
    expect(elementChanges(ITEM, flat(), edited, FLAT)).toEqual([
      { op: "set", target: "probe.r3.links", value: ["r1", "r2", "r4"] },
    ]);
  });

  test("the last element moved to the front gives one move with parent and after null", () => {
    const edited = edit(flat(), (copy) => {
      const rows = list(copy, "rows");
      rows.unshift(take(rows, "r4"));
    });
    expect(elementChanges(ITEM, flat(), edited, FLAT)).toEqual([
      { op: "move", target: "probe.r4", parent: null, after: null },
    ]);
  });

  test("an add and a move in a flat list always have parent null", () => {
    const edited = edit(flat(), (copy) => {
      const rows = list(copy, "rows");
      const r1 = take(rows, "r1");
      rows.splice(2, 0, r1, { id: "u-1", name: "New", links: ["r1"] });
    });
    const changes = elementChanges(ITEM, flat(), edited, FLAT);
    expect(changes).toEqual([
      { op: "move", target: "probe.r1", parent: null, after: "r3" },
      {
        op: "add",
        target: "probe.u-1",
        parent: null,
        after: "r1",
        value: { name: "New", links: ["r1"] },
      },
    ]);
    expect(applyElementChanges(ITEM, flat(), changes, FLAT)).toEqual(edited);
  });

  test("a key named like a children key is a field in a flat list", () => {
    const edited = edit(flat(), (copy) => {
      at(copy, "r4").subparts = ["x"];
    });
    expect(elementChanges(ITEM, flat(), edited, FLAT)).toEqual([
      { op: "set", target: "probe.r4.subparts", value: ["x"] },
    ]);
  });
});

describe("applying the changes in order", () => {
  test("rebuilds the edited value, keeping the props' other keys", () => {
    const edited = edit(nested(), (copy) => {
      const parts = list(copy, "parts");
      kids(copy, "a").splice(1, 0, take(parts, "b"));
      delete at(copy, "a3").tags;
      at(copy, "c").meta = { owner: "dev" };
      parts.push({ id: "u-1", name: "Last", subparts: [{ id: "u-2", name: "Under" }] });
    });
    const applied = roundTrip(nested(), edited, NESTED);
    expect(applied).toEqual(edited);
    expect(applied.title).toBe("kept as it is");
  });

  test("an element whose last child leaves holds no children list", () => {
    const edited = edit(nested(), (copy) => {
      const b1 = take(kids(copy, "b"), "b1");
      delete at(copy, "b").subparts;
      list(copy, "parts").push(b1);
    });
    expect(roundTrip(nested(), edited, NESTED)).toEqual(edited);
    expect(roundTrip(nested(), edited, NESTED)).toStrictEqual(edited);
  });

  test("a value equal to the sent one comes back equal", () => {
    expect(applyElementChanges(ITEM, nested(), [], NESTED)).toEqual(nested());
  });
});

describe("an operation that does not apply fails, naming it", () => {
  const cases: [string, ElementChange, ElementShape, string][] = [
    ["an unknown target", { op: "remove", target: "probe.zz" }, NESTED, '"zz"'],
    ["a target in another item", { op: "remove", target: "other.a" }, NESTED, "another item"],
    ["a target with no element", { op: "set", target: "probe.a", value: 1 }, NESTED, "no field"],
    [
      "an ID already there",
      { op: "add", target: "probe.b1", parent: null, after: null, value: {} },
      NESTED,
      '"b1"',
    ],
    [
      "an unknown parent",
      { op: "add", target: "probe.u-1", parent: "zz", after: null, value: {} },
      NESTED,
      '"zz"',
    ],
    [
      "a parent in a flat list",
      { op: "add", target: "probe.u-1", parent: "r1", after: null, value: {} },
      FLAT,
      "flat",
    ],
    [
      "an after that is not a sibling",
      { op: "move", target: "probe.c", parent: null, after: "a1" },
      NESTED,
      '"a1"',
    ],
    [
      "an after that is the element itself",
      { op: "move", target: "probe.c", parent: null, after: "c" },
      NESTED,
      '"c"',
    ],
    [
      "a move into the element's own subtree",
      { op: "move", target: "probe.a", parent: "a2", after: null },
      NESTED,
      "own",
    ],
    [
      "an add whose value holds an ID",
      { op: "add", target: "probe.u-1", parent: null, after: null, value: { id: "x" } },
      NESTED,
      '"id"',
    ],
    [
      "an add whose value holds children",
      { op: "add", target: "probe.u-1", parent: null, after: null, value: { subparts: [] } },
      NESTED,
      '"subparts"',
    ],
    ["a set of the ID", { op: "set", target: "probe.a.id", value: "z" }, NESTED, '"id"'],
    [
      "a set of the children",
      { op: "set", target: "probe.a.subparts", value: [] },
      NESTED,
      '"subparts"',
    ],
    [
      "an unknown kind",
      { op: "rename", target: "probe.a" } as unknown as ElementChange,
      NESTED,
      '"rename"',
    ],
    [
      "an add without its after",
      { op: "add", target: "probe.u-1", parent: null, value: {} } as unknown as ElementChange,
      NESTED,
      "after",
    ],
    [
      "an add whose value is not an object",
      { op: "add", target: "probe.u-1", parent: null, after: null, value: [] as unknown as object },
      NESTED,
      "not an object",
    ],
    [
      "a move whose target names a field",
      { op: "move", target: "probe.a.name", parent: null, after: null },
      NESTED,
      "names a field",
    ],
  ];

  for (const [name, change, shape, detail] of cases) {
    test(name, () => {
      const sent = shape === FLAT ? flat() : nested();
      const first = shape === FLAT ? "probe.r1.name" : "probe.c.name";
      const ok: ElementChange = { op: "set", target: first, value: "renamed" };
      const call = () => applyElementChanges(ITEM, sent, [ok, change], shape);
      expect(call).toThrow(`the change 2 (${change.op} "${change.target}") does not apply`);
      expect(call).toThrow(detail);
    });
  }
});

describe("a field named __proto__", () => {
  test("stays a field, in the diff and in what applying it gives", () => {
    const sent = JSON.parse('{"rows":[{"id":"r1","__proto__":{"a":1}}]}');
    const edited = JSON.parse('{"rows":[{"id":"r1","__proto__":{"a":2}}]}');
    const changes = elementChanges(ITEM, sent, edited, FLAT);
    expect(changes).toEqual([{ op: "set", target: "probe.r1.__proto__", value: { a: 2 } }]);
    const [row] = list(applyElementChanges(ITEM, sent, changes, FLAT), "rows");
    expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
    expect(Object.hasOwn(row ?? {}, "__proto__")).toBe(true);
    expect(roundTrip(sent, edited, FLAT)).toEqual(edited);
  });
});

describe("values the diff cannot address", () => {
  test("props without a list of elements fail, naming the key", () => {
    expect(() => elementChanges(ITEM, {}, nested(), NESTED)).toThrow('"parts"');
    expect(() => applyElementChanges(ITEM, { parts: {} }, [], NESTED)).toThrow('"parts"');
  });

  test("an element without a string ID fails", () => {
    const edited = edit(nested(), (copy) => {
      list(copy, "parts").push({ name: "No ID" } as unknown as Element);
    });
    expect(() => elementChanges(ITEM, nested(), edited, NESTED)).toThrow("ID");
  });

  test("one ID twice in a value fails, naming it", () => {
    const edited = edit(nested(), (copy) => {
      kids(copy, "b").push({ id: "a1", name: "Again" });
    });
    expect(() => elementChanges(ITEM, nested(), edited, NESTED)).toThrow('"a1"');
  });

  test("children that are not a list fail, naming the element", () => {
    const edited = edit(nested(), (copy) => {
      at(copy, "c").subparts = "none";
    });
    expect(() => elementChanges(ITEM, nested(), edited, NESTED)).toThrow('"c"');
  });
});

describe("inputs untouched, outputs frozen", () => {
  test("the diff leaves its inputs as they were and freezes every operation", () => {
    const sent = deepFreeze(nested());
    const edited = deepFreeze(
      edit(nested(), (copy) => {
        at(copy, "a3").tags = ["x", "y"];
        list(copy, "parts").push({ id: "u-1", name: "New", tags: ["n"] });
      }),
    );
    const before = structuredClone([sent, edited]);
    const changes = elementChanges(ITEM, sent, edited, NESTED);
    expect([sent, edited]).toEqual(before);
    expect(changes).toHaveLength(2);
    expect(deeplyFrozen(changes)).toBe(true);
  });

  test("applying leaves its inputs as they were and returns a frozen value", () => {
    const sent = deepFreeze(nested());
    const changes = deepFreeze<ElementChange[]>([
      { op: "set", target: "probe.a3.tags", value: ["x", "y"] },
      { op: "add", target: "probe.u-1", parent: "b", after: null, value: { meta: { k: 1 } } },
      { op: "move", target: "probe.a1", parent: null, after: "c" },
      { op: "set", target: "probe.c.meta", value: null },
      { op: "remove", target: "probe.b1" },
    ]);
    const before = structuredClone([sent, changes]);
    const applied = applyElementChanges(ITEM, sent, changes, NESTED);
    expect([sent, changes]).toEqual(before);
    expect(deeplyFrozen(applied)).toBe(true);
    expect(at(applied, "u-1")).toEqual({ id: "u-1", meta: { k: 1 } });
    expect(at(applied, "c")).toEqual({ id: "c", name: "C" });
  });
});

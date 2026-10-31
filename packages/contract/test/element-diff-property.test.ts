import { describe, expect, test } from "bun:test";
import {
  applyElementChanges,
  type ElementChange,
  type ElementShape,
  elementChanges,
} from "../src/index.ts";

// A seeded property test of the generic element diff (design decision 3): for random edit
// sequences on test-only `probe` values, applying the diff in order to the sent value gives the
// edited value. A failing seed is reported, so its run can be replayed.
const ITEM = "probe";
const NESTED: ElementShape = { elements: "parts", children: "subparts" };
const FLAT: ElementShape = { elements: "rows" };
const RUNS = 500;

type Element = { id: string; [key: string]: unknown };
type Value = Record<string, unknown>;

// mulberry32, a small seeded generator.
const generator = (seed: number) => {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (count: number): number => Math.floor(next() * count);
  const pick = <T>(items: readonly T[]): T => items[int(items.length)] as T;
  return { int, pick };
};
type Random = ReturnType<typeof generator>;

// Each shape's fields: a text, a number, an array field and an object field.
const fieldNames = (shape: ElementShape) => [
  "name",
  "size",
  shape.children === undefined ? "links" : "tags",
  "meta",
];

const randomField = (random: Random, field: string): unknown => {
  if (field === "name") return `n${random.int(4)}`;
  if (field === "size") return random.int(4);
  if (field === "meta") return random.int(2) === 0 ? { a: random.int(2) } : { a: 1, b: [1] };
  return Array.from({ length: random.int(3) }, () => `t${random.int(3)}`);
};

const randomFields = (random: Random, shape: ElementShape): Record<string, unknown> =>
  Object.fromEntries(
    fieldNames(shape)
      .filter((field) => field === "name" || random.int(2) === 0)
      .map((field) => [field, randomField(random, field)]),
  );

const randomList = (
  random: Random,
  shape: ElementShape,
  depth: number,
  nextId: () => string,
): Element[] =>
  Array.from({ length: random.int(depth === 0 ? 7 : 4) }, () => {
    const element: Element = { id: nextId(), ...randomFields(random, shape) };
    if (shape.children !== undefined && depth < 3 && random.int(2) === 0) {
      const children = randomList(random, shape, depth + 1, nextId);
      if (children.length > 0) element[shape.children] = children;
    }
    return element;
  });

type Place = { readonly element: Element; readonly list: Element[]; readonly parent?: Element };

// Every element with the list that holds it and its parent, in document order.
const places = (value: Value, shape: ElementShape): Place[] => {
  const found: Place[] = [];
  const walk = (list: Element[], parent?: Element) => {
    for (const element of list) {
      found.push({ element, list, ...(parent === undefined ? {} : { parent }) });
      const children = shape.children === undefined ? undefined : element[shape.children];
      if (Array.isArray(children)) walk(children, element);
    }
  };
  walk(value[shape.elements] as Element[]);
  return found;
};

// Takes an element and its subtree out; an emptied children list goes with it, as a leaf holds none.
const detach = ({ element, list, parent }: Place, shape: ElementShape): void => {
  list.splice(list.indexOf(element), 1);
  if (parent !== undefined && list.length === 0) delete parent[shape.children as string];
};

const insert = (value: Value, shape: ElementShape, random: Random, element: Element): void => {
  const parents = shape.children === undefined ? [] : places(value, shape);
  const parent = parents.length > 0 && random.int(3) > 0 ? random.pick(parents).element : undefined;
  let list = value[shape.elements] as Element[];
  if (parent !== undefined) {
    const key = shape.children as string;
    parent[key] ??= [];
    list = parent[key] as Element[];
  }
  list.splice(random.int(list.length + 1), 0, element);
};

type Edit = (value: Value, shape: ElementShape, random: Random, nextId: () => string) => void;

const EDITS: Record<string, Edit> = {
  add: (value, shape, random, nextId) =>
    insert(value, shape, random, { id: nextId(), ...randomFields(random, shape) }),
  remove: (value, shape, random) => {
    const all = places(value, shape);
    if (all.length > 0) detach(random.pick(all), shape);
  },
  move: (value, shape, random) => {
    const all = places(value, shape);
    if (all.length === 0) return;
    const place = random.pick(all);
    detach(place, shape);
    insert(value, shape, random, place.element);
  },
  set: (value, shape, random) => {
    const all = places(value, shape);
    if (all.length === 0) return;
    const { element } = random.pick(all);
    const field = random.pick(fieldNames(shape));
    const choice = random.int(3);
    if (choice === 0) delete element[field];
    else if (choice === 1) element[field] = randomField(random, field);
    else if (element[field] !== undefined) element[field] = structuredClone(element[field]);
  },
  // The same element with its keys in another order: no change at all.
  reorder: (value, shape, random) => {
    const all = places(value, shape);
    if (all.length === 0) return;
    const { element, list } = random.pick(all);
    const reordered = Object.fromEntries(Object.entries(element).reverse()) as Element;
    list.splice(list.indexOf(element), 1, reordered);
  },
};

type Run = { readonly sent: Value; readonly edited: Value };

const randomRun = (seed: number, shape: ElementShape): Run => {
  const random = generator(seed);
  let sentIds = 0;
  let viewIds = 0;
  const sent = {
    title: `run ${seed}`,
    [shape.elements]: randomList(random, shape, 0, () => `e${++sentIds}`),
  };
  const edited = structuredClone(sent);
  const steps = 1 + random.int(8);
  for (let step = 0; step < steps; step += 1) {
    const edit = EDITS[random.pick(Object.keys(EDITS))] as Edit;
    edit(edited, shape, random, () => `u-${++viewIds}`);
  }
  return { sent, edited };
};

const checkRuns = (shape: ElementShape) => {
  const failures: string[] = [];
  const counts: Record<string, number> = { add: 0, remove: 0, move: 0, set: 0 };
  for (let seed = 1; seed <= RUNS; seed += 1) {
    const { sent, edited } = randomRun(seed, shape);
    try {
      const changes: readonly ElementChange[] = elementChanges(ITEM, sent, edited, shape);
      for (const change of changes) counts[change.op] = (counts[change.op] ?? 0) + 1;
      const applied = applyElementChanges(ITEM, sent, changes, shape);
      if (!Bun.deepEquals(applied, edited, true)) failures.push(`seed ${seed}: not rebuilt`);
      if (elementChanges(ITEM, edited, structuredClone(edited), shape).length > 0) {
        failures.push(`seed ${seed}: changes for an equal value`);
      }
      const placed = changes.filter((change) => change.op === "add" || change.op === "move");
      if (shape.children === undefined && placed.some((change) => change.parent !== null)) {
        failures.push(`seed ${seed}: a parent in a flat list`);
      }
    } catch (error) {
      failures.push(`seed ${seed}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { failures, counts };
};

describe(`applying the diff in order rebuilds the edited value (${RUNS} seeded runs per shape)`, () => {
  for (const [name, shape] of [
    ["a nested shape", NESTED],
    ["a flat shape with an array field", FLAT],
  ] as const) {
    test(name, () => {
      const { failures, counts } = checkRuns(shape);
      expect(failures).toEqual([]);
      // Every operation kind occurs often enough for the runs to mean something.
      for (const op of ["add", "remove", "move", "set"]) {
        expect({ op, enough: (counts[op] ?? 0) >= 100 }).toEqual({ op, enough: true });
      }
    });
  }
});

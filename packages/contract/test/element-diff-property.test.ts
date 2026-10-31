import { describe, expect, test } from "bun:test";
import {
  applyElementChanges,
  type Change,
  type ElementShape,
  elementChanges,
  SCHEMA_IDS,
} from "../src/index.ts";
import { validateAgainst } from "../src/validate.ts";

// A seeded property test of the generic element diff (design decision 3): for random edit
// sequences on test-only `probe` values, every operation is one of the output format's changes,
// and applying the diff in order to the sent value gives the edited value. A failing seed is
// reported, so its run can be replayed.
type ListShape = Extract<ElementShape, { readonly keyed?: false }>;

const ITEM = "probe";
const NESTED: ListShape = { elements: "parts", children: "subparts" };
const FLAT: ListShape = { elements: "rows" };
const KEYED: ElementShape = { elements: "plan", keyed: true };
const RUNS = 500;
const CHANGE = `${SCHEMA_IDS.answerEvent}#/$defs/change`;

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
const fieldNames = (shape: ListShape) => [
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

const randomFields = (random: Random, shape: ListShape): Record<string, unknown> =>
  Object.fromEntries(
    fieldNames(shape)
      .filter((field) => field === "name" || random.int(2) === 0)
      .map((field) => [field, randomField(random, field)]),
  );

const randomList = (
  random: Random,
  shape: ListShape,
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
const places = (value: Value, shape: ListShape): Place[] => {
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
const detach = ({ element, list, parent }: Place, shape: ListShape): void => {
  list.splice(list.indexOf(element), 1);
  if (parent !== undefined && list.length === 0) delete parent[shape.children as string];
};

const insert = (value: Value, shape: ListShape, random: Random, element: Element): void => {
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

type Edit = (value: Value, shape: ListShape, random: Random, nextId: () => string) => void;

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

const randomRun = (seed: number, shape: ListShape): Run => {
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

// A keyed shape's entries: at least one field each, never null, since an empty entry or a null
// field reads as absent; an edit that empties an entry takes it away.
type Entries = Record<string, Record<string, unknown>>;
const KEYED_FIELDS = ["links", "start"];

const keyedField = (random: Random, field: string): unknown =>
  field === "start"
    ? random.int(4)
    : Array.from({ length: random.int(3) }, () => `t${random.int(3)}`);

const randomEntry = (random: Random): Record<string, unknown> => {
  const fields = KEYED_FIELDS.filter(() => random.int(2) === 0);
  const kept = fields.length > 0 ? fields : [random.pick(KEYED_FIELDS)];
  return Object.fromEntries(kept.map((field) => [field, keyedField(random, field)]));
};

const reversed = (object: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(object).reverse());

type KeyedEdit = (value: Value, random: Random, nextId: () => string) => void;

const KEYED_EDITS: Record<string, KeyedEdit> = {
  add: (value, random, nextId) => {
    (value.plan as Entries)[nextId()] = randomEntry(random);
  },
  remove: (value, random) => {
    const plan = value.plan as Entries;
    const ids = Object.keys(plan);
    if (ids.length > 0) delete plan[random.pick(ids)];
  },
  set: (value, random) => {
    const plan = value.plan as Entries;
    const ids = Object.keys(plan);
    if (ids.length === 0) return;
    const id = random.pick(ids);
    const entry = plan[id] as Record<string, unknown>;
    const field = random.pick(KEYED_FIELDS);
    const choice = random.int(3);
    if (choice === 1) entry[field] = keyedField(random, field);
    else if (choice === 2 && entry[field] !== undefined)
      entry[field] = structuredClone(entry[field]);
    else if (choice === 0) {
      delete entry[field];
      if (Object.keys(entry).length === 0) delete plan[id];
    }
  },
  // The same entries and fields in another order: no change at all.
  reorder: (value) => {
    const plan = value.plan as Entries;
    value.plan = Object.fromEntries(
      Object.entries(plan)
        .reverse()
        .map(([id, e]) => [id, reversed(e)]),
    );
  },
};

const randomKeyedRun = (seed: number): Run => {
  const random = generator(seed);
  let sentIds = 0;
  let viewIds = 0;
  const entries = Array.from({ length: random.int(7) }, () => [
    `t${++sentIds}`,
    randomEntry(random),
  ]);
  const sent = { title: `run ${seed}`, plan: Object.fromEntries(entries) };
  const edited = structuredClone(sent);
  const steps = 1 + random.int(8);
  for (let step = 0; step < steps; step += 1) {
    const edit = KEYED_EDITS[random.pick(Object.keys(KEYED_EDITS))] as KeyedEdit;
    edit(edited, random, () => `u-${++viewIds}`);
  }
  return { sent, edited };
};

// What the output format refuses in an operation, and an omitted position held as `undefined`.
const refusalOf = (change: Change): string | undefined => {
  const checked = validateAgainst(CHANGE, change);
  if (!checked.ok) return checked.problems.map(({ path, message }) => `${path} ${message}`).join();
  const held = Object.entries(change).find(([, value]) => value === undefined);
  return held === undefined ? undefined : `"${held[0]}" holds undefined`;
};

const checkRuns = (shape: ElementShape, run: (seed: number) => Run) => {
  const failures: string[] = [];
  const counts: Record<string, number> = { add: 0, remove: 0, move: 0, set: 0 };
  for (let seed = 1; seed <= RUNS; seed += 1) {
    const { sent, edited } = run(seed);
    try {
      const changes: readonly Change[] = elementChanges(ITEM, sent, edited, shape);
      for (const change of changes) {
        counts[change.op] = (counts[change.op] ?? 0) + 1;
        const refusal = refusalOf(change);
        if (refusal !== undefined) failures.push(`seed ${seed}: ${change.target}: ${refusal}`);
      }
      const applied = applyElementChanges(ITEM, sent, changes, shape);
      if (!Bun.deepEquals(applied, edited, true)) failures.push(`seed ${seed}: not rebuilt`);
      if (elementChanges(ITEM, edited, structuredClone(edited), shape).length > 0) {
        failures.push(`seed ${seed}: changes for an equal value`);
      }
      const placed = changes.filter((change) => change.op === "add" || change.op === "move");
      const flat = shape.keyed !== true && shape.children === undefined;
      if (flat && placed.some((change) => Object.hasOwn(change, "parent"))) {
        failures.push(`seed ${seed}: a parent in a flat list`);
      }
      if (shape.keyed === true && changes.some((change) => change.op !== "set")) {
        failures.push(`seed ${seed}: an operation other than set for a keyed shape`);
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
      const { failures, counts } = checkRuns(shape, (seed) => randomRun(seed, shape));
      expect(failures).toEqual([]);
      // Every operation kind occurs often enough for the runs to mean something.
      for (const op of ["add", "remove", "move", "set"]) {
        expect({ op, enough: (counts[op] ?? 0) >= 100 }).toEqual({ op, enough: true });
      }
    });
  }

  test("a keyed shape with an array field and a scalar field", () => {
    const { failures, counts } = checkRuns(KEYED, randomKeyedRun);
    expect(failures).toEqual([]);
    expect(counts).toMatchObject({ add: 0, remove: 0, move: 0 });
    expect(counts.set ?? 0).toBeGreaterThanOrEqual(500);
  });
});

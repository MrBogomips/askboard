// AD-20's generic diff (design decision 3): an item's `changes`, from its props as sent and as
// edited, for elements that are objects keyed by `id`, in a flat list or a tree. A widget declares
// only its shape; every key of an element but `id` and the children key is a field, compared as a
// JSON value. Elements are addressed by ID, never by position. Plain ECMAScript: `ask-core` calls
// it at run time, and `applyElementChanges`, its inverse, checks it.

/** The props key holding an item's elements and, for a tree, the element key holding children. */
export type ElementShape = { readonly elements: string; readonly children?: string };

/** `parent` and `after` are always given, `null` for the top level and for the first place. */
type Position = { readonly parent: string | null; readonly after: string | null };

/**
 * One operation, its target in AD-13's reference syntax without brackets: `item.element` for
 * `add`, `remove` and `move`, `item.element.field` for `set`. An `add` holds the element's fields
 * without its children; a `set` of `null` empties the field.
 */
export type ElementChange =
  | ({ readonly op: "add"; readonly target: string } & Position & {
        readonly value: Readonly<Record<string, unknown>>;
      })
  | { readonly op: "remove"; readonly target: string }
  | ({ readonly op: "move"; readonly target: string } & Position)
  | { readonly op: "set"; readonly target: string; readonly value: unknown };

type Json = Record<string, unknown>;
type Element = Json & { readonly id: string };

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Deep equality of JSON values: arrays by element, objects by key, whatever the keys' order. */
const jsonEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((x, at) => jsonEqual(x, b[at]));
  }
  if (!isObject(a) || !isObject(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && jsonEqual(a[key], b[key]))
  );
};

// Copies build objects with `fromEntries`, which defines every key, `__proto__` included.
const copyOf = (value: unknown, freeze: boolean): unknown => {
  const done = <T extends object>(copy: T): T => (freeze ? Object.freeze(copy) : copy);
  if (Array.isArray(value)) return done(value.map((inner) => copyOf(inner, freeze)));
  if (!isObject(value)) return value;
  return done(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copyOf(v, freeze)])));
};
const frozenCopy = <T>(value: T): T => copyOf(value, true) as T;
const mutableCopy = <T>(value: T): T => copyOf(value, false) as T;

const quoted = (id: string | null): string => (id === null ? "the top level" : `"${id}"`);

// Visits every element in document order with its parent and place, refusing what the diff
// cannot address: no list of elements, an element without a string ID, an ID twice, children
// that are not a list. An empty children list counts as none.
const visit = (
  props: object,
  shape: ElementShape,
  which: string,
  see: (element: Element, parent: string | null, at: number, siblings: readonly Element[]) => void,
): void => {
  const top = (props as Json)[shape.elements];
  if (!Array.isArray(top)) throw new Error(`the ${which} props hold no list "${shape.elements}"`);
  const seen = new Set<string>();
  const walk = (list: readonly unknown[], parent: string | null): void => {
    list.forEach((element, at) => {
      if (!isObject(element) || typeof element.id !== "string") {
        throw new Error(
          `an element under ${quoted(parent)} of the ${which} value has no string ID`,
        );
      }
      const { id } = element;
      if (seen.has(id)) throw new Error(`the ${which} value holds the ID "${id}" twice`);
      seen.add(id);
      see(element as Element, parent, at, list as Element[]);
      const children = shape.children === undefined ? undefined : element[shape.children];
      if (children === undefined) return;
      if (!Array.isArray(children)) {
        throw new Error(`the children of "${id}" in the ${which} value are not a list`);
      }
      walk(children, id);
    });
  };
  walk(top, null);
};

const fieldsOf = (element: Json, shape: ElementShape): string[] =>
  Object.keys(element).filter((key) => key !== "id" && key !== shape.children);

type Placed = {
  readonly element: Element;
  readonly parent: string | null;
  readonly at: number;
  readonly previous: string | null;
};

// Every element by ID; a `Map` keeps them in document order.
const indexOf = (props: object, shape: ElementShape, which: string): Map<string, Placed> => {
  const index = new Map<string, Placed>();
  visit(props, shape, which, (element, parent, at, siblings) => {
    index.set(element.id, { element, parent, at, previous: siblings[at - 1]?.id ?? null });
  });
  return index;
};

// The places in `values` of one of its longest increasing subsequences (patience sorting).
const longestIncreasing = (values: readonly number[]): Set<number> => {
  const tails: number[] = [];
  const previous: number[] = [];
  values.forEach((value, at) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((values[tails[middle] as number] as number) < value) low = middle + 1;
      else high = middle;
    }
    previous[at] = tails[low - 1] ?? -1;
    tails[low] = at;
  });
  const kept = new Set<number>();
  for (let at = tails.at(-1) ?? -1; at !== -1; at = previous[at] ?? -1) kept.add(at);
  return kept;
};

// The elements that stay: in each edited sibling list, those that keep their parent and form a
// longest subsequence in their sent order. Every other kept element moves.
const stayers = (sent: Map<string, Placed>, edited: Map<string, Placed>): Set<string> => {
  const lists = new Map<string | null, string[]>();
  for (const [id, { parent }] of edited) {
    if (sent.get(id)?.parent !== parent) continue;
    const list = lists.get(parent) ?? [];
    list.push(id);
    lists.set(parent, list);
  }
  const stay = new Set<string>();
  for (const ids of lists.values()) {
    const kept = longestIncreasing(ids.map((id) => sent.get(id)?.at ?? 0));
    ids.forEach((id, at) => {
      if (kept.has(at)) stay.add(id);
    });
  }
  return stay;
};

// A kept element's `set`s, in field-name order (UTF-16 code units), `null` for an emptied field.
const fieldSets = (target: string, sent: Json, edited: Json, shape: ElementShape) =>
  [...new Set([...fieldsOf(sent, shape), ...fieldsOf(edited, shape)])]
    .sort()
    .filter((field) => !(Object.hasOwn(sent, field) && jsonEqual(sent[field], edited[field])))
    .map(
      (field): ElementChange => ({
        op: "set",
        target: `${target}.${field}`,
        value: Object.hasOwn(edited, field) ? edited[field] : null,
      }),
    );

/**
 * The operations that, applied in order to `sent`, give `edited`: for each edited element in
 * document order, its `add` or `move`, then a kept element's `set`s; then one `remove` per
 * removed element whose parent stays, in sent document order. Its inputs stay untouched and its
 * output is frozen.
 */
export const elementChanges = (
  itemId: string,
  sent: object,
  edited: object,
  shape: ElementShape,
): readonly ElementChange[] => {
  const before = indexOf(sent, shape, "sent");
  const after = indexOf(edited, shape, "edited");
  const stay = stayers(before, after);
  const changes: ElementChange[] = [];
  for (const [id, { element, parent, previous }] of after) {
    const target = `${itemId}.${id}`;
    const was = before.get(id);
    if (was === undefined) {
      const value = Object.fromEntries(fieldsOf(element, shape).map((k) => [k, element[k]]));
      changes.push({ op: "add", target, parent, after: previous, value });
      continue;
    }
    if (!stay.has(id)) changes.push({ op: "move", target, parent, after: previous });
    changes.push(...fieldSets(target, was.element, element, shape));
  }
  for (const [id, { parent }] of before) {
    if (!after.has(id) && (parent === null || after.has(parent))) {
      changes.push({ op: "remove", target: `${itemId}.${id}` });
    }
  }
  return frozenCopy(changes);
};

// The mutable elements `applyElementChanges` works on, by ID with each one's parent.
class Placement {
  private readonly parents = new Map<string, string | null>();
  private readonly elements = new Map<string, Json>();

  constructor(
    private readonly top: Json[],
    private readonly shape: ElementShape,
  ) {
    visit({ [shape.elements]: top }, shape, "sent", (element, parent) => {
      this.elements.set(element.id, element);
      this.parents.set(element.id, parent);
    });
  }

  element(id: string): Json {
    const element = this.elements.get(id);
    if (element === undefined) throw new Error(`there is no element "${id}"`);
    return element;
  }

  has(id: string): boolean {
    return this.elements.has(id);
  }

  private listOf(parent: string | null): Json[] {
    if (parent === null) return this.top;
    const element = this.element(parent);
    const key = this.shape.children as string;
    if (!Array.isArray(element[key])) element[key] = [];
    return element[key] as Json[];
  }

  /** Puts an element in its parent's list right after `after`, or first. */
  place(id: string, element: Json, { parent, after }: Position): void {
    if (parent !== null && this.shape.children === undefined) {
      throw new Error("a flat list has no parent");
    }
    for (let up = parent; up !== null; up = this.parents.get(up) ?? null) {
      if (up === id) throw new Error(`"${id}" cannot move into its own subtree`);
      this.element(up);
    }
    const list = this.listOf(parent);
    const at = after === null ? 0 : list.findIndex((sibling) => sibling.id === after) + 1;
    if (at === 0 && after !== null) {
      throw new Error(`"${after}" is not a child of ${quoted(parent)}`);
    }
    list.splice(at, 0, element);
    this.elements.set(id, element);
    this.parents.set(id, parent);
  }

  /** Takes an element and its subtree out; a list left empty goes with it. */
  detach(id: string): Json {
    const element = this.element(id);
    const parent = this.parents.get(id) ?? null;
    const list = this.listOf(parent);
    list.splice(list.indexOf(element), 1);
    if (parent !== null && list.length === 0) {
      delete this.element(parent)[this.shape.children as string];
    }
    return element;
  }

  forget(element: Json): void {
    this.elements.delete(element.id as string);
    this.parents.delete(element.id as string);
    const children = this.shape.children === undefined ? undefined : element[this.shape.children];
    if (Array.isArray(children)) for (const child of children) this.forget(child);
  }
}

const isPlace = (id: unknown): id is string | null => typeof id === "string" || id === null;

const positionOf = ({ parent, after }: Json): Position => {
  if (!isPlace(parent)) throw new Error("its parent is not an ID or null");
  if (!isPlace(after)) throw new Error("its after is not an ID or null");
  return { parent, after };
};

// The element and, for a `set`, the field a target names, which must address this item.
const addressOf = (itemId: string, target: unknown, field: boolean): [string, string] => {
  const prefix = `${itemId}.`;
  if (typeof target !== "string" || !target.startsWith(prefix)) {
    throw new Error(`its target addresses another item than "${itemId}"`);
  }
  const rest = target.slice(prefix.length);
  const dot = rest.indexOf(".");
  if (field && dot <= 0) throw new Error("its target names no field");
  if (!field && dot !== -1) throw new Error("its target names a field");
  return field ? [rest.slice(0, dot), rest.slice(dot + 1)] : [rest, ""];
};

const applyOne = (placement: Placement, itemId: string, change: Json, shape: ElementShape) => {
  const reserved = (key: string) => key === "id" || key === shape.children;
  switch (change.op) {
    case "add": {
      const [id] = addressOf(itemId, change.target, false);
      if (placement.has(id)) throw new Error(`the element "${id}" is there already`);
      const { value } = change;
      if (!isObject(value)) throw new Error("its value is not an object");
      const held = Object.keys(value).find(reserved);
      if (held !== undefined) throw new Error(`its value holds "${held}"`);
      placement.place(id, { id, ...mutableCopy(value) }, positionOf(change));
      return;
    }
    case "move": {
      const [id] = addressOf(itemId, change.target, false);
      const position = positionOf(change);
      placement.place(id, placement.detach(id), position);
      return;
    }
    case "remove": {
      const [id] = addressOf(itemId, change.target, false);
      placement.forget(placement.detach(id));
      return;
    }
    case "set": {
      const [id, field] = addressOf(itemId, change.target, true);
      if (reserved(field)) throw new Error(`"${field}" is not a field`);
      const element = placement.element(id);
      if (change.value === null) {
        delete element[field];
        return;
      }
      // Defined, not assigned, so that a field named `__proto__` stays a field.
      Object.defineProperty(element, field, {
        value: mutableCopy(change.value),
        writable: true,
        enumerable: true,
        configurable: true,
      });
      return;
    }
    default:
      throw new Error(`"${String(change.op)}" is not an operation`);
  }
};

/**
 * Applies `changes` in order to `sent`: the inverse of `elementChanges`. The props' other keys
 * are kept; an element whose last child leaves holds no children list. Throws, naming the
 * operation, on one that does not apply. Its inputs stay untouched and its output is frozen.
 */
export const applyElementChanges = <P extends object>(
  itemId: string,
  sent: P,
  changes: readonly ElementChange[],
  shape: ElementShape,
): P => {
  const props = mutableCopy(sent) as Json;
  const top = props[shape.elements];
  if (!Array.isArray(top)) throw new Error(`the sent props hold no list "${shape.elements}"`);
  const placement = new Placement(top, shape);
  changes.forEach((change, at) => {
    try {
      applyOne(placement, itemId, change as Json, shape);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `the change ${at + 1} (${change.op} "${change.target}") does not apply: ${reason}`,
      );
    }
  });
  return frozenCopy(props) as P;
};

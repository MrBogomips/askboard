// The walker of layouts (layouts, design decision 2): the one place that knows which items a
// layout holds. Plain ECMAScript over plain items: it imports no JSON and no registry, so the
// shell, the board page and `ask-core` may all import it (AD-1). Every walk keeps an explicit
// stack, so no depth of input throws, and every read is of an own property, so a key such as
// `__proto__` or `constructor` in a layout's props is data.

export const LAYOUT_TYPES = ["stack", "row", "group", "tabs"] as const;

export type LayoutType = (typeof LAYOUT_TYPES)[number];

/** The most layouts a question's items nest, one inside another. */
export const LAYOUT_MAX_DEPTH = 4;

export const isLayoutType = (type: unknown): type is LayoutType =>
  typeof type === "string" && (LAYOUT_TYPES as readonly string[]).includes(type);

/** A list of items a layout holds, with its path from the layout item (`props/items`). */
export type LayoutList = {
  readonly path: readonly string[];
  readonly items: readonly unknown[];
};

/** An item the walk reached: its path from the start, and how many layouts enclose it. */
export type NestedItem = {
  readonly item: unknown;
  readonly path: readonly string[];
  readonly depth: number;
};

export type LayoutDepthProblem = {
  readonly item: unknown;
  readonly path: readonly string[];
  /** The layouts from the question down to this one, itself included. */
  readonly depth: number;
};

type Dictionary = { readonly [key: string]: unknown };

const isDictionary = (value: unknown): value is Dictionary =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const own = (record: Dictionary, key: string): unknown =>
  Object.hasOwn(record, key) ? record[key] : undefined;

/**
 * Each list of items a layout holds, with its path from the item: `props/items`, or
 * `props/tabs/<t>/items` for each tab of a Tabs. Nothing for any other type, so a Ranking's
 * elements and an area's questions are never walked.
 */
export const layoutListsOf = (item: unknown): readonly LayoutList[] => {
  if (!isDictionary(item) || !isLayoutType(own(item, "type"))) return [];
  const props = own(item, "props");
  if (!isDictionary(props)) return [];
  if (own(item, "type") !== "tabs") {
    const items = own(props, "items");
    return Array.isArray(items) ? [{ path: ["props", "items"], items }] : [];
  }
  const panels = own(props, "tabs");
  if (!Array.isArray(panels)) return [];
  return panels.flatMap((panel: unknown, at): LayoutList[] => {
    const items = isDictionary(panel) ? own(panel, "items") : undefined;
    return Array.isArray(items) ? [{ path: ["props", "tabs", String(at), "items"], items }] : [];
  });
};

// The items of a list as walk entries, pushed so that the first is popped first.
const pushList = (
  stack: NestedItem[],
  items: readonly unknown[],
  at: readonly string[],
  depth: number,
): void => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    stack.push({ item: items[index], path: [...at, String(index)], depth });
  }
};

// The walk entry's children, last first, ready for the stack.
const pushChildren = (stack: NestedItem[], { item, path, depth }: NestedItem): void => {
  const lists = layoutListsOf(item);
  for (let at = lists.length - 1; at >= 0; at -= 1) {
    const list = lists[at];
    if (list !== undefined) pushList(stack, list.items, [...path, ...list.path], depth + 1);
  }
};

/**
 * Every item of a question's items at every depth, depth first in document order, layouts
 * included, each with its path from `at` and the number of layouts that enclose it.
 */
export const nestedItemsOf = (
  items: readonly unknown[],
  at: readonly string[] = [],
): NestedItem[] => {
  const found: NestedItem[] = [];
  const stack: NestedItem[] = [];
  pushList(stack, items, at, 0);
  for (let entry = stack.pop(); entry !== undefined; entry = stack.pop()) {
    found.push(entry);
    pushChildren(stack, entry);
  }
  return found;
};

/**
 * The first layout, in document order, that sits more than `LAYOUT_MAX_DEPTH` layouts deep, with
 * its path from `at`. The walk stops there, so a request nested without end, or an object that
 * holds itself, gets this answer and never an exception.
 */
export const layoutDepthProblem = (
  items: readonly unknown[],
  at: readonly string[] = [],
): LayoutDepthProblem | undefined => {
  const stack: NestedItem[] = [];
  pushList(stack, items, at, 0);
  for (let entry = stack.pop(); entry !== undefined; entry = stack.pop()) {
    if (isLayoutType(isDictionary(entry.item) ? own(entry.item, "type") : undefined)) {
      if (entry.depth + 1 > LAYOUT_MAX_DEPTH) {
        return { item: entry.item, path: entry.path, depth: entry.depth + 1 };
      }
    }
    pushChildren(stack, entry);
  }
  return undefined;
};

// A copy of the layout with the list at `path` replaced.
const withList = (item: Dictionary, path: readonly string[], items: readonly unknown[]) => {
  const props = own(item, "props") as Dictionary;
  if (path.length === 2) return { ...item, props: { ...props, items } };
  const panels = [...(own(props, "tabs") as readonly unknown[])];
  const at = Number(path[2]);
  panels[at] = { ...(panels[at] as Dictionary), items };
  return { ...item, props: { ...props, tabs: panels } };
};

type Owner = {
  readonly item: unknown;
  readonly lists: readonly LayoutList[];
  readonly mapped: (readonly unknown[])[];
  readonly parent: Frame;
};

type Frame = {
  readonly source: readonly unknown[];
  readonly out: unknown[];
  readonly owner: Owner | undefined;
  at: number;
};

const frameOf = (source: readonly unknown[], owner?: Owner): Frame => ({
  source,
  out: [],
  owner,
  at: 0,
});

// The layout rebuilt around its mapped lists, then mapped itself, into its parent's list.
const closeOwner = (owner: Owner, map: (item: unknown) => unknown): void => {
  let rebuilt = owner.item;
  owner.lists.forEach((list, index) => {
    rebuilt = withList(rebuilt as Dictionary, list.path, owner.mapped[index] ?? []);
  });
  owner.parent.out.push(map(rebuilt));
  owner.parent.at += 1;
};

/**
 * A new list with every item at every depth replaced by `map(item)`, each layout rebuilt around
 * its mapped items before `map` sees it. Nothing it is given is changed.
 */
export const mapNestedItems = (
  items: readonly unknown[],
  map: (item: unknown) => unknown,
): unknown[] => {
  const stack: Frame[] = [frameOf(items)];
  for (;;) {
    const frame = stack[stack.length - 1] as Frame;
    if (frame.at < frame.source.length) {
      const item = frame.source[frame.at];
      const lists = layoutListsOf(item);
      if (lists.length === 0) {
        frame.out.push(map(item));
        frame.at += 1;
        continue;
      }
      const owner: Owner = { item, lists, mapped: [], parent: frame };
      stack.push(frameOf((lists[0] as LayoutList).items, owner));
      continue;
    }
    stack.pop();
    const { owner } = frame;
    if (owner === undefined) return frame.out;
    owner.mapped.push(frame.out);
    const next = owner.lists[owner.mapped.length];
    if (next === undefined) closeOwner(owner, map);
    else stack.push(frameOf(next.items, owner));
  }
};

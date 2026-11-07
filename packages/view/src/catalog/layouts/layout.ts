// What the layout chunks share (layouts, design decisions 6 and 7): the items a layout holds, read
// from its props, and the renderer the shell gives it. A layout draws no item itself: each item of
// its list goes through `renderItem`, which gives the item its own frame, boundary, draft, result
// and entry. A layout whose props hold no list of items, or that has no `renderItem`, throws, which
// shows its error state and fails its question (AD-9, AD-10). No folder here holds an `index.tsx`,
// so it is no chunk; each layout chunk bundles what it imports.

import type { BoardWidgetItem, ItemProps } from "../port.ts";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isItem = (value: unknown): value is BoardWidgetItem =>
  isRecord(value) && typeof value.id === "string" && typeof value.type === "string";

/** The items in `list`, each `{type, id, props}`; an error naming the layout when it is no such list. */
export const itemsIn = (
  noun: string,
  itemId: string,
  list: unknown,
): readonly BoardWidgetItem[] => {
  if (!Array.isArray(list) || !list.every(isItem)) {
    throw new Error(`the ${noun} "${itemId}" holds no list of items`);
  }
  return list;
};

/** The item list of a Stack, a Row or a Group: `props.items`. */
export const itemsOf = (noun: string, itemId: string, props: unknown): readonly BoardWidgetItem[] =>
  itemsIn(noun, itemId, isRecord(props) && Object.hasOwn(props, "items") ? props.items : undefined);

/** The renderer the shell gives the layout, or an error: a layout cannot draw its items without it. */
export const rendererOf = (
  noun: string,
  itemId: string,
  renderItem: ItemProps["renderItem"],
): NonNullable<ItemProps["renderItem"]> => {
  if (renderItem === undefined) {
    throw new Error(`the ${noun} "${itemId}" has no renderer for the items it holds`);
  }
  return renderItem;
};

/** A prop of the layout as text, when it is a string. */
export const textOf = (props: unknown, key: string): string | undefined => {
  if (!isRecord(props) || !Object.hasOwn(props, key)) return undefined;
  const value = props[key];
  return typeof value === "string" ? value : undefined;
};

export { isRecord };

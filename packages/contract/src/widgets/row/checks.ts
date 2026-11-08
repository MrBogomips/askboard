// The Row's rule that its schema cannot say (layouts, design decision 4): each key of `widths`
// names an item of the Row. Plain ECMAScript with no JSON and no Ajv. Keys are read as own
// properties and looked up in a set, so an inherited name such as `constructor` or `__proto__`
// names no item unless the Row holds one of that ID. Nothing here throws on a value it cannot read.

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";

// The IDs of the items the props hold, in a set; empty when they hold no list.
const itemIdsOf = (props: Record<string, unknown>): ReadonlySet<string> => {
  const items = Object.hasOwn(props, "items") ? props.items : undefined;
  if (!Array.isArray(items)) return new Set();
  return new Set(
    items.flatMap((item) => (isRecord(item) && typeof item.id === "string" ? [item.id] : [])),
  );
};

/** What a schema-valid Row's props still get wrong: a width keyed by no item of the Row. */
export const rowPropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props) || !Object.hasOwn(props, "widths")) return [];
  const { widths } = props;
  if (!isRecord(widths)) return [];
  const ids = itemIdsOf(props);
  return Object.keys(widths)
    .filter((key) => !ids.has(key))
    .map((key) => ({
      path: `/widths/${key}`,
      message: `the width for "${key}" names no item of the Row: key each weight by the ID of one of its items`,
    }));
};

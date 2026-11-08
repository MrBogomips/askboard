// Whether an edited value belongs to the Table as a revision shows it (design decision 9; security
// review X-2 of latex-kanban-timeline): its columns, `label` and `fixedRows` equal the props', and
// every row and cell passes the contract's one check as an edited value's. The shell keeps a draft
// across an agent's change only while this says true, its cell entries with it; the component
// refuses a value that does not fit, so an answer sends what the Table shows (AD-10, AD-20).
// Plain functions; a key named `__proto__` or `constructor` is only data.

import { type TableProps, tablePropsProblems } from "@askboard/contract";

// Structural equality of two JSON values, the order of an object's keys apart.
const sameJson = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, at) => sameJson(item, b[at]));
  }
  const left = Object.entries(a);
  const right = Object.keys(b);
  return (
    left.length === right.length &&
    left.every(([key, item]) => Object.hasOwn(b, key) && sameJson(item, (b as never)[key]))
  );
};

const member = (props: unknown, key: string): unknown =>
  typeof props === "object" && props !== null && Object.hasOwn(props, key)
    ? (props as Record<string, unknown>)[key]
    : undefined;

/** Whether `value` is an edited value of a Table whose props are `props`. */
export const tableValueFits = (value: unknown, props: unknown): boolean =>
  ["columns", "label", "fixedRows"].every((key) =>
    sameJson(member(value, key), member(props, key)),
  ) && tablePropsProblems(value as TableProps, "edited").length === 0;

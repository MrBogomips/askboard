// The Ranking's rules that its schemas cannot say (approval-scale-ranking, design decision 1): the
// element IDs unique within the item, and, of a result, that its order names each of the item's
// elements exactly once, none the item does not hold.
//
// Plain ECMAScript with no JSON and no Ajv: the ranking chunk bundles it. Nothing here throws on a
// value it cannot read: the props check gives no problem for what the schema refuses, and the
// result check refuses a result it has no readable props to check against (AD-10).

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";

// The element IDs of the props, in order; undefined when the props hold no list of them.
const idsOf = (props: unknown): readonly string[] | undefined => {
  const items = isRecord(props) ? props.items : undefined;
  if (!Array.isArray(items)) return undefined;
  return items.flatMap((element) =>
    isRecord(element) && typeof element.id === "string" ? [element.id] : [],
  );
};

/** What a schema-valid Ranking's props still get wrong: an element ID held twice. */
export const rankingPropsProblems = (props: unknown): readonly Problem[] => {
  const items = isRecord(props) && Array.isArray(props.items) ? props.items : [];
  const seen = new Set<string>();
  const problems: Problem[] = [];
  items.forEach((element, index) => {
    const id = isRecord(element) ? element.id : undefined;
    if (typeof id !== "string") return;
    if (seen.has(id)) {
      problems.push({
        path: `/items/${index}/id`,
        message: `the ID "${id}" is held twice: each element of a Ranking has an ID of its own`,
      });
    }
    seen.add(id);
  });
  return problems;
};

/**
 * What a schema-valid Ranking result still gets wrong against the item's props: an element the
 * item holds that the order leaves out, one it does not hold, and one it names twice. Props that
 * hold no elements refuse the result, since nothing can check it.
 */
export const rankingResultProblems = (result: unknown, props: unknown): readonly Problem[] => {
  const ids = idsOf(props);
  if (ids === undefined) {
    return [
      { path: "/", message: "the item's props are no Ranking's, so its order cannot be checked" },
    ];
  }
  const order = isRecord(result) && Array.isArray(result.order) ? result.order : [];
  const held = new Set(ids);
  const seen = new Set<string>();
  const problems: Problem[] = [];
  order.forEach((id, index) => {
    if (typeof id !== "string") return;
    const path = `/order/${index}`;
    if (!held.has(id)) {
      problems.push({
        path,
        message: `the order names element "${id}", which the item does not hold`,
      });
    } else if (seen.has(id)) {
      problems.push({ path, message: `the order names element "${id}" twice` });
    }
    seen.add(id);
  });
  for (const id of held) {
    if (!seen.has(id))
      problems.push({ path: "/order", message: `the order leaves out element "${id}"` });
  }
  return problems;
};

// The bounds of the result schema's order (`ranking-result.json`).
const ORDER_MIN = 2;
const ORDER_MAX = 50;

/**
 * Whether `result` has the shape of a Ranking's result, the schema's rule in plain code (pre-PR
 * reviews, security X-1; 7b.6): `order` alone, a list of 2 to 50 strings. That the strings are the
 * item's own element IDs, each once, is the props check's.
 */
export const rankingResultShape = (result: unknown): boolean => {
  if (!isRecord(result)) return false;
  const keys = Object.keys(result);
  const { order } = result;
  return (
    keys.length === 1 &&
    keys[0] === "order" &&
    Array.isArray(order) &&
    order.length >= ORDER_MIN &&
    order.length <= ORDER_MAX &&
    order.every((id) => typeof id === "string")
  );
};

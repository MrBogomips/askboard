// A Ranking's props as the component takes them (design decision 8): the view hands props over as
// data, unchecked, so the shape the schema would give is checked here, then the contract's own
// check of what a schema cannot say. A problem throws, naming the item; the item's error boundary
// then fails it and its question never counts as visible (AD-10).

import {
  RANKING_MAX_ITEMS,
  RANKING_MIN_ITEMS,
  type RankingProps,
  rankingPropsProblems,
} from "@askboard/contract";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const elementProblem = (element: unknown, at: number): string | undefined => {
  if (!isRecord(element)) return `element ${at + 1} is no object`;
  if (typeof element.id !== "string") return `element ${at + 1} has no string ID`;
  if (typeof element.label !== "string") return `element ${at + 1} has no string label`;
  if (element.description !== undefined && typeof element.description !== "string") {
    return `the description of element ${at + 1} is no string`;
  }
  return undefined;
};

// What the schema says: a list of 2 to 50 elements, each with an ID and a label.
const shapeProblem = (props: unknown): string | undefined => {
  if (!isRecord(props)) return "its props are no object";
  const { items } = props;
  if (!Array.isArray(items)) return "its props hold no list of items";
  if (items.length < RANKING_MIN_ITEMS || items.length > RANKING_MAX_ITEMS) {
    return `a Ranking holds ${RANKING_MIN_ITEMS} to ${RANKING_MAX_ITEMS} elements, and this one holds ${items.length}`;
  }
  return items.map(elementProblem).find((problem) => problem !== undefined);
};

/** The props as an agent's Ranking, or an error naming the item and the problem. */
export const checkedRankingProps = (itemId: string, props: unknown): RankingProps => {
  const shape = shapeProblem(props);
  const problems =
    shape === undefined
      ? rankingPropsProblems(props).map(({ path, message }) => `${path}: ${message}`)
      : [shape];
  if (problems.length === 0) return props as RankingProps;
  throw new Error(`the Ranking "${itemId}" refuses its props: ${problems.join("; ")}`);
};

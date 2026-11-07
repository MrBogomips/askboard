// The Ranking's constants and types (approval-scale-ranking, design decision 1): the limits of its
// props, the schemas' IDs and the shapes of an item and its result. Each frozen constant is marked
// pure, so that a view chunk drops those it does not use.

export const RANKING_MIN_ITEMS = 2;
export const RANKING_MAX_ITEMS = 50;
export const RANKING_LABEL_MAX_CHARS = 200;
export const RANKING_DESCRIPTION_MAX_CHARS = 500;

export const RANKING_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:ranking-props",
  result: "urn:askboard:output:ranking-result",
} as const);

/** One element to put in order. */
export type RankingElement = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
};

export type RankingProps = { readonly items: readonly RankingElement[] };

export type RankingItem = {
  readonly type: "ranking";
  readonly id: string;
  readonly props: RankingProps;
};

/** A Ranking's result: the IDs of its elements, each once, in the user's order. */
export type RankingResult = { readonly order: readonly string[] };

// The Ranking (FR-11, approval-scale-ranking): an order of 2 to 50 elements the user sets, whose
// result is `{order}`. Its schemas are standalone: they belong to no schema set until the entry is
// registered (design decision 10), and nothing compiles them when this module loads.

export { rankingPropsProblems, rankingResultProblems, rankingResultShape } from "./checks.ts";
export {
  RANKING_DESCRIPTION_MAX_CHARS,
  RANKING_LABEL_MAX_CHARS,
  RANKING_MAX_ITEMS,
  RANKING_MIN_ITEMS,
  RANKING_SCHEMA_IDS,
  type RankingElement,
  type RankingItem,
  type RankingProps,
  type RankingResult,
} from "./constants.ts";
export { RANKING_KEYS, type RankingKeyAction } from "./keys.ts";
export { RANKING_WIDGET } from "./widget.ts";
